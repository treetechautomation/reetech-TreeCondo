/**
 * ENCOMENDAS.2B — Firestore Rules tests proving server-authority-only
 * writes on `encomendas` documents (P1-1 closure).
 *
 * Every legitimate mutation (create, withdraw, batch withdraw) already
 * goes exclusively through Admin SDK API routes, which bypass these
 * rules entirely — confirmed zero legitimate live client writers before
 * this patch (ENCOMENDAS.2A). These tests prove the client SDK can
 * never create/update/delete an encomenda directly, for any role,
 * while read access remains exactly as it was.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const CONDO_A = "condo-a";
const CONDO_B = "condo-b";

let testEnv: RulesTestEnvironment;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "encomendas2b-rules-test",
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8") },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const membro = (condoId: string, uid: string, role: string, extra: Record<string, any> = {}) =>
      db.doc(`condominios/${condoId}/membros/${uid}`).set({ role, status: "ATIVO", ...extra });

    await membro(CONDO_A, "morador-a-unit1", "MORADOR", { unidadeIdNorm: "unit-1", blocoIdNorm: null });
    await membro(CONDO_A, "morador-a-unit2", "MORADOR", { unidadeIdNorm: "unit-2", blocoIdNorm: null });
    await membro(CONDO_A, "porteiro-a", "PORTEIRO");
    await membro(CONDO_A, "zelador-a", "ZELADOR");
    await membro(CONDO_A, "admin-a", "ADMIN");
    await membro(CONDO_A, "sindico-a", "SINDICO");
    await membro(CONDO_B, "morador-b1", "MORADOR", { unidadeIdNorm: "unit-1", blocoIdNorm: null });
    await membro(CONDO_B, "porteiro-b", "PORTEIRO");

    // package belonging to unit-1 in condo A — used for all read/write probes
    await db.doc(`condominios/${CONDO_A}/encomendas/pkg-1`).set({
      condominioId: CONDO_A,
      status: "AGUARDANDO",
      unidadeId: "unit-1",
      unidadeIdNorm: "unit-1",
      blocoIdNorm: null,
      transportadora: "Correios",
      codigo: "PKG-00000001",
      codigoRetiradaHash: "fixture-hash",
      pinHash: "fixture-hash",
      pinAttempts: 0,
      pinLockedUntil: null,
      pinExpiresAt: "2099-01-01T00:00:00.000Z",
      createdAt: 1,
    });

    await db.doc(`condominios/${CONDO_A}/encomendas/pkg-1/events/evt-1`).set({
      type: "REGISTERED",
      timestamp: 1,
    });

    await db.doc(`condominios/${CONDO_A}/retiradas_lote/lote-1`).set({
      unidadeId: "unit-1",
      status: "PENDENTE",
      encomendaIds: ["pkg-1"],
    });
  });
});

after(async () => {
  await testEnv.cleanup();
});

function as(uid: string | null) {
  return uid ? testEnv.authenticatedContext(uid).firestore() : testEnv.unauthenticatedContext().firestore();
}

function asSuper(uid: string) {
  return testEnv.authenticatedContext(uid, { super_admin: true }).firestore();
}

const PKG = `condominios/${CONDO_A}/encomendas/pkg-1`;

// ───────────── reads: unchanged from pre-2B policy ─────────────

test("1. PORTEIRO can read an encomenda in own condo (existing read policy preserved)", async () => {
  await assertSucceeds(as("porteiro-a").doc(PKG).get());
});

test("14. MORADOR may only read a package belonging to their own eligible unit", async () => {
  await assertSucceeds(as("morador-a-unit1").doc(PKG).get());
});

test("15. MORADOR cannot read another unit's package", async () => {
  await assertFails(as("morador-a-unit2").doc(PKG).get());
});

test("16. Cross-tenant read remains denied", async () => {
  await assertFails(as("porteiro-b").doc(PKG).get());
  await assertFails(as("morador-b1").doc(PKG).get());
});

// ───────────── PORTEIRO: writes ─────────────

test("2. PORTEIRO cannot directly CREATE an encomenda", async () => {
  await assertFails(
    as("porteiro-a").doc(`condominios/${CONDO_A}/encomendas/new-pkg`).set({
      condominioId: CONDO_A,
      status: "AGUARDANDO",
      unidadeIdNorm: "unit-1",
    }),
  );
});

test("3. PORTEIRO cannot directly UPDATE a normal descriptive field", async () => {
  await assertFails(as("porteiro-a").doc(PKG).update({ transportadora: "Jadlog" }));
});

test("4. PORTEIRO cannot directly UPDATE status", async () => {
  await assertFails(as("porteiro-a").doc(PKG).update({ status: "RETIRADA" }));
});

test("5. PORTEIRO cannot directly UPDATE credential/attempt fields", async () => {
  await assertFails(as("porteiro-a").doc(PKG).update({ codigoRetiradaHash: "forged-hash" }));
  await assertFails(as("porteiro-a").doc(PKG).update({ pinHash: "forged-hash" }));
  await assertFails(as("porteiro-a").doc(PKG).update({ pinAttempts: 999 }));
  await assertFails(as("porteiro-a").doc(PKG).update({ pinLockedUntil: null }));
  await assertFails(as("porteiro-a").doc(PKG).update({ pinExpiresAt: "2099-01-01T00:00:00.000Z" }));
});

test("6. PORTEIRO cannot directly forge withdrawal/custody fields", async () => {
  await assertFails(as("porteiro-a").doc(PKG).update({ retiradoPorUid: "porteiro-a" }));
  await assertFails(as("porteiro-a").doc(PKG).update({ retiradoPorNome: "Forged Name" }));
  await assertFails(as("porteiro-a").doc(PKG).update({ retiradaEm: 1 }));
  await assertFails(as("porteiro-a").doc(PKG).update({ withdrawMethod: "PORTEIRO" }));
});

test("7. PORTEIRO cannot directly DELETE", async () => {
  await assertFails(as("porteiro-a").doc(PKG).delete());
});

test("17. Cross-tenant write remains denied", async () => {
  await assertFails(as("porteiro-b").doc(PKG).update({ status: "RETIRADA" }));
});

// ───────────── ZELADOR: writes ─────────────

test("8. ZELADOR cannot directly CREATE", async () => {
  await assertFails(
    as("zelador-a").doc(`condominios/${CONDO_A}/encomendas/new-pkg-2`).set({ condominioId: CONDO_A, status: "AGUARDANDO" }),
  );
});

test("9. ZELADOR cannot directly UPDATE", async () => {
  await assertFails(as("zelador-a").doc(PKG).update({ status: "RETIRADA" }));
});

test("10. ZELADOR cannot directly DELETE", async () => {
  await assertFails(as("zelador-a").doc(PKG).delete());
});

// ───────────── MORADOR: writes ─────────────

test("11. MORADOR cannot CREATE", async () => {
  await assertFails(
    as("morador-a-unit1").doc(`condominios/${CONDO_A}/encomendas/new-pkg-3`).set({ condominioId: CONDO_A, status: "AGUARDANDO" }),
  );
});

test("12. MORADOR cannot UPDATE", async () => {
  await assertFails(as("morador-a-unit1").doc(PKG).update({ status: "RETIRADA" }));
});

test("13. MORADOR cannot DELETE", async () => {
  await assertFails(as("morador-a-unit1").doc(PKG).delete());
});

// ───────────── ADMIN / SINDICO / SUPER_ADMIN: writes ─────────────

test("18-19-20. ADMIN client SDK cannot directly CREATE, UPDATE, or DELETE", async () => {
  await assertFails(
    as("admin-a").doc(`condominios/${CONDO_A}/encomendas/new-pkg-4`).set({ condominioId: CONDO_A, status: "AGUARDANDO" }),
  );
  await assertFails(as("admin-a").doc(PKG).update({ status: "RETIRADA" }));
  await assertFails(as("admin-a").doc(PKG).delete());
});

test("21. SINDICO client SDK cannot directly mutate", async () => {
  await assertFails(
    as("sindico-a").doc(`condominios/${CONDO_A}/encomendas/new-pkg-5`).set({ condominioId: CONDO_A, status: "AGUARDANDO" }),
  );
  await assertFails(as("sindico-a").doc(PKG).update({ status: "RETIRADA" }));
  await assertFails(as("sindico-a").doc(PKG).delete());
});

test("22. SUPER_ADMIN client SDK cannot directly mutate through Firestore rules", async () => {
  // Admin SDK (server-side) bypasses these rules entirely and remains the
  // real mutation path for super-admin-triggered operations; only the
  // *client* SDK path is being asserted here.
  await assertFails(
    asSuper("super-1").doc(`condominios/${CONDO_A}/encomendas/new-pkg-6`).set({ condominioId: CONDO_A, status: "AGUARDANDO" }),
  );
  await assertFails(asSuper("super-1").doc(PKG).update({ status: "RETIRADA" }));
  await assertFails(asSuper("super-1").doc(PKG).delete());
});

// ───────────── nested custody/audit collections stay protected ─────────────

test("23. Client cannot create/update/delete event records (any role, including admin)", async () => {
  const evt = `${PKG}/events/evt-new`;
  await assertFails(as("porteiro-a").doc(evt).set({ type: "WITHDRAWN" }));
  await assertFails(as("admin-a").doc(`${PKG}/events/evt-1`).update({ type: "TAMPERED" }));
  await assertFails(as("admin-a").doc(`${PKG}/events/evt-1`).delete());
  await assertFails(as("porteiro-a").doc(`${PKG}/events/evt-1`).get());
});

test("24. Client cannot tamper with batch/lote protected data (any role, including admin)", async () => {
  const lote = `condominios/${CONDO_A}/retiradas_lote/lote-1`;
  await assertFails(as("porteiro-a").doc(lote).get());
  await assertFails(as("morador-a-unit1").doc(lote).update({ status: "UTILIZADO" }));
  await assertFails(as("admin-a").doc(lote).delete());
  await assertFails(
    as("porteiro-a").doc(`condominios/${CONDO_A}/retiradas_lote/lote-new`).set({ unidadeId: "unit-1", status: "PENDENTE" }),
  );
});
