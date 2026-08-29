import { test } from "node:test";
import assert from "node:assert/strict";
import { getCondominioTimezone, computeVisitDateWindow, DEFAULT_ACCESS_TIMEZONE } from "../timezone";

test("getCondominioTimezone: uses explicit timezone when present", () => {
  assert.equal(getCondominioTimezone({ timezone: "America/New_York" }), "America/New_York");
});

test("getCondominioTimezone: falls back to America/Sao_Paulo when absent", () => {
  assert.equal(getCondominioTimezone({}), DEFAULT_ACCESS_TIMEZONE);
  assert.equal(getCondominioTimezone(null), DEFAULT_ACCESS_TIMEZONE);
  assert.equal(getCondominioTimezone({ timezone: null }), DEFAULT_ACCESS_TIMEZONE);
  assert.equal(getCondominioTimezone({ timezone: "" }), DEFAULT_ACCESS_TIMEZONE);
});

test("computeVisitDateWindow: full civil day in America/Sao_Paulo (UTC-3)", () => {
  const w = computeVisitDateWindow({ visitDate: "2026-08-29", timezone: "America/Sao_Paulo" });
  assert.ok(w);
  // 2026-08-29T00:00:00-03:00 == 2026-08-29T03:00:00Z
  assert.equal(w!.newEntryValidFrom.toISOString(), "2026-08-29T03:00:00.000Z");
  // 2026-08-29T23:59:59-03:00 == 2026-08-30T02:59:59Z
  assert.equal(w!.newEntryValidUntil.toISOString(), "2026-08-30T02:59:59.000Z");
});

test("computeVisitDateWindow: different timezone produces a different absolute window for the same civil date", () => {
  const spWindow = computeVisitDateWindow({ visitDate: "2026-08-29", timezone: "America/Sao_Paulo" });
  const nyWindow = computeVisitDateWindow({ visitDate: "2026-08-29", timezone: "America/New_York" });
  assert.ok(spWindow && nyWindow);
  assert.notEqual(spWindow!.newEntryValidFrom.toISOString(), nyWindow!.newEntryValidFrom.toISOString());
});

test("computeVisitDateWindow: expectedEntryAt does not alter the window (informational only, ACCESS.2 invariant #1)", () => {
  const withoutTime = computeVisitDateWindow({ visitDate: "2026-08-29", timezone: "America/Sao_Paulo" });
  const withTime = computeVisitDateWindow({
    visitDate: "2026-08-29",
    timezone: "America/Sao_Paulo",
    expectedEntryAt: new Date("2026-08-29T14:00:00Z"),
  });
  assert.ok(withoutTime && withTime);
  assert.equal(withoutTime!.newEntryValidFrom.toISOString(), withTime!.newEntryValidFrom.toISOString());
  assert.equal(withoutTime!.newEntryValidUntil.toISOString(), withTime!.newEntryValidUntil.toISOString());
});

test("computeVisitDateWindow: rejects invalid visitDate", () => {
  assert.equal(computeVisitDateWindow({ visitDate: "not-a-date", timezone: "America/Sao_Paulo" }), null);
  assert.equal(computeVisitDateWindow({ visitDate: "2026-13-40", timezone: "America/Sao_Paulo" }), null);
  assert.equal(computeVisitDateWindow({ visitDate: "", timezone: "America/Sao_Paulo" }), null);
});

test("computeVisitDateWindow: midnight boundary — entry exactly at 00:00:00 local is within window", () => {
  const w = computeVisitDateWindow({ visitDate: "2026-08-29", timezone: "America/Sao_Paulo" })!;
  const now = w.newEntryValidFrom;
  assert.ok(now.getTime() >= w.newEntryValidFrom.getTime() && now.getTime() <= w.newEntryValidUntil.getTime());
});

test("computeVisitDateWindow: one millisecond before/after the window is outside it", () => {
  const w = computeVisitDateWindow({ visitDate: "2026-08-29", timezone: "America/Sao_Paulo" })!;
  const before = new Date(w.newEntryValidFrom.getTime() - 1);
  const after = new Date(w.newEntryValidUntil.getTime() + 1);
  assert.ok(before.getTime() < w.newEntryValidFrom.getTime());
  assert.ok(after.getTime() > w.newEntryValidUntil.getTime());
});
