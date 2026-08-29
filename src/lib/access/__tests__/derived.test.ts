import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveAuthorizationStatus, deriveWorkflowState, isPastAutoCloseThreshold } from "../derived";

test("deriveAuthorizationStatus: REVOGADO wins even if window is still valid", () => {
  const status = deriveAuthorizationStatus(
    { status: "REVOGADO", newEntryValidUntil: new Date("2099-01-01T00:00:00Z") },
    new Date("2026-01-01T00:00:00Z"),
  );
  assert.equal(status, "REVOGADO");
});

test("deriveAuthorizationStatus: EXPIRADO when now is past newEntryValidUntil", () => {
  const status = deriveAuthorizationStatus(
    { status: "AUTORIZADO", newEntryValidUntil: new Date("2026-01-01T00:00:00Z") },
    new Date("2026-01-02T00:00:00Z"),
  );
  assert.equal(status, "EXPIRADO");
});

test("deriveAuthorizationStatus: AUTORIZADO within window", () => {
  const status = deriveAuthorizationStatus(
    { status: "AUTORIZADO", newEntryValidUntil: new Date("2026-01-02T00:00:00Z") },
    new Date("2026-01-01T00:00:00Z"),
  );
  assert.equal(status, "AUTORIZADO");
});

test("deriveWorkflowState: ACTIVE before overdue threshold", () => {
  const state = deriveWorkflowState(
    { workflowState: "ACTIVE", enteredAt: new Date("2026-08-29T14:00:00Z") },
    60,
    new Date("2026-08-29T14:30:00Z"),
  );
  assert.equal(state, "ACTIVE");
});

test("deriveWorkflowState: EXIT_OVERDUE after threshold", () => {
  const state = deriveWorkflowState(
    { workflowState: "ACTIVE", enteredAt: new Date("2026-08-29T14:00:00Z") },
    60,
    new Date("2026-08-29T15:01:00Z"),
  );
  assert.equal(state, "EXIT_OVERDUE");
});

test("deriveWorkflowState: AUTO_CLOSED/CLOSED pass through unchanged, never re-derived", () => {
  assert.equal(
    deriveWorkflowState({ workflowState: "AUTO_CLOSED", enteredAt: new Date("2020-01-01T00:00:00Z") }, 60, new Date()),
    "AUTO_CLOSED",
  );
  assert.equal(
    deriveWorkflowState({ workflowState: "CLOSED", enteredAt: new Date("2020-01-01T00:00:00Z") }, 60, new Date()),
    "CLOSED",
  );
});

test("isPastAutoCloseThreshold: false before threshold, true after", () => {
  const enteredAt = new Date("2026-08-29T14:00:00Z");
  assert.equal(isPastAutoCloseThreshold({ workflowState: "ACTIVE", enteredAt }, 240, new Date("2026-08-29T17:30:00Z")), false);
  assert.equal(isPastAutoCloseThreshold({ workflowState: "ACTIVE", enteredAt }, 240, new Date("2026-08-29T18:01:00Z")), true);
});

test("isPastAutoCloseThreshold: never true for non-ACTIVE stays", () => {
  const enteredAt = new Date("2020-01-01T00:00:00Z");
  assert.equal(isPastAutoCloseThreshold({ workflowState: "AUTO_CLOSED", enteredAt }, 240, new Date()), false);
  assert.equal(isPastAutoCloseThreshold({ workflowState: "CLOSED", enteredAt }, 240, new Date()), false);
});
