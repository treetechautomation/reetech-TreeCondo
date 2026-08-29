import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ACCESS_POLICY, resolveAccessPolicy } from "../policy";

test("DEFAULT_ACCESS_POLICY has no requireEntryConfirmation/requireExitConfirmation fields (invariant, not configurable)", () => {
  assert.equal((DEFAULT_ACCESS_POLICY as any).requireEntryConfirmation, undefined);
  assert.equal((DEFAULT_ACCESS_POLICY as any).requireExitConfirmation, undefined);
});

test("resolveAccessPolicy: returns defaults when nothing stored", () => {
  const policy = resolveAccessPolicy(null);
  assert.deepEqual(policy, DEFAULT_ACCESS_POLICY);
});

test("resolveAccessPolicy: merges partial stored policy over defaults", () => {
  const policy = resolveAccessPolicy({ pinEnabled: false, timezone: "America/Manaus" });
  assert.equal(policy.pinEnabled, false);
  assert.equal(policy.timezone, "America/Manaus");
  assert.equal(policy.qrEnabled, DEFAULT_ACCESS_POLICY.qrEnabled);
  assert.equal(policy.autoCloseAfterMinutes, DEFAULT_ACCESS_POLICY.autoCloseAfterMinutes);
});
