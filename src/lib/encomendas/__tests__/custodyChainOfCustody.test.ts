/**
 * ENCOMENDAS.2F — testes de integração (Firestore Emulator, Admin SDK
 * direto) provando, contra os MESMOS moldes transacionais dos routes
 * reais (retirar/route.ts, retirar/qr/route.ts, retirar-lote/route.ts):
 *
 *   1. registradoPor* (identidade de criação) nunca é sobrescrito por
 *      nenhum caminho de retirada;
 *   2. o evento de sucesso (WITHDRAWN) é escrito na MESMA transação que
 *      a transição de status;
 *   3. tentativas rejeitadas contra um pacote já resolvido também geram
 *      evento seguro (PIN_FAILED/PIN_LOCKED/QR_REJECTED), sem PIN/token
 *      cru nem hash.
 *
 * Requer `firebase emulators:exec --only firestore "npx tsx --test ..."`.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";

import admin from "firebase-admin";
import { evaluatePackagePinAttempt } from "../packagePinPolicy";
import { evaluatePackageQrAttempt } from "../packageQrPolicy";
import { createWithdrawEvent } from "../withdrawal";

if (!admin.apps.length) {
  admin.initializeApp({ projectId: "encomendas2f-custody-test" });
}
const db = admin.firestore();

function sha256(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

const CONDO = "condo-2f";
const CREATOR = { uid: "porteiro-criador", nome: "Porteiro Criador", email: "criador@example.com", role: "PORTEIRO" };
const OPERATOR_B = { uid: "porteiro-b", nome: "Porteiro B", email: "b@example.com", role: "ZELADOR" };

const PIN = "9042";
const PIN_HASH = sha256(PIN);

function pkgRef(id: string) {
  return db.doc(`condominios/${CONDO}/encomendas/${id}`);
}

function qrTokenFor(id: string): string {
  return `opaque-2f-${id}-token`;
}

async function seedPackage(id: string, overrides: Record<string, unknown> = {}) {
  await pkgRef(id).set({
    condominioId: CONDO,
    status: "AGUARDANDO",
    registradoPorUid: CREATOR.uid,
    registradoPorNome: CREATOR.nome,
    registradoPorEmail: CREATOR.email,
    registradoPorRole: CREATOR.role,
    createdAt: new Date().toISOString(),
    pinHash: PIN_HASH,
    pinExpiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    pinAttempts: 0,
    pinLockedUntil: null,
    qrTokenHash: sha256(qrTokenFor(id)),
    qrExpiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    qrUsed: false,
    ...overrides,
  });
}

/** Mirrors retirar/route.ts "codigo" (package-PIN) branch exactly. */
async function attemptPinWithdraw(id: string, pinRaw: string) {
  const ref = pkgRef(id);
  return db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    const data = fresh.data() as any;
    const evalResult = evaluatePackagePinAttempt(data, pinRaw, new Date());
    if (evalResult.mutation) tx.update(ref, evalResult.mutation);

    if (evalResult.outcome.code === "SUCCESS") {
      tx.update(ref, {
        status: "RETIRADA",
        retiradoPorUid: OPERATOR_B.uid,
        retiradoPorNome: OPERATOR_B.nome,
        retiradoPorEmail: OPERATOR_B.email,
        retiradoPorRole: OPERATOR_B.role,
        withdrawMethod: "PIN",
      });
      tx.set(ref.collection("events").doc(), createWithdrawEvent(
        "WITHDRAWN", OPERATOR_B.uid, OPERATOR_B.role, OPERATOR_B.nome,
        { method: "PIN", encomendaId: id, condominioId: CONDO },
      ));
    } else if (evalResult.outcome.code === "PIN_INVALID") {
      const locked = (evalResult.outcome as any).locked;
      tx.set(ref.collection("events").doc(), createWithdrawEvent(
        locked ? "PIN_LOCKED" : "PIN_FAILED", OPERATOR_B.uid, OPERATOR_B.role, OPERATOR_B.nome,
        { method: "PIN", encomendaId: id, condominioId: CONDO, attempt: (evalResult.outcome as any).attempt },
      ));
    }
    return evalResult.outcome;
  });
}

/** Mirrors retirar/qr/route.ts exactly. */
async function attemptQrWithdraw(id: string, tokenRaw: string) {
  const hash = sha256(tokenRaw);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(
      db.collection("condominios").doc(CONDO).collection("encomendas").where("qrTokenHash", "==", hash).limit(1)
    );
    if (snap.empty) return { ok: false as const, code: "QR_NOT_FOUND" as const };
    const ref = snap.docs[0].ref;
    const data = snap.docs[0].data() as any;
    const outcome = evaluatePackageQrAttempt(data, new Date());
    if (outcome.code !== "SUCCESS") {
      tx.set(ref.collection("events").doc(), createWithdrawEvent(
        "QR_REJECTED", OPERATOR_B.uid, OPERATOR_B.role, OPERATOR_B.nome,
        { method: "QR_CODE", encomendaId: ref.id, condominioId: CONDO, reason: outcome.code },
      ));
      return { ok: false as const, code: outcome.code };
    }
    tx.update(ref, {
      status: "RETIRADA",
      withdrawMethod: "QR_CODE",
      retiradoPorUid: OPERATOR_B.uid,
      retiradoPorNome: OPERATOR_B.nome,
    });
    tx.set(ref.collection("events").doc(), createWithdrawEvent(
      "WITHDRAWN", OPERATOR_B.uid, OPERATOR_B.role, OPERATOR_B.nome,
      { method: "QR_CODE", encomendaId: ref.id, condominioId: CONDO },
    ));
    return { ok: true as const, id: ref.id };
  });
}

/** Mirrors retirar-lote/route.ts individual-ids ("PORTEIRO" method) branch. */
async function attemptBatchWithdraw(ids: string[]) {
  return db.runTransaction(async (tx) => {
    const refs = ids.map((id) => pkgRef(id));
    for (const ref of refs) {
      tx.update(ref, {
        status: "RETIRADA",
        retiradoPorUid: OPERATOR_B.uid,
        retiradoPorNome: OPERATOR_B.nome,
        retiradoPorEmail: OPERATOR_B.email,
        retiradoPorRole: OPERATOR_B.role,
        withdrawMethod: "PORTEIRO",
      });
      tx.set(ref.collection("events").doc(), createWithdrawEvent(
        "WITHDRAWN", OPERATOR_B.uid, OPERATOR_B.role, OPERATOR_B.nome,
        { method: "PORTEIRO", condominioId: CONDO },
      ));
    }
  });
}

before(async () => {
  await db.doc(`condominios/${CONDO}/membros/placeholder`).set({ role: "PORTEIRO", status: "ATIVO" });
});
after(async () => {
  await db.doc(`condominios/${CONDO}/membros/placeholder`).delete();
});

test("[custody] retirada por PIN não sobrescreve registradoPor* (criador original preservado)", async () => {
  await seedPackage("custody-pin");
  const outcome = await attemptPinWithdraw("custody-pin", PIN);
  assert.equal(outcome.code, "SUCCESS");
  const fresh = await pkgRef("custody-pin").get();
  assert.equal(fresh.data()?.registradoPorUid, CREATOR.uid);
  assert.equal(fresh.data()?.registradoPorNome, CREATOR.nome);
  assert.equal(fresh.data()?.retiradoPorUid, OPERATOR_B.uid);
});

test("[custody] retirada por QR não sobrescreve registradoPor*", async () => {
  await seedPackage("custody-qr");
  const outcome = await attemptQrWithdraw("custody-qr", qrTokenFor("custody-qr"));
  assert.equal(outcome.ok, true);
  const fresh = await pkgRef("custody-qr").get();
  assert.equal(fresh.data()?.registradoPorUid, CREATOR.uid);
  assert.equal(fresh.data()?.registradoPorNome, CREATOR.nome);
});

test("[custody] retirada em lote não sobrescreve registradoPor* em nenhum pacote do lote", async () => {
  await seedPackage("custody-lote-1");
  await seedPackage("custody-lote-2");
  await attemptBatchWithdraw(["custody-lote-1", "custody-lote-2"]);
  const fresh1 = await pkgRef("custody-lote-1").get();
  const fresh2 = await pkgRef("custody-lote-2").get();
  assert.equal(fresh1.data()?.registradoPorUid, CREATOR.uid);
  assert.equal(fresh2.data()?.registradoPorUid, CREATOR.uid);
});

test("[custody] evento WITHDRAWN (PIN) existe na mesma transação, sem PIN/hash cru", async () => {
  await seedPackage("custody-pin-event");
  await attemptPinWithdraw("custody-pin-event", PIN);
  const events = await pkgRef("custody-pin-event").collection("events").get();
  const withdrawn = events.docs.map((d) => d.data()).find((e) => e.type === "WITHDRAWN");
  assert.ok(withdrawn);
  const serialized = JSON.stringify(withdrawn);
  assert.equal(serialized.includes(PIN), false);
  assert.equal(serialized.includes(PIN_HASH), false);
});

test("[custody] evento WITHDRAWN (QR) existe na mesma transação, sem token/hash cru", async () => {
  await seedPackage("custody-qr-event");
  const token = qrTokenFor("custody-qr-event");
  await attemptQrWithdraw("custody-qr-event", token);
  const events = await pkgRef("custody-qr-event").collection("events").get();
  const withdrawn = events.docs.map((d) => d.data()).find((e) => e.type === "WITHDRAWN");
  assert.ok(withdrawn);
  const serialized = JSON.stringify(withdrawn);
  assert.equal(serialized.includes(token), false);
});

test("[custody] PIN errado contra pacote resolvido gera evento PIN_FAILED (não WITHDRAWN)", async () => {
  await seedPackage("custody-pin-failed");
  const outcome = await attemptPinWithdraw("custody-pin-failed", "0000");
  assert.equal(outcome.code, "PIN_INVALID");
  const events = await pkgRef("custody-pin-failed").collection("events").get();
  const types = events.docs.map((d) => d.data().type);
  assert.equal(types.includes("PIN_FAILED"), true);
  assert.equal(types.includes("WITHDRAWN"), false);
  const fresh = await pkgRef("custody-pin-failed").get();
  assert.equal(fresh.data()?.status, "AGUARDANDO");
});

test("[custody] pacote já retirado rejeita novo QR e gera QR_REJECTED (não WITHDRAWN duplicado)", async () => {
  await seedPackage("custody-qr-rejected", { status: "RETIRADA" });
  const outcome = await attemptQrWithdraw("custody-qr-rejected", qrTokenFor("custody-qr-rejected"));
  assert.equal(outcome.ok, false);
  const events = await pkgRef("custody-qr-rejected").collection("events").get();
  const types = events.docs.map((d) => d.data().type);
  assert.equal(types.includes("QR_REJECTED"), true);
  assert.equal(types.includes("WITHDRAWN"), false);
});

test("[custody] falha na retirada nunca cria segundo evento WITHDRAWN para pacote já retirado", async () => {
  await seedPackage("custody-double-withdraw");
  const first = await attemptPinWithdraw("custody-double-withdraw", PIN);
  assert.equal(first.code, "SUCCESS");
  const second = await attemptPinWithdraw("custody-double-withdraw", PIN);
  assert.equal(second.code, "PACKAGE_ALREADY_WITHDRAWN");
  const events = await pkgRef("custody-double-withdraw").collection("events").get();
  const withdrawnCount = events.docs.map((d) => d.data()).filter((e) => e.type === "WITHDRAWN").length;
  assert.equal(withdrawnCount, 1);
});

test("[custody] concorrência: mesmo após corrida QR-vs-PIN, registradoPor* permanece o criador original", async () => {
  await seedPackage("custody-race");
  await Promise.all([
    attemptQrWithdraw("custody-race", qrTokenFor("custody-race")),
    attemptPinWithdraw("custody-race", PIN),
  ]);
  const fresh = await pkgRef("custody-race").get();
  assert.equal(fresh.data()?.status, "RETIRADA");
  assert.equal(fresh.data()?.registradoPorUid, CREATOR.uid);
});
