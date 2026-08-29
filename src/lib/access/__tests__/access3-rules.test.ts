/**
 * ACCESS.3 — Firestore Rules tests for the four new domain collections.
 *
 * Foundation-only gate: no API exists yet, so these tests only prove
 * the Rules-level contract (server-authority, least-privilege reads,
 * tenant isolation) — not full domain behavior (that requires ACCESS.4+
 * transactional APIs and will get its own test suite there).
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
    projectId: "access3-rules-test",
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8") },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const membro = (condoId: string, uid: string, role: string) =>
      db.doc(`condominios/${condoId}/membros/${uid}`).set({ role, status: "ATIVO" });

    await membro(CONDO_A, "morador-a1", "MORADOR");
    await membro(CONDO_A, "morador-a2", "MORADOR");
    await membro(CONDO_A, "porteiro-a", "PORTEIRO");
    await membro(CONDO_A, "sindico-a", "SINDICO");
    await membro(CONDO_B, "morador-b1", "MORADOR");

    await db.doc(`condominios/${CONDO_A}/accessAuthorizations/auth-1`).set({
      createdByUid: "morador-a1",
      unitId: "unit-1",
      status: "AUTORIZADO",
    });
    await db.doc(`condominios/${CONDO_A}/accessCredentials/cred-1`).set({
      authorizationId: "auth-1",
      qrTokenHash: "fixture-hash",
    });
    await db.doc(`condominios/${CONDO_A}/accessStays/auth-1`).set({
      authorizationId: "auth-1",
      physicalPresenceState: "INSIDE",
    });
    await db.doc(`condominios/${CONDO_A}/accessEvents/evt-1`).set({
      authorizationId: "auth-1",
      type: "AUTHORIZATION_CREATED",
    });
  });
});

after(async () => {
  await testEnv.cleanup();
});

function as(uid: string | null) {
  return uid ? testEnv.authenticatedContext(uid).firestore() : testEnv.unauthenticatedContext().firestore();
}

// ───────────── accessCredentials: deny everything for every client role ─────────────

test("accessCredentials: anonymous read DENY", async () => {
  await assertFails(as(null).doc(`condominios/${CONDO_A}/accessCredentials/cred-1`).get());
});
test("accessCredentials: morador read DENY", async () => {
  await assertFails(as("morador-a1").doc(`condominios/${CONDO_A}/accessCredentials/cred-1`).get());
});
test("accessCredentials: porteiro read DENY", async () => {
  await assertFails(as("porteiro-a").doc(`condominios/${CONDO_A}/accessCredentials/cred-1`).get());
});
test("accessCredentials: sindico/admin read DENY", async () => {
  await assertFails(as("sindico-a").doc(`condominios/${CONDO_A}/accessCredentials/cred-1`).get());
});
test("accessCredentials: all client writes DENY (morador)", async () => {
  await assertFails(as("morador-a1").doc(`condominios/${CONDO_A}/accessCredentials/new-cred`).set({ authorizationId: "auth-1" }));
});
test("accessCredentials: all client writes DENY (porteiro)", async () => {
  await assertFails(as("porteiro-a").doc(`condominios/${CONDO_A}/accessCredentials/cred-1`).update({ pinAttempts: 0 }));
});
test("accessCredentials: all client writes DENY (sindico/admin)", async () => {
  await assertFails(as("sindico-a").doc(`condominios/${CONDO_A}/accessCredentials/cred-1`).delete());
});

// ───────────── accessEvents: append-only, server-only ─────────────

test("accessEvents: client create DENY", async () => {
  await assertFails(as("morador-a1").doc(`condominios/${CONDO_A}/accessEvents/new-evt`).set({ type: "ENTRY_CONFIRMED" }));
});
test("accessEvents: client update DENY", async () => {
  await assertFails(as("sindico-a").doc(`condominios/${CONDO_A}/accessEvents/evt-1`).update({ type: "REVOKED" }));
});
test("accessEvents: client delete DENY", async () => {
  await assertFails(as("sindico-a").doc(`condominios/${CONDO_A}/accessEvents/evt-1`).delete());
});
test("accessEvents: cross-tenant read DENY", async () => {
  await assertFails(as("morador-b1").doc(`condominios/${CONDO_A}/accessEvents/evt-1`).get());
});
test("accessEvents: operador (sindico) read ALLOW", async () => {
  await assertSucceeds(as("sindico-a").doc(`condominios/${CONDO_A}/accessEvents/evt-1`).get());
});
test("accessEvents: morador direct read DENY (served via API in later gates)", async () => {
  await assertFails(as("morador-a1").doc(`condominios/${CONDO_A}/accessEvents/evt-1`).get());
});

// ───────────── accessAuthorizations ─────────────

test("accessAuthorizations: creator can read own", async () => {
  await assertSucceeds(as("morador-a1").doc(`condominios/${CONDO_A}/accessAuthorizations/auth-1`).get());
});
test("accessAuthorizations: another resident in same condo cannot read someone else's", async () => {
  await assertFails(as("morador-a2").doc(`condominios/${CONDO_A}/accessAuthorizations/auth-1`).get());
});
test("accessAuthorizations: cross-tenant read DENY", async () => {
  await assertFails(as("morador-b1").doc(`condominios/${CONDO_A}/accessAuthorizations/auth-1`).get());
});
test("accessAuthorizations: operador (sindico) can read any in own condo", async () => {
  await assertSucceeds(as("sindico-a").doc(`condominios/${CONDO_A}/accessAuthorizations/auth-1`).get());
});
test("accessAuthorizations: all client writes DENY, including the creator themself", async () => {
  await assertFails(
    as("morador-a1").doc(`condominios/${CONDO_A}/accessAuthorizations/auth-1`).update({ status: "REVOGADO" }),
  );
});
test("accessAuthorizations: porteiro cannot create an authorization (core principle — MORADOR AUTORIZA)", async () => {
  await assertFails(
    as("porteiro-a").doc(`condominios/${CONDO_A}/accessAuthorizations/self-issued`).set({
      createdByUid: "porteiro-a",
      unitId: "unit-1",
      status: "AUTORIZADO",
    }),
  );
});
test("accessAuthorizations: anonymous read DENY", async () => {
  await assertFails(as(null).doc(`condominios/${CONDO_A}/accessAuthorizations/auth-1`).get());
});

// ───────────── accessStays ─────────────

test("accessStays: morador (own or not) cannot read directly — served via API in this MVP phase", async () => {
  await assertFails(as("morador-a1").doc(`condominios/${CONDO_A}/accessStays/auth-1`).get());
});
test("accessStays: porteiro cannot read directly — resolve/occupancy served via API (ACCESS.6/7)", async () => {
  await assertFails(as("porteiro-a").doc(`condominios/${CONDO_A}/accessStays/auth-1`).get());
});
test("accessStays: operador (sindico) can read for oversight", async () => {
  await assertSucceeds(as("sindico-a").doc(`condominios/${CONDO_A}/accessStays/auth-1`).get());
});
test("accessStays: cross-tenant read DENY", async () => {
  await assertFails(as("morador-b1").doc(`condominios/${CONDO_A}/accessStays/auth-1`).get());
});
test("accessStays: all client writes DENY", async () => {
  await assertFails(as("porteiro-a").doc(`condominios/${CONDO_A}/accessStays/auth-1`).update({ physicalPresenceState: "EXIT_CONFIRMED" }));
});
test("accessStays: anonymous read/write DENY", async () => {
  await assertFails(as(null).doc(`condominios/${CONDO_A}/accessStays/auth-1`).get());
  await assertFails(as(null).doc(`condominios/${CONDO_A}/accessStays/forged`).set({ physicalPresenceState: "INSIDE" }));
});
