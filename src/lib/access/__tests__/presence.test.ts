import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasUnconfirmedPhysicalExit,
  isAutoClosedWithoutConfirmedExit,
  countsAsPhysicallyPresent,
  applyConfirmedExit,
} from "../presence";
import type { AccessStay } from "../types";

function baseStay(overrides: Partial<AccessStay> = {}): AccessStay {
  return {
    id: "auth-1",
    condominioId: "condo-a",
    unitId: "unit-1",
    blocoId: null,
    authorizationId: "auth-1",
    enteredAt: new Date("2026-08-29T14:37:00Z"),
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
    createdAt: new Date("2026-08-29T14:37:00Z"),
    updatedAt: new Date("2026-08-29T14:37:00Z"),
    ...overrides,
  };
}

test("AUTO_CLOSED with no exit confirmation is a VALID state and still counts as unconfirmed physical exit", () => {
  const stay = baseStay({ workflowState: "AUTO_CLOSED", autoClosedAt: new Date("2026-08-29T20:00:00Z"), autoCloseReason: "TIMEOUT" });
  assert.equal(hasUnconfirmedPhysicalExit(stay), true);
  assert.equal(isAutoClosedWithoutConfirmedExit(stay), true);
  assert.equal(countsAsPhysicallyPresent(stay), true, "AUTO_CLOSED alone must never make the occupancy count lie about presence");
});

test("ACTIVE stay with no exit confirmation counts as physically present but is NOT the auto-closed-pending case", () => {
  const stay = baseStay();
  assert.equal(hasUnconfirmedPhysicalExit(stay), true);
  assert.equal(isAutoClosedWithoutConfirmedExit(stay), false);
});

test("EXIT_CONFIRMED stay never counts as physically present, regardless of workflowState", () => {
  const stay = baseStay({
    physicalPresenceState: "EXIT_CONFIRMED",
    exitConfirmedAt: new Date("2026-08-29T20:15:00Z"),
    workflowState: "AUTO_CLOSED",
    autoClosedAt: new Date("2026-08-29T20:00:00Z"),
  });
  assert.equal(hasUnconfirmedPhysicalExit(stay), false);
  assert.equal(countsAsPhysicallyPresent(stay), false);
});

test("Late real exit: applyConfirmedExit sets CLOSED/EXIT_CONFIRMED and preserves autoClosedAt (three facts coexist)", () => {
  const stay = baseStay({
    workflowState: "AUTO_CLOSED",
    autoClosedAt: new Date("2026-08-29T20:00:00Z"),
    autoCloseReason: "TIMEOUT",
  });
  const patch = applyConfirmedExit(stay, {
    exitConfirmedAt: new Date("2026-08-29T20:15:00Z"),
    exitConfirmedByUid: "porteiro-2",
    exitCredentialMethod: "PIN",
  });
  assert.equal(patch.physicalPresenceState, "EXIT_CONFIRMED");
  assert.equal(patch.workflowState, "CLOSED");
  assert.equal(patch.exitConfirmedAt!.toISOString(), "2026-08-29T20:15:00.000Z");

  const merged = { ...stay, ...patch };
  // autoClosedAt/autoCloseReason must survive unchanged — never overwritten by a later real exit.
  assert.equal(merged.autoClosedAt!.toISOString(), "2026-08-29T20:00:00.000Z");
  assert.equal(merged.autoCloseReason, "TIMEOUT");
  assert.equal(merged.enteredAt.toISOString(), "2026-08-29T14:37:00.000Z");
});

test("applyConfirmedExit works from ACTIVE too (ordinary, non-late exit)", () => {
  const stay = baseStay();
  const patch = applyConfirmedExit(stay, {
    exitConfirmedAt: new Date("2026-08-29T15:00:00Z"),
    exitConfirmedByUid: "porteiro-1",
    exitCredentialMethod: "QR",
  });
  assert.equal(patch.workflowState, "CLOSED");
  assert.equal(patch.physicalPresenceState, "EXIT_CONFIRMED");
});
