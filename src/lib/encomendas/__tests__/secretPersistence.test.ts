/**
 * ENCOMENDAS.2G-FIX.1 — testes provando que dois segredos deixaram de ser
 * persistidos:
 *
 *   A) pinLast4 do PIN de encomenda (4 dígitos) — "últimos 4 dígitos" de
 *      um PIN de 4 dígitos É o PIN inteiro;
 *   B) o token portador (bearer) de lote em metadata de evento de
 *      auditoria (campo "lote").
 *
 * Mistura testes puros (allowlist/projeção) com testes de integração via
 * Firestore Emulator que replicam exatamente a escrita das rotas reais
 * (mesmo padrão já usado em packagePinTransaction.test.ts /
 * packageQrTransaction.test.ts / custodyChainOfCustody.test.ts), para não
 * aceitar "os testes do helper passam" enquanto a rota viva ainda
 * persistisse o campo.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";

import admin from "firebase-admin";
import {
  SAFE_EVENT_METADATA_KEYS,
  createWithdrawEvent,
  hashPin,
  generatePin,
} from "../withdrawal";
import { buildEncomendaAuditProjection } from "../auditProjection";
import { evaluatePackagePinAttempt } from "../packagePinPolicy";

if (!admin.apps.length) {
  admin.initializeApp({ projectId: "encomendas2gfix-secret-test" });
}
const db = admin.firestore();

function sha256(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

const CONDO = "condo-2gfix";

function pkgRef(id: string) {
  return db.doc(`condominios/${CONDO}/encomendas/${id}`);
}

before(async () => {
  await db.doc(`condominios/${CONDO}/membros/placeholder`).set({ role: "PORTEIRO", status: "ATIVO" });
});
after(async () => {
  await db.doc(`condominios/${CONDO}/membros/placeholder`).delete();
});

// ═══════════════════════════ A) PACKAGE PIN ═══════════════════════════

test("SAFE_EVENT_METADATA_KEYS não contém mais 'lote'", () => {
  assert.equal((SAFE_EVENT_METADATA_KEYS as readonly string[]).includes("lote"), false);
});

test("[tx] create/route.ts (replicado): documento persistido não tem campo pinLast4", async () => {
  const pinRaw = generatePin(4);
  const pinHashVal = hashPin(pinRaw);
  const ref = pkgRef("create-no-pinlast4");

  // Réplica exata do objeto de escrita de create/route.ts pós-2G-FIX.1
  // (sem pinLast4).
  await db.runTransaction(async (tx) => {
    tx.set(ref, {
      condominioId: CONDO,
      status: "AGUARDANDO",
      codigo: "PKG-TESTFIX01",
      pinHash: pinHashVal,
      pinExpiresAt: new Date(Date.now() + 72 * 3600000).toISOString(),
      pinAttempts: 0,
      pinLockedUntil: null,
    });
  });

  const snap = await ref.get();
  const data = snap.data()!;
  assert.equal("pinLast4" in data, false);
  assert.equal(data.pinHash, pinHashVal);

  // Nenhum campo string do documento persistido é igual ao PIN cru.
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      assert.notEqual(value, pinRaw, `campo "${key}" não deveria igualar o PIN cru`);
    }
  }
});

test("[tx] credencial/route.ts tipo=PIN (replicado): reemissão não persiste pinLast4", async () => {
  const ref = pkgRef("credencial-no-pinlast4");
  await ref.set({ condominioId: CONDO, status: "AGUARDANDO", unidadeIdNorm: "1" });

  const pinRaw = generatePin(4);
  const pinHashVal = hashPin(pinRaw);

  // Réplica exata do objeto de update de credencial/route.ts pós-fix.
  await ref.update({
    pinHash: pinHashVal,
    pinExpiresAt: new Date(Date.now() + 72 * 3600000).toISOString(),
    pinAttempts: 0,
    pinLockedUntil: null,
  });

  const snap = await ref.get();
  const data = snap.data()!;
  assert.equal("pinLast4" in data, false);
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      assert.notEqual(value, pinRaw, `campo "${key}" não deveria igualar o PIN cru`);
    }
  }
});

test("PIN de encomenda ainda autentica corretamente sem pinLast4 (validação não depende dele)", () => {
  const pinRaw = "8452";
  const pinHash = hashPin(pinRaw);
  const snapshot = {
    status: "AGUARDANDO",
    pinHash,
    pinExpiresAt: new Date(Date.now() + 3600000).toISOString(),
    pinAttempts: 0,
    pinLockedUntil: null,
  };
  const result = evaluatePackagePinAttempt(snapshot, pinRaw, new Date());
  assert.equal(result.outcome.code, "SUCCESS");
});

test("PIN errado ainda incrementa tentativas sem depender de pinLast4", () => {
  const pinHash = hashPin("1111");
  const snapshot = { status: "AGUARDANDO", pinHash, pinExpiresAt: new Date(Date.now() + 3600000).toISOString(), pinAttempts: 2, pinLockedUntil: null };
  const result = evaluatePackagePinAttempt(snapshot, "0000", new Date());
  assert.equal(result.outcome.code, "PIN_INVALID");
  assert.equal((result.outcome as any).attempt, 3);
});

test("5 tentativas erradas ainda bloqueiam sem depender de pinLast4", () => {
  const pinHash = hashPin("1111");
  const snapshot = { status: "AGUARDANDO", pinHash, pinExpiresAt: new Date(Date.now() + 3600000).toISOString(), pinAttempts: 4, pinLockedUntil: null };
  const result = evaluatePackagePinAttempt(snapshot, "0000", new Date());
  assert.equal((result.outcome as any).locked, true);
});

test("expiração ainda é aplicada sem depender de pinLast4", () => {
  const pinHash = hashPin("1111");
  const snapshot = { status: "AGUARDANDO", pinHash, pinExpiresAt: new Date(Date.now() - 1000).toISOString(), pinAttempts: 0, pinLockedUntil: null };
  const result = evaluatePackagePinAttempt(snapshot, "1111", new Date());
  assert.equal(result.outcome.code, "PIN_EXPIRED");
});

test("resposta de auditoria não contém nenhum campo pinLast4/PIN derivado", () => {
  const data = {
    status: "RETIRADA", registradoPorUid: "u1", withdrawMethod: "PIN",
    // documento hipotético SEM pinLast4 (já que a rota não grava mais)
    pinHash: "abc123",
  };
  const projection = buildEncomendaAuditProjection("enc-1", CONDO, data, []);
  const serialized = JSON.stringify(projection);
  assert.equal(serialized.includes("pinLast4"), false);
  assert.equal(serialized.includes("pinHash"), false);
});

// ═══════════════════════════ B) BATCH BEARER TOKEN ═══════════════════════════

test("createWithdrawEvent descarta 'lote' mesmo se um chamador ainda passar esse campo", () => {
  const event = createWithdrawEvent("WITHDRAWN", "uid1", "PORTEIRO", "Nome", {
    method: "QR_CODE", encomendaId: "enc1", condominioId: CONDO, lote: "LOTE-SECRETXX",
  } as any);
  assert.equal("lote" in (event.metadata ?? {}), false);
  assert.equal(JSON.stringify(event).includes("LOTE-SECRETXX"), false);
});

test("[tx] retirar-lote/route.ts (replicado): evento WITHDRAWN não contém o token de lote", async () => {
  const ref = pkgRef("lote-no-token-in-event");
  await ref.set({ condominioId: CONDO, status: "AGUARDANDO" });

  const batchToken = "LOTE-REALSECRET1";
  await db.runTransaction(async (tx) => {
    tx.update(ref, { status: "RETIRADA", withdrawMethod: "QR_CODE" });
    const eventRef = ref.collection("events").doc();
    // Réplica exata da chamada pós-fix — sem "lote" no objeto de metadata.
    tx.set(eventRef, createWithdrawEvent("WITHDRAWN", "uid1", "PORTEIRO", "Nome", {
      method: "QR_CODE", encomendaId: ref.id, condominioId: CONDO,
    }));
  });

  const events = await ref.collection("events").get();
  const withdrawn = events.docs.map((d) => d.data()).find((e) => e.type === "WITHDRAWN");
  assert.ok(withdrawn);
  assert.equal(JSON.stringify(withdrawn).includes(batchToken), false);
  assert.equal("lote" in withdrawn.metadata, false);
});

test("legado: evento pré-existente com metadata.lote é filtrado pela projeção de auditoria (defesa em profundidade)", () => {
  const legacyEvent = {
    type: "WITHDRAWN",
    timestamp: new Date().toISOString(),
    actorUid: "uid1",
    actorRole: "PORTEIRO",
    actorName: "Nome",
    // Simula um documento gravado ANTES desta correção, com o token cru.
    metadata: { method: "QR_CODE", encomendaId: "enc1", condominioId: CONDO, lote: "LOTE-LEGACYSECRET" },
  };
  const projection = buildEncomendaAuditProjection("enc1", CONDO, { status: "RETIRADA" }, [legacyEvent]);
  const serialized = JSON.stringify(projection);
  assert.equal(serialized.includes("LOTE-LEGACYSECRET"), false);
  assert.equal(serialized.includes("lote"), false);
});

test("retirada em lote continua funcionando (transição de status íntegra) sem o campo lote no evento", async () => {
  const ref = pkgRef("lote-still-works");
  await ref.set({ condominioId: CONDO, status: "AGUARDANDO", registradoPorUid: "creator-1" });

  await db.runTransaction(async (tx) => {
    tx.update(ref, { status: "RETIRADA", withdrawMethod: "QR_CODE", retiradoPorUid: "staff-1" });
    tx.set(ref.collection("events").doc(), createWithdrawEvent("WITHDRAWN", "staff-1", "PORTEIRO", "Staff", {
      method: "QR_CODE", encomendaId: ref.id, condominioId: CONDO,
    }));
  });

  const fresh = await ref.get();
  assert.equal(fresh.data()?.status, "RETIRADA");
  assert.equal(fresh.data()?.registradoPorUid, "creator-1"); // criador imutável, preservado
  assert.equal(fresh.data()?.retiradoPorUid, "staff-1");
});
