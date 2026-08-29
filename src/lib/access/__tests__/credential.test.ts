import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateQrCredential,
  hashQrToken,
  safeCompareHash,
  generatePin,
  computePinLookupHash,
  isPinLocked,
  recordFailedPinAttempt,
  resetPinAttempts,
  PIN_MAX_ATTEMPTS,
  PIN_LOCK_DURATION_MS,
} from "../credential";

test("QR: same raw token -> same hash", () => {
  const { token, hash } = generateQrCredential();
  assert.equal(hashQrToken(token), hash);
});

test("QR: different raw tokens -> different hashes (no collision in practice)", () => {
  const a = generateQrCredential();
  const b = generateQrCredential();
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.hash, b.hash);
});

test("QR: token has 256 bits of entropy (64 hex chars)", () => {
  const { token } = generateQrCredential();
  assert.equal(token.length, 64);
  assert.match(token, /^[0-9a-f]{64}$/);
});

test("QR: safeCompareHash true for equal hashes", () => {
  const { hash } = generateQrCredential();
  assert.equal(safeCompareHash(hash, hash), true);
});

test("QR: safeCompareHash false for different hashes", () => {
  const a = generateQrCredential();
  const b = generateQrCredential();
  assert.equal(safeCompareHash(a.hash, b.hash), false);
});

test("QR: safeCompareHash false for different-length strings (malformed input)", () => {
  assert.equal(safeCompareHash("abc", "abcd"), false);
});

test("PIN: generatePin produces 6-digit string, allows leading zero", () => {
  let sawLeadingZero = false;
  for (let i = 0; i < 500; i++) {
    const pin = generatePin();
    assert.equal(pin.length, 6);
    assert.match(pin, /^[0-9]{6}$/);
    if (pin.startsWith("0")) sawLeadingZero = true;
  }
  assert.equal(sawLeadingZero, true, "expected at least one leading-zero PIN across 500 samples");
});

test("PIN: computePinLookupHash is deterministic for same inputs", () => {
  const h1 = computePinLookupHash("004821", "condo-a", "server-key-1");
  const h2 = computePinLookupHash("004821", "condo-a", "server-key-1");
  assert.equal(h1, h2);
});

test("PIN: computePinLookupHash differs across condominios (tenant-scoped blind index)", () => {
  const h1 = computePinLookupHash("004821", "condo-a", "server-key-1");
  const h2 = computePinLookupHash("004821", "condo-b", "server-key-1");
  assert.notEqual(h1, h2);
});

test("PIN: computePinLookupHash differs across server keys (offline brute force requires the key)", () => {
  const h1 = computePinLookupHash("004821", "condo-a", "server-key-1");
  const h2 = computePinLookupHash("004821", "condo-a", "server-key-2");
  assert.notEqual(h1, h2);
});

test("PIN: computePinLookupHash is NOT a plain sha256(pin) (must not match the encomendas-style naive hash)", () => {
  const crypto = require("node:crypto");
  const naive = crypto.createHash("sha256").update("004821", "utf8").digest("hex");
  const blindIndex = computePinLookupHash("004821", "condo-a", "server-key-1");
  assert.notEqual(blindIndex, naive);
});

test("PIN lockout: not locked initially", () => {
  assert.equal(isPinLocked(resetPinAttempts()), false);
});

test("PIN lockout: locks after max attempts", () => {
  let state = resetPinAttempts();
  const now = new Date("2026-01-01T00:00:00Z");
  for (let i = 0; i < PIN_MAX_ATTEMPTS - 1; i++) {
    state = recordFailedPinAttempt(state, now);
    assert.equal(isPinLocked(state, now), false, `should not be locked after ${i + 1} attempts`);
  }
  state = recordFailedPinAttempt(state, now);
  assert.equal(isPinLocked(state, now), true);
});

test("PIN lockout: unlocks after lock duration elapses", () => {
  let state = resetPinAttempts();
  const now = new Date("2026-01-01T00:00:00Z");
  for (let i = 0; i < PIN_MAX_ATTEMPTS; i++) state = recordFailedPinAttempt(state, now);
  assert.equal(isPinLocked(state, now), true);
  const later = new Date(now.getTime() + PIN_LOCK_DURATION_MS + 1);
  assert.equal(isPinLocked(state, later), false);
});

test("PIN lockout: resetPinAttempts clears attempts and lock", () => {
  let state = resetPinAttempts();
  const now = new Date();
  for (let i = 0; i < PIN_MAX_ATTEMPTS; i++) state = recordFailedPinAttempt(state, now);
  state = resetPinAttempts();
  assert.equal(state.attempts, 0);
  assert.equal(state.lockedUntil, null);
});
