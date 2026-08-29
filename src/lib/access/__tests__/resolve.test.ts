import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAccessAction } from "../resolve";
import type { AccessAuthorization, AccessStay } from "../types";

const NOW = new Date("2026-08-29T12:00:00Z");

function baseAuth(overrides: Partial<AccessAuthorization> = {}): AccessAuthorization {
  return {
    id: "auth-1",
    condominioId: "condo-a",
    unitId: "unit-1",
    blocoId: null,
    createdByUid: "morador-1",
    accessType: "VISITOR",
    visitorSnapshot: { nome: "Fixture" },
    visitDate: "2026-08-29",
    expectedEntryAt: null,
    expectedExitAt: null,
    newEntryValidFrom: new Date("2026-08-29T03:00:00Z"),
    newEntryValidUntil: new Date("2026-08-30T02:59:59Z"),
    usagePolicy: "SINGLE_USE",
    status: "AUTORIZADO",
    createdAt: NOW,
    updatedAt: NOW,
    revokedAt: null,
    revokedByUid: null,
    revocationReason: null,
    ...overrides,
  };
}

function baseStay(overrides: Partial<AccessStay> = {}): AccessStay {
  return {
    id: "auth-1",
    condominioId: "condo-a",
    unitId: "unit-1",
    blocoId: null,
    authorizationId: "auth-1",
    enteredAt: new Date("2026-08-29T10:00:00Z"),
    enteredByUid: "porteiro-1",
    entryCredentialMethod: "QR",
    physicalPresenceState: "INSIDE",
    workflowState: "ACTIVE",
    exitConfirmedAt: null,
    exitConfirmedByUid: null,
    exitCredentialMethod: null,
    autoClosedAt: null,
    autoCloseReason: null,
    visitorSnapshot: { nome: "Fixture" },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

test("valid authorization + no stay -> OFFER_ENTRY", () => {
  const r = resolveAccessAction({ authorization: baseAuth(), openStay: null, hasAnyPriorStay: false, now: NOW });
  assert.equal(r.action, "OFFER_ENTRY");
});

test("open stay -> OFFER_EXIT", () => {
  const r = resolveAccessAction({ authorization: baseAuth(), openStay: baseStay(), hasAnyPriorStay: true, now: NOW });
  assert.equal(r.action, "OFFER_EXIT");
});

test("expired + no stay -> DENY EXPIRED", () => {
  const auth = baseAuth({ newEntryValidUntil: new Date("2026-08-28T02:59:59Z") });
  const r = resolveAccessAction({ authorization: auth, openStay: null, hasAnyPriorStay: false, now: NOW });
  assert.equal(r.action, "DENY");
  assert.equal((r as any).reason, "EXPIRED");
});

test("expired + open stay -> OFFER_EXIT (invariant #4: exit always possible while stay is open)", () => {
  const auth = baseAuth({ newEntryValidUntil: new Date("2026-08-28T02:59:59Z") });
  const r = resolveAccessAction({ authorization: auth, openStay: baseStay(), hasAnyPriorStay: true, now: NOW });
  assert.equal(r.action, "OFFER_EXIT");
});

test("revoked + no stay -> DENY REVOKED", () => {
  const auth = baseAuth({ status: "REVOGADO", revokedAt: NOW, revokedByUid: "morador-1" });
  const r = resolveAccessAction({ authorization: auth, openStay: null, hasAnyPriorStay: false, now: NOW });
  assert.equal(r.action, "DENY");
  assert.equal((r as any).reason, "REVOKED");
});

test("revoked + open stay -> OFFER_EXIT (invariant #4/#13: revocation while inside never blocks exit)", () => {
  const auth = baseAuth({ status: "REVOGADO", revokedAt: NOW, revokedByUid: "morador-1" });
  const r = resolveAccessAction({ authorization: auth, openStay: baseStay(), hasAnyPriorStay: true, now: NOW });
  assert.equal(r.action, "OFFER_EXIT");
});

test("closed SINGLE_USE stay (already used) -> DENY ALREADY_USED", () => {
  const r = resolveAccessAction({ authorization: baseAuth(), openStay: null, hasAnyPriorStay: true, now: NOW });
  assert.equal(r.action, "DENY");
  assert.equal((r as any).reason, "ALREADY_USED");
});

test("authorization not found -> DENY NOT_FOUND", () => {
  const r = resolveAccessAction({ authorization: null, openStay: null, hasAnyPriorStay: false, now: NOW });
  assert.equal(r.action, "DENY");
  assert.equal((r as any).reason, "NOT_FOUND");
});

test("not yet within entry window (visit is in the future) -> DENY EXPIRED (outside window)", () => {
  const auth = baseAuth({
    newEntryValidFrom: new Date("2026-08-30T03:00:00Z"),
    newEntryValidUntil: new Date("2026-08-31T02:59:59Z"),
  });
  const r = resolveAccessAction({ authorization: auth, openStay: null, hasAnyPriorStay: false, now: NOW });
  assert.equal(r.action, "DENY");
  assert.equal((r as any).reason, "EXPIRED");
});
