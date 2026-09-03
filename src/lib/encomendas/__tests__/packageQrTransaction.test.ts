/**
 * ENCOMENDAS.2E — testes de integração (Firestore Emulator, Admin SDK
 * direto) provando que a política de packageQrPolicy.ts, aplicada dentro
 * de uma transação real nos mesmos moldes de
 * src/app/api/encomendas/retirar/qr/route.ts, persiste corretamente sob
 * concorrência — incluindo a corrida QR vs PIN contra o mesmo documento
 * (Fase 14/17 do gate).
 *
 * Requer `firebase emulators:exec --only firestore "npx tsx --test ..."`,
 * que define FIRESTORE_EMULATOR_HOST automaticamente.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";

import admin from "firebase-admin";
import { evaluatePackageQrAttempt } from "../packageQrPolicy";
import { evaluatePackagePinAttempt } from "../packagePinPolicy";

if (!admin.apps.length) {
  admin.initializeApp({ projectId: "encomendas2e-qr-tx-test" });
}
const db = admin.firestore();

function sha256(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

const CONDO = "condo-2e";
const PIN = "6031";
const PIN_HASH = sha256(PIN);

function pkgRef(id: string) {
  return db.doc(`condominios/${CONDO}/encomendas/${id}`);
}

/**
 * Cada pacote de teste usa seu PRÓPRIO token opaco (derivado do id) — a
 * query de retirada por QR é `where("qrTokenHash","==",hash).limit(1)`
 * sobre TODA a coleção do tenant, então reaproveitar o mesmo hash entre
 * pacotes de testes diferentes tornaria qual documento é encontrado
 * ambíguo (dependente de ordem, não do teste que o semeou).
 */
function qrTokenFor(id: string): string {
  return `opaque-token-${id}-b7f1c9d2e4a6`;
}

async function seedPackage(id: string, overrides: Record<string, unknown> = {}) {
  await pkgRef(id).set({
    condominioId: CONDO,
    status: "AGUARDANDO",
    qrTokenHash: sha256(qrTokenFor(id)),
    qrExpiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    qrUsed: false,
    pinHash: PIN_HASH,
    pinExpiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    pinAttempts: 0,
    pinLockedUntil: null,
    ...overrides,
  });
}

/** Reproduz exatamente o wiring transacional de retirar/qr/route.ts. */
async function attemptQrWithdraw(id: string, tokenRaw: string, now: Date = new Date()) {
  const ref = pkgRef(id);
  const hash = sha256(tokenRaw);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(
      db.collection("condominios").doc(CONDO).collection("encomendas")
        .where("qrTokenHash", "==", hash)
        .limit(1)
    );
    if (snap.empty) return { ok: false as const, code: "QR_NOT_FOUND" as const };
    const docRef = snap.docs[0].ref;
    const data = snap.docs[0].data() as any;
    const outcome = evaluatePackageQrAttempt(data, now);
    if (outcome.code !== "SUCCESS") return { ok: false as const, code: outcome.code };
    tx.update(docRef, { status: "RETIRADA", withdrawMethod: "QR_CODE", qrUsed: true });
    return { ok: true as const, id: docRef.id };
  });
}

/** Reproduz exatamente o wiring transacional de retirar/route.ts (branch PIN). */
async function attemptPinWithdraw(id: string, pinRaw: string, now: Date = new Date()) {
  const ref = pkgRef(id);
  return db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    const data = fresh.data() as any;
    const evalResult = evaluatePackagePinAttempt(data, pinRaw, now);
    if (evalResult.mutation) tx.update(ref, evalResult.mutation);
    if (evalResult.outcome.code === "SUCCESS") {
      tx.update(ref, { status: "RETIRADA", withdrawMethod: "PIN" });
    }
    return evalResult.outcome;
  });
}

before(async () => {
  await db.doc(`condominios/${CONDO}/membros/placeholder`).set({ role: "PORTEIRO", status: "ATIVO" });
});

after(async () => {
  await db.doc(`condominios/${CONDO}/membros/placeholder`).delete();
});

test("[tx] QR válido sucede e persiste RETIRADA + qrUsed=true", async () => {
  await seedPackage("qr-success");
  const r = await attemptQrWithdraw("qr-success", qrTokenFor("qr-success"));
  assert.equal(r.ok, true);
  const fresh = await pkgRef("qr-success").get();
  assert.equal(fresh.data()?.status, "RETIRADA");
  assert.equal(fresh.data()?.qrUsed, true);
  assert.equal(fresh.data()?.withdrawMethod, "QR_CODE");
});

test("[tx] token errado (hash não bate): falha fechada, nenhum documento encontrado", async () => {
  await seedPackage("qr-wrong-token");
  const r = await attemptQrWithdraw("qr-wrong-token", "token-completamente-diferente");
  assert.equal(r.ok, false);
  assert.equal((r as any).code, "QR_NOT_FOUND");
  const fresh = await pkgRef("qr-wrong-token").get();
  assert.equal(fresh.data()?.status, "AGUARDANDO");
});

test("[tx] QR expirado falha e não retira o pacote", async () => {
  await seedPackage("qr-expired", { qrExpiresAt: new Date(Date.now() - 1000).toISOString() });
  const r = await attemptQrWithdraw("qr-expired", qrTokenFor("qr-expired"));
  assert.equal(r.ok, false);
  assert.equal((r as any).code, "QR_EXPIRED");
  const fresh = await pkgRef("qr-expired").get();
  assert.equal(fresh.data()?.status, "AGUARDANDO");
});

test("[tx] pacote sem credencial QR emitida (qrTokenHash ausente) falha fechado — token nenhum bate", async () => {
  await seedPackage("qr-no-credential", { qrTokenHash: null });
  const r = await attemptQrWithdraw("qr-no-credential", qrTokenFor("qr-no-credential"));
  assert.equal(r.ok, false);
  assert.equal((r as any).code, "QR_NOT_FOUND");
});

test("[tx] pacote já retirado rejeita novo QR (PACKAGE_ALREADY_WITHDRAWN)", async () => {
  await seedPackage("qr-already-withdrawn", { status: "RETIRADA", qrUsed: true });
  const r = await attemptQrWithdraw("qr-already-withdrawn", qrTokenFor("qr-already-withdrawn"));
  assert.equal(r.ok, false);
  assert.equal((r as any).code, "PACKAGE_ALREADY_WITHDRAWN");
});

test("[tx] replay do mesmo QR após retirada falha (qrUsed=true bloqueia mesmo com status ainda AGUARDANDO hipotético)", async () => {
  await seedPackage("qr-replay");
  const first = await attemptQrWithdraw("qr-replay", qrTokenFor("qr-replay"));
  assert.equal(first.ok, true);
  const second = await attemptQrWithdraw("qr-replay", qrTokenFor("qr-replay"));
  assert.equal(second.ok, false);
  assert.equal((second as any).code, "PACKAGE_ALREADY_WITHDRAWN");
});

test("[tx] duas retiradas QR concorrentes para o mesmo pacote: exatamente uma sucede", async () => {
  await seedPackage("qr-concurrent");
  const [r1, r2] = await Promise.all([
    attemptQrWithdraw("qr-concurrent", qrTokenFor("qr-concurrent")),
    attemptQrWithdraw("qr-concurrent", qrTokenFor("qr-concurrent")),
  ]);
  const successes = [r1, r2].filter((r) => r.ok);
  assert.equal(successes.length, 1);
  const fresh = await pkgRef("qr-concurrent").get();
  assert.equal(fresh.data()?.status, "RETIRADA");
});

// Fase 14/17-14 — corrida QR vs PIN contra o MESMO documento: ambos
// serializam pelo mesmo path condominios/{condominioId}/encomendas/{id},
// então o Firestore garante que só uma das duas transações comita.
test("[tx] QR válido concorrente com PIN válido no mesmo pacote: exatamente um sucede", async () => {
  await seedPackage("qr-vs-pin-race");
  const [qrResult, pinResult] = await Promise.all([
    attemptQrWithdraw("qr-vs-pin-race", qrTokenFor("qr-vs-pin-race")),
    attemptPinWithdraw("qr-vs-pin-race", PIN),
  ]);
  const qrSucceeded = qrResult.ok;
  const pinSucceeded = pinResult.code === "SUCCESS";
  assert.equal(qrSucceeded !== pinSucceeded, true, "exatamente um dos dois deve suceder, nunca ambos nem nenhum");

  const fresh = await pkgRef("qr-vs-pin-race").get();
  assert.equal(fresh.data()?.status, "RETIRADA");
  assert.equal(["QR_CODE", "PIN"].includes(fresh.data()?.withdrawMethod), true);
});

test("[tx] wrong tenant: QR válido em outro condomínio não localiza o pacote", async () => {
  await seedPackage("qr-tenant-a");
  const sharedToken = qrTokenFor("qr-tenant-a");
  const otherCondoRef = db.doc(`condominios/condo-2e-other/encomendas/qr-tenant-b`);
  await otherCondoRef.set({
    condominioId: "condo-2e-other",
    status: "AGUARDANDO",
    qrTokenHash: sha256(sharedToken),
    qrExpiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    qrUsed: false,
  });

  // consulta restrita ao path do tenant A — mesmo com um documento de
  // MESMO hash existindo sob outro condomínio, só o do tenant correto
  // pode ser encontrado (isolamento por path, não por filtro adicional).
  const snap = await db.collection("condominios").doc(CONDO).collection("encomendas")
    .where("qrTokenHash", "==", sha256(sharedToken)).limit(1).get();
  assert.equal(snap.docs[0].id, "qr-tenant-a");

  const r = await attemptQrWithdraw("qr-tenant-a", sharedToken);
  assert.equal(r.ok, true);

  await otherCondoRef.delete();
});

test("[tx] QR malformado/vazio nunca bate com nenhum token real (hash de string vazia é distinto)", async () => {
  await seedPackage("qr-empty-check");
  const r = await attemptQrWithdraw("qr-empty-check", "");
  assert.equal(r.ok, false);
  assert.equal((r as any).code, "QR_NOT_FOUND");
});

// PKG code / codigoRetiradaHash não autenticam
test("[tx] código PKG (identificador) não autentica via QR: hash de PKG-XXXX não bate com qrTokenHash real", async () => {
  await seedPackage("pkg-code-not-auth", { codigo: "PKG-7Q9K2M" });
  const r = await attemptQrWithdraw("pkg-code-not-auth", "PKG-7Q9K2M");
  assert.equal(r.ok, false);
  assert.equal((r as any).code, "QR_NOT_FOUND");
});
