import { test } from "node:test";
import assert from "node:assert/strict";
import { formatVisitDate, formatTimeOfDay, toIsoOrNull } from "../uiFormat";

test("formatVisitDate: converts YYYY-MM-DD to DD/MM/YYYY", () => {
  assert.equal(formatVisitDate("2026-08-29"), "29/08/2026");
});

test("formatVisitDate: returns input unchanged if malformed", () => {
  assert.equal(formatVisitDate("not-a-date"), "not-a-date");
});

test("formatTimeOfDay: returns null for null input", () => {
  assert.equal(formatTimeOfDay(null), null);
});

test("formatTimeOfDay: returns null for invalid ISO string", () => {
  assert.equal(formatTimeOfDay("not-a-date"), null);
});

test("formatTimeOfDay: formats a valid ISO instant as HH:mm", () => {
  const result = formatTimeOfDay("2026-08-29T14:30:00.000Z");
  assert.match(result!, /^\d{2}:\d{2}$/);
});

test("toIsoOrNull: returns null when date or time missing", () => {
  assert.equal(toIsoOrNull("", "14:00"), null);
  assert.equal(toIsoOrNull("2026-08-29", ""), null);
  assert.equal(toIsoOrNull("", ""), null);
});

test("toIsoOrNull: returns a valid ISO string when both present", () => {
  const result = toIsoOrNull("2026-08-29", "14:30");
  assert.notEqual(result, null);
  assert.doesNotThrow(() => new Date(result!).toISOString());
});
