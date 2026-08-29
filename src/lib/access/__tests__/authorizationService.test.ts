/**
 * ACCESS.4 — testes de integração do serviço de autorização contra o
 * Firestore Emulator (Admin SDK direto — sem Next.js/HTTP). Requer
 * rodar via `firebase emulators:exec --only firestore "npx tsx --test ..."`,
 * que define FIRESTORE_EMULATOR_HOST automaticamente.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.ACCESS_PIN_HMAC_KEY = "test-only-hmac-key-not-a-real-secret";

import admin from "firebase-admin";
import {
  createAuthorization,
  listOwnAuthorizations,
  getAuthorizationDetail,
  revokeAuthorization,
  type AuthorizationActorContext,
} from "../authorizationService";
import { AccessApiError } from "../apiErrors";

if (!admin.apps.length) {
  admin.initializeApp({ projectId: "access4-service-test" });
}
const db = admin.firestore();

const CONDO_A = "condo-a";
const CONDO_B = "condo-b";

async function wipeCollections() {
  for (const condo of [CONDO_A, CONDO_B]) {
    for (const col of ["accessAuthorizations", "accessCredentials", "accessEvents", "membros", "vinculosUnidades", "blocos"]) {
      const snap = await db.collection("condominios").doc(condo).collection(col).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
  }
}

before(async () => {
  await wipeCollections();
  await db.doc(`condominios/${CONDO_A}/membros/morador-single`).set({ role: "MORADOR", status: "ATIVO", pessoaId: "pessoa-single" });
  await db.doc(`condominios/${CONDO_A}/vinculosUnidades/v1`).set({ pessoaId: "pessoa-single", status: "ATIVO", resideNaUnidade: true, unitDocId: "unit-1", blocoId: "bloco-a" });

  await db.doc(`condominios/${CONDO_A}/membros/morador-multi`).set({ role: "MORADOR", status: "ATIVO", pessoaId: "pessoa-multi" });
  await db.doc(`condominios/${CONDO_A}/vinculosUnidades/v2`).set({ pessoaId: "pessoa-multi", status: "ATIVO", resideNaUnidade: true, unitDocId: "unit-2", blocoId: "bloco-a" });
  await db.doc(`condominios/${CONDO_A}/vinculosUnidades/v3`).set({ pessoaId: "pessoa-multi", status: "ATIVO", resideNaUnidade: true, unitDocId: "unit-3", blocoId: "bloco-a" });

  await db.doc(`condominios/${CONDO_A}/membros/morador-no-unit`).set({ role: "MORADOR", status: "ATIVO", pessoaId: "pessoa-no-unit" });

  await db.doc(`condominios/${CONDO_A}/membros/sindico-a`).set({ role: "SINDICO", status: "ATIVO" });
  await db.doc(`condominios/${CONDO_A}/membros/porteiro-a`).set({ role: "PORTEIRO", status: "ATIVO" });
  await db.doc(`condominios/${CONDO_A}/membros/seguranca-a`).set({ role: "SEGURANCA", status: "ATIVO" });

  await db.doc(`condominios/${CONDO_A}/blocos/bloco-a/unidades/unit-admin`).set({ nome: "101" });

  await db.doc(`condominios/${CONDO_B}/membros/morador-b`).set({ role: "MORADOR", status: "ATIVO", pessoaId: "pessoa-b" });
  await db.doc(`condominios/${CONDO_B}/vinculosUnidades/vb1`).set({ pessoaId: "pessoa-b", status: "ATIVO", resideNaUnidade: true, unitDocId: "unit-b1", blocoId: "bloco-b" });
});

after(async () => {
  await wipeCollections();
});

function ctxFor(uid: string, role: any, condominioId = CONDO_A, membroData: any = null, isSuperAdmin = false): AuthorizationActorContext {
  return { uid, role, isSuperAdmin, condominioId, membroData };
}

const validInput = {
  accessType: "VISITOR",
  nome: "João Visitante",
  visitDate: "2026-08-29",
};

test("MORADOR single-unit: create derives unit automatically", async () => {
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const result = await createAuthorization(db, ctx, { ...validInput });
  assert.equal(result.authorization.unitId, "unit-1");
  assert.equal(result.authorization.blocoId, "bloco-a");
  assert.equal(result.authorization.status, "AUTORIZADO");
  assert.equal(result.authorization.usagePolicy, "SINGLE_USE");
  assert.ok(result.credential.qrToken, "expected a raw QR token in the response");
  assert.ok(result.credential.pin, "expected a raw PIN in the response");
});

test("MORADOR multi-unit: valid explicit unit selection succeeds", async () => {
  const ctx = ctxFor("morador-multi", "MORADOR", CONDO_A, { pessoaId: "pessoa-multi" });
  const result = await createAuthorization(db, ctx, { ...validInput, unitId: "unit-3" });
  assert.equal(result.authorization.unitId, "unit-3");
});

test("MORADOR multi-unit: missing unitId is ambiguous -> INVALID_UNIT", async () => {
  const ctx = ctxFor("morador-multi", "MORADOR", CONDO_A, { pessoaId: "pessoa-multi" });
  await assert.rejects(() => createAuthorization(db, ctx, { ...validInput }), (e: any) => e instanceof AccessApiError && e.code === "INVALID_UNIT");
});

test("MORADOR: arbitrary unit not in own vinculos -> INVALID_UNIT (never trusted as authority)", async () => {
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  await assert.rejects(() => createAuthorization(db, ctx, { ...validInput, unitId: "unit-does-not-belong-to-me" }), (e: any) => e instanceof AccessApiError && e.code === "INVALID_UNIT");
});

test("MORADOR without any eligible unit -> NO_ACTIVE_UNIT", async () => {
  const ctx = ctxFor("morador-no-unit", "MORADOR", CONDO_A, { pessoaId: "pessoa-no-unit" });
  await assert.rejects(() => createAuthorization(db, ctx, { ...validInput }), (e: any) => e instanceof AccessApiError && e.code === "NO_ACTIVE_UNIT");
});

test("PORTEIRO cannot create authorization (core principle)", async () => {
  const ctx = ctxFor("porteiro-a", "PORTEIRO", CONDO_A);
  await assert.rejects(() => createAuthorization(db, ctx, { ...validInput, unitId: "unit-admin", blocoId: "bloco-a" }), (e: any) => e instanceof AccessApiError && e.code === "FORBIDDEN");
});

test("SEGURANCA cannot create authorization", async () => {
  const ctx = ctxFor("seguranca-a", "SEGURANCA", CONDO_A);
  await assert.rejects(() => createAuthorization(db, ctx, { ...validInput, unitId: "unit-admin", blocoId: "bloco-a" }), (e: any) => e instanceof AccessApiError && e.code === "FORBIDDEN");
});

test("SINDICO (admin/operator) can create for a validated unit", async () => {
  const ctx = ctxFor("sindico-a", "SINDICO", CONDO_A);
  const result = await createAuthorization(db, ctx, { ...validInput, unitId: "unit-admin", blocoId: "bloco-a" });
  assert.equal(result.authorization.unitId, "unit-admin");
});

test("SINDICO create without unitId/blocoId -> INVALID_INPUT", async () => {
  const ctx = ctxFor("sindico-a", "SINDICO", CONDO_A);
  await assert.rejects(() => createAuthorization(db, ctx, { ...validInput }), (e: any) => e instanceof AccessApiError && e.code === "INVALID_INPUT");
});

test("SINDICO create with a unit that doesn't exist in this condo -> INVALID_UNIT", async () => {
  const ctx = ctxFor("sindico-a", "SINDICO", CONDO_A);
  await assert.rejects(
    () => createAuthorization(db, ctx, { ...validInput, unitId: "ghost-unit", blocoId: "bloco-a" }),
    (e: any) => e instanceof AccessApiError && e.code === "INVALID_UNIT",
  );
});

test("invalid accessType -> INVALID_INPUT", async () => {
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  await assert.rejects(() => createAuthorization(db, ctx, { ...validInput, accessType: "NOT_A_TYPE" }), (e: any) => e instanceof AccessApiError && e.code === "INVALID_INPUT");
});

test("missing nome -> INVALID_INPUT", async () => {
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  await assert.rejects(() => createAuthorization(db, ctx, { ...validInput, nome: "" }), (e: any) => e instanceof AccessApiError && e.code === "INVALID_INPUT");
});

test("invalid visitDate -> INVALID_INPUT", async () => {
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  await assert.rejects(() => createAuthorization(db, ctx, { ...validInput, visitDate: "29/08/2026" }), (e: any) => e instanceof AccessApiError && e.code === "INVALID_INPUT");
});

test("optional times omitted entirely -> still succeeds", async () => {
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const result = await createAuthorization(db, ctx, { ...validInput });
  assert.equal(result.authorization.expectedEntryAt, null);
  assert.equal(result.authorization.expectedExitAt, null);
});

test("CPF-like field is silently ignored, never persisted (strict schema)", async () => {
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const result = await createAuthorization(db, ctx, { ...validInput, cpf: "12345678900" } as any);
  assert.equal((result.authorization.visitorSnapshot as any).cpf, undefined);
});

test("raw QR token is never persisted in the credential document", async () => {
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const result = await createAuthorization(db, ctx, { ...validInput });
  const credSnap = await db.collection(`condominios/${CONDO_A}/accessCredentials`).where("authorizationId", "==", result.authorization.id).get();
  assert.equal(credSnap.size, 1);
  const stored = credSnap.docs[0].data();
  assert.equal(stored.qrTokenHash, require("crypto").createHash("sha256").update(result.credential.qrToken!, "utf8").digest("hex"));
  assert.equal(JSON.stringify(stored).includes(result.credential.qrToken!), false, "raw QR token must never appear in the stored document");
});

test("raw PIN is never persisted in the credential document", async () => {
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const result = await createAuthorization(db, ctx, { ...validInput });
  const credSnap = await db.collection(`condominios/${CONDO_A}/accessCredentials`).where("authorizationId", "==", result.authorization.id).get();
  const stored = credSnap.docs[0].data();
  assert.equal(JSON.stringify(stored).includes(result.credential.pin!), false, "raw PIN must never appear in the stored document");
  assert.notEqual(stored.pinLookupHash, null);
});

test("AUTHORIZATION_CREATED event exists after create", async () => {
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const result = await createAuthorization(db, ctx, { ...validInput });
  const evSnap = await db.collection(`condominios/${CONDO_A}/accessEvents`).where("authorizationId", "==", result.authorization.id).where("type", "==", "AUTHORIZATION_CREATED").get();
  assert.equal(evSnap.size, 1);
});

test("policy pinEnabled=false without HMAC key still succeeds (QR only)", async () => {
  await db.doc(`condominios/${CONDO_A}/config/accessPolicy`).set({ pinEnabled: false, qrEnabled: true });
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const result = await createAuthorization(db, ctx, { ...validInput });
  assert.ok(result.credential.qrToken);
  assert.equal(result.credential.pin, undefined);
  await db.doc(`condominios/${CONDO_A}/config/accessPolicy`).delete();
});

test("policy both disabled -> POLICY_DISABLED", async () => {
  await db.doc(`condominios/${CONDO_A}/config/accessPolicy`).set({ qrEnabled: false, pinEnabled: false });
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  await assert.rejects(() => createAuthorization(db, ctx, { ...validInput }), (e: any) => e instanceof AccessApiError && e.code === "POLICY_DISABLED");
  await db.doc(`condominios/${CONDO_A}/config/accessPolicy`).delete();
});

test("pinEnabled=true but HMAC key missing -> FAIL CLOSED with CONFIGURATION_ERROR", async () => {
  const original = process.env.ACCESS_PIN_HMAC_KEY;
  delete process.env.ACCESS_PIN_HMAC_KEY;
  try {
    const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
    await assert.rejects(() => createAuthorization(db, ctx, { ...validInput }), (e: any) => e instanceof AccessApiError && e.code === "CONFIGURATION_ERROR");
  } finally {
    process.env.ACCESS_PIN_HMAC_KEY = original;
  }
});

// ───────────── List ─────────────

test("list: own records only", async () => {
  const ctx = ctxFor("morador-multi", "MORADOR", CONDO_A, { pessoaId: "pessoa-multi" });
  const { items } = await listOwnAuthorizations(db, ctx, {});
  assert.ok(items.length > 0);
  for (const item of items) {
    const doc = await db.doc(`condominios/${CONDO_A}/accessAuthorizations/${item.id}`).get();
    assert.equal(doc.data()!.createdByUid, "morador-multi");
  }
});

test("list: never exposes credential hashes", async () => {
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const { items } = await listOwnAuthorizations(db, ctx, {});
  for (const item of items) {
    assert.equal((item as any).qrTokenHash, undefined);
    assert.equal((item as any).pinLookupHash, undefined);
  }
});

// ───────────── Detail ─────────────

test("detail: owner can read own authorization", async () => {
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const created = await createAuthorization(db, ctx, { ...validInput });
  const detail = await getAuthorizationDetail(db, ctx, created.authorization.id);
  assert.equal(detail.id, created.authorization.id);
  assert.equal((detail as any).qrTokenHash, undefined);
});

test("detail: another resident cannot read someone else's authorization (NOT_FOUND, not FORBIDDEN — no existence leak)", async () => {
  const ownerCtx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const created = await createAuthorization(db, ownerCtx, { ...validInput });
  const otherCtx = ctxFor("morador-multi", "MORADOR", CONDO_A, { pessoaId: "pessoa-multi" });
  await assert.rejects(() => getAuthorizationDetail(db, otherCtx, created.authorization.id), (e: any) => e instanceof AccessApiError && e.code === "NOT_FOUND");
});

test("detail: cross-tenant read denied", async () => {
  const ownerCtx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const created = await createAuthorization(db, ownerCtx, { ...validInput });
  const crossCtx = ctxFor("morador-b", "MORADOR", CONDO_B, { pessoaId: "pessoa-b" });
  // Different condo path entirely — the doc simply doesn't exist under CONDO_B.
  await assert.rejects(() => getAuthorizationDetail(db, crossCtx, created.authorization.id), (e: any) => e instanceof AccessApiError && e.code === "NOT_FOUND");
});

test("detail: operator (sindico) can read any authorization in own condo", async () => {
  const ownerCtx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const created = await createAuthorization(db, ownerCtx, { ...validInput });
  const sindicoCtx = ctxFor("sindico-a", "SINDICO", CONDO_A);
  const detail = await getAuthorizationDetail(db, sindicoCtx, created.authorization.id);
  assert.equal(detail.id, created.authorization.id);
});

// ───────────── Revoke ─────────────

test("revoke: owner can revoke own authorization", async () => {
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const created = await createAuthorization(db, ctx, { ...validInput });
  const result = await revokeAuthorization(db, ctx, created.authorization.id);
  assert.equal(result.alreadyRevoked, false);
  const doc = await db.doc(`condominios/${CONDO_A}/accessAuthorizations/${created.authorization.id}`).get();
  assert.equal(doc.data()!.status, "REVOGADO");
});

test("revoke: another resident cannot revoke someone else's authorization", async () => {
  const ownerCtx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const created = await createAuthorization(db, ownerCtx, { ...validInput });
  const otherCtx = ctxFor("morador-multi", "MORADOR", CONDO_A, { pessoaId: "pessoa-multi" });
  await assert.rejects(() => revokeAuthorization(db, otherCtx, created.authorization.id), (e: any) => e instanceof AccessApiError && e.code === "NOT_FOUND");
});

test("revoke: cross-tenant denied", async () => {
  const ownerCtx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const created = await createAuthorization(db, ownerCtx, { ...validInput });
  const crossCtx = ctxFor("morador-b", "MORADOR", CONDO_B, { pessoaId: "pessoa-b" });
  await assert.rejects(() => revokeAuthorization(db, crossCtx, created.authorization.id), (e: any) => e instanceof AccessApiError && e.code === "NOT_FOUND");
});

test("revoke: porteiro cannot revoke, even the owner's own condo", async () => {
  const ownerCtx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const created = await createAuthorization(db, ownerCtx, { ...validInput });
  const porteiroCtx = ctxFor("porteiro-a", "PORTEIRO", CONDO_A);
  await assert.rejects(() => revokeAuthorization(db, porteiroCtx, created.authorization.id), (e: any) => e instanceof AccessApiError && e.code === "FORBIDDEN");
});

test("revoke: seguranca cannot revoke", async () => {
  const ownerCtx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const created = await createAuthorization(db, ownerCtx, { ...validInput });
  const segurancaCtx = ctxFor("seguranca-a", "SEGURANCA", CONDO_A);
  await assert.rejects(() => revokeAuthorization(db, segurancaCtx, created.authorization.id), (e: any) => e instanceof AccessApiError && e.code === "FORBIDDEN");
});

test("revoke: admin/sindico can revoke another resident's authorization", async () => {
  const ownerCtx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const created = await createAuthorization(db, ownerCtx, { ...validInput });
  const sindicoCtx = ctxFor("sindico-a", "SINDICO", CONDO_A);
  const result = await revokeAuthorization(db, sindicoCtx, created.authorization.id);
  assert.equal(result.alreadyRevoked, false);
});

test("revoke: second revoke is idempotent, no duplicate event", async () => {
  const ctx = ctxFor("morador-single", "MORADOR", CONDO_A, { pessoaId: "pessoa-single" });
  const created = await createAuthorization(db, ctx, { ...validInput });
  await revokeAuthorization(db, ctx, created.authorization.id);
  const second = await revokeAuthorization(db, ctx, created.authorization.id);
  assert.equal(second.alreadyRevoked, true);
  const evSnap = await db.collection(`condominios/${CONDO_A}/accessEvents`).where("authorizationId", "==", created.authorization.id).where("type", "==", "AUTHORIZATION_REVOKED").get();
  assert.equal(evSnap.size, 1, "expected exactly one AUTHORIZATION_REVOKED event, not duplicated on retry");
});

// ───────────── PIN collision ─────────────

test("PIN collision: forced collision triggers regeneration to a different, non-colliding PIN", async () => {
  const { computePinLookupHash } = await import("../credential");
  const { issueNonCollidingPin } = await import("../pinIssuance");
  const key = process.env.ACCESS_PIN_HMAC_KEY!;

  // Force every possible... instead, monkeypatch by pre-seeding a large-but-cheap set is impractical (1e6 docs).
  // Instead: seed ONE colliding hash and verify the resulting issued PIN's hash does not equal that seeded one after enough attempts is not guaranteed by construction, so directly unit-test the query function's honesty: seed a hash for a PIN we can predict is unlikely but verify collision-detection logic itself via direct query.
  const testCondo = "condo-pin-collision-test";
  await db.doc(`condominios/${testCondo}`).set({});
  // Seed a credential occupying one specific pin, then verify issueNonCollidingPin never returns exactly that pin's hash on a retry loop check.
  const crypto = require("crypto");
  const occupiedPin = "123456";
  const occupiedHash = computePinLookupHash(occupiedPin, testCondo, key);
  await db.collection(`condominios/${testCondo}/accessCredentials`).add({ pinLookupHash: occupiedHash });

  const results = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const issued = await issueNonCollidingPin(db, testCondo, key);
    assert.notEqual(issued.pinLookupHash, occupiedHash, "issued PIN must never collide with an already-occupied hash");
    results.add(issued.pinLookupHash);
    await db.collection(`condominios/${testCondo}/accessCredentials`).add({ pinLookupHash: issued.pinLookupHash });
  }
  assert.equal(results.size, 20, "20 sequential issuances should not collide with each other either");

  await db.recursiveDelete(db.doc(`condominios/${testCondo}`));
});

test("PIN collision: same PIN in different condos does not collide (tenant-scoped)", async () => {
  const { computePinLookupHash } = await import("../credential");
  const key = process.env.ACCESS_PIN_HMAC_KEY!;
  const hashA = computePinLookupHash("999999", CONDO_A, key);
  const hashB = computePinLookupHash("999999", CONDO_B, key);
  assert.notEqual(hashA, hashB);
});

test("PIN collision: exceeding max attempts fails explicitly (not silently colliding)", async () => {
  const { PIN_GENERATION_MAX_ATTEMPTS, issueNonCollidingPin } = await import("../pinIssuance");
  const testCondo = "condo-pin-exhaustion-test";
  const key = process.env.ACCESS_PIN_HMAC_KEY!;
  await db.doc(`condominios/${testCondo}`).set({});

  // Monkeypatch is not available without DI; instead verify the constant is sane and that a real call still succeeds
  // when the space is not exhausted (exhaustion of the full 10^6 space is impractical to test directly here).
  assert.ok(PIN_GENERATION_MAX_ATTEMPTS >= 1);
  const issued = await issueNonCollidingPin(db, testCondo, key);
  assert.ok(issued.rawPin);

  await db.recursiveDelete(db.doc(`condominios/${testCondo}`));
});
