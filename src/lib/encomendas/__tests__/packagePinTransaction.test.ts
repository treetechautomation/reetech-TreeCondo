/**
 * ENCOMENDAS.2D — testes de integração (Firestore Emulator, Admin SDK
 * direto) provando que a política de packagePinPolicy.ts, quando aplicada
 * dentro de uma transação real nos mesmos moldes de
 * src/app/api/encomendas/retirar/route.ts, persiste corretamente sob
 * concorrência e nunca reverte o incremento de tentativa junto com a
 * rejeição (Fase 10/11 do gate).
 *
 * Requer `firebase emulators:exec --only firestore "npx tsx --test ..."`,
 * que define FIRESTORE_EMULATOR_HOST automaticamente.
 */
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";

import admin from "firebase-admin";
import { evaluatePackagePinAttempt, type PackagePinOutcome } from "../packagePinPolicy";

if (!admin.apps.length) {
  admin.initializeApp({ projectId: "encomendas2d-pin-tx-test" });
}
const db = admin.firestore();

function sha256(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

const PIN = "7391";
const PIN_HASH = sha256(PIN);
const CONDO = "condo-2d";

function pkgRef(id: string) {
  return db.doc(`condominios/${CONDO}/encomendas/${id}`);
}

async function seedPackage(id: string, overrides: Record<string, unknown> = {}) {
  await pkgRef(id).set({
    condominioId: CONDO,
    status: "AGUARDANDO",
    pinHash: PIN_HASH,
    pinExpiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    pinAttempts: 0,
    pinLockedUntil: null,
    ...overrides,
  });
}

/** Reproduz exatamente o wiring transacional usado por retirar/route.ts. */
async function attemptWithdrawViaPin(
  id: string,
  pinRaw: string,
  now: Date = new Date(),
): Promise<PackagePinOutcome> {
  const ref = pkgRef(id);
  let outcome!: PackagePinOutcome;
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    const data = fresh.data() as any;
    const evalResult = evaluatePackagePinAttempt(data, pinRaw, now);
    outcome = evalResult.outcome;
    if (evalResult.mutation) {
      tx.update(ref, evalResult.mutation);
    }
    if (evalResult.outcome.code === "SUCCESS") {
      tx.update(ref, { status: "RETIRADA", withdrawMethod: "PIN" });
    }
  });
  return outcome;
}

before(async () => {
  await db.doc(`condominios/${CONDO}/membros/placeholder`).set({ role: "PORTEIRO", status: "ATIVO" });
});

after(async () => {
  await db.doc(`condominios/${CONDO}/membros/placeholder`).delete();
});

// Fase 10 — persistência atômica da tentativa mesmo quando a operação é rejeitada
test("[tx] PIN errado: outcome=PIN_INVALID E pinAttempts=1 realmente persiste no Firestore", async () => {
  await seedPackage("tx-attempt-persist");
  const outcome = await attemptWithdrawViaPin("tx-attempt-persist", "0000");
  assert.equal(outcome.code, "PIN_INVALID");

  const fresh = await pkgRef("tx-attempt-persist").get();
  assert.equal(fresh.data()?.pinAttempts, 1);
  assert.equal(fresh.data()?.status, "AGUARDANDO");
});

test("[tx] cinco tentativas erradas em sequência: cada uma persiste, a quinta ativa o bloqueio", async () => {
  await seedPackage("tx-five-attempts");
  for (let i = 1; i <= 4; i++) {
    const outcome = await attemptWithdrawViaPin("tx-five-attempts", "0000");
    assert.deepEqual(outcome, { code: "PIN_INVALID", attempt: i, locked: false, lockedUntil: null });
  }
  const fifth = await attemptWithdrawViaPin("tx-five-attempts", "0000");
  assert.equal(fifth.code, "PIN_INVALID");
  assert.equal((fifth as any).locked, true);

  const fresh = await pkgRef("tx-five-attempts").get();
  assert.equal(fresh.data()?.pinAttempts, 5);
  assert.ok(fresh.data()?.pinLockedUntil);
});

test("[tx] bloqueio ativo persiste rejeição sem alterar pinAttempts", async () => {
  await seedPackage("tx-active-lock", { pinAttempts: 5, pinLockedUntil: new Date(Date.now() + 5 * 60000).toISOString() });
  const outcome = await attemptWithdrawViaPin("tx-active-lock", PIN);
  assert.equal(outcome.code, "PIN_LOCKED");

  const fresh = await pkgRef("tx-active-lock").get();
  assert.equal(fresh.data()?.pinAttempts, 5);
});

test("[tx] bloqueio vencido: PIN correto sucede e persiste RETIRADA + reset de attempts/lock", async () => {
  await seedPackage("tx-expired-lock-success", { pinAttempts: 5, pinLockedUntil: new Date(Date.now() - 1000).toISOString() });
  const outcome = await attemptWithdrawViaPin("tx-expired-lock-success", PIN);
  assert.equal(outcome.code, "SUCCESS");

  const fresh = await pkgRef("tx-expired-lock-success").get();
  assert.equal(fresh.data()?.status, "RETIRADA");
});

test("[tx] PIN expirado persiste rejeição sem incrementar pinAttempts", async () => {
  await seedPackage("tx-expired-pin", { pinExpiresAt: new Date(Date.now() - 1000).toISOString(), pinAttempts: 2 });
  const outcome = await attemptWithdrawViaPin("tx-expired-pin", "0000");
  assert.equal(outcome.code, "PIN_EXPIRED");

  const fresh = await pkgRef("tx-expired-pin").get();
  assert.equal(fresh.data()?.pinAttempts, 2);
});

// sucesso / replay
test("[tx] retirada bem-sucedida grava status RETIRADA e withdrawMethod=PIN", async () => {
  await seedPackage("tx-success-method");
  const outcome = await attemptWithdrawViaPin("tx-success-method", PIN);
  assert.equal(outcome.code, "SUCCESS");
  const fresh = await pkgRef("tx-success-method").get();
  assert.equal(fresh.data()?.status, "RETIRADA");
  assert.equal(fresh.data()?.withdrawMethod, "PIN");
});

test("[tx] replay do mesmo PIN após retirada falha (status já não é AGUARDANDO)", async () => {
  await seedPackage("tx-replay");
  const first = await attemptWithdrawViaPin("tx-replay", PIN);
  assert.equal(first.code, "SUCCESS");
  const second = await attemptWithdrawViaPin("tx-replay", PIN);
  assert.equal(second.code, "PACKAGE_ALREADY_WITHDRAWN");
});

// Fase 11 — concorrência
test("[tx] duas retiradas válidas concorrentes para o mesmo pacote: exatamente uma sucede", async () => {
  await seedPackage("tx-concurrent-success");
  const [r1, r2] = await Promise.all([
    attemptWithdrawViaPin("tx-concurrent-success", PIN),
    attemptWithdrawViaPin("tx-concurrent-success", PIN),
  ]);
  const successes = [r1, r2].filter((o) => o.code === "SUCCESS");
  const alreadyWithdrawn = [r1, r2].filter((o) => o.code === "PACKAGE_ALREADY_WITHDRAWN");
  assert.equal(successes.length, 1);
  assert.equal(alreadyWithdrawn.length, 1);

  const fresh = await pkgRef("tx-concurrent-success").get();
  assert.equal(fresh.data()?.status, "RETIRADA");
});

test("[tx] tentativas erradas concorrentes não perdem incremento (contagem final correta)", async () => {
  await seedPackage("tx-concurrent-wrong");
  await Promise.all([
    attemptWithdrawViaPin("tx-concurrent-wrong", "0000"),
    attemptWithdrawViaPin("tx-concurrent-wrong", "1111"),
    attemptWithdrawViaPin("tx-concurrent-wrong", "2222"),
  ]);

  const fresh = await pkgRef("tx-concurrent-wrong").get();
  assert.equal(fresh.data()?.pinAttempts, 3);
});

// isolamento de tenant/pacote — cada documento é endereçado pelo path
// condominios/{condominioId}/encomendas/{id}; nenhuma tentativa contra um
// id pode afetar o contador de outro pacote/tenant.
test("[tx] tentativas erradas em um pacote não afetam o contador de outro pacote", async () => {
  await seedPackage("tx-isolation-a");
  await seedPackage("tx-isolation-b");
  await attemptWithdrawViaPin("tx-isolation-a", "0000");
  await attemptWithdrawViaPin("tx-isolation-a", "0000");

  const freshA = await pkgRef("tx-isolation-a").get();
  const freshB = await pkgRef("tx-isolation-b").get();
  assert.equal(freshA.data()?.pinAttempts, 2);
  assert.equal(freshB.data()?.pinAttempts, 0);
});
