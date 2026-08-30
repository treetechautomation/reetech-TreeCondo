import { test } from "node:test";
import assert from "node:assert/strict";
import { ACCESS_TYPE_LABELS, ACCESS_TYPE_OPTIONS, STATUS_LABELS, STATUS_TONE } from "../uiLabels";

test("ACCESS_TYPE_LABELS covers exactly the 4 MVP enum values, no technical jargon", () => {
  assert.deepEqual(Object.keys(ACCESS_TYPE_LABELS).sort(), ["DELIVERY", "FAMILY", "SERVICE_PROVIDER", "VISITOR"]);
  for (const label of Object.values(ACCESS_TYPE_LABELS)) {
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0);
    // Não deve conter os próprios nomes de enum em maiúsculas (garantia mínima contra jargão técnico vazando pro label).
    assert.doesNotMatch(label, /^[A-Z_]+$/);
  }
});

test("ACCESS_TYPE_OPTIONS is derived from ACCESS_TYPE_LABELS and stays in sync", () => {
  assert.equal(ACCESS_TYPE_OPTIONS.length, Object.keys(ACCESS_TYPE_LABELS).length);
  for (const opt of ACCESS_TYPE_OPTIONS) {
    assert.equal(opt.label, ACCESS_TYPE_LABELS[opt.value]);
  }
});

test("STATUS_LABELS covers exactly the 3 effective statuses (AUTORIZADO/REVOGADO/EXPIRADO)", () => {
  assert.deepEqual(Object.keys(STATUS_LABELS).sort(), ["AUTORIZADO", "EXPIRADO", "REVOGADO"]);
});

test("STATUS_TONE maps every status to a tone accepted by StatusBadge", () => {
  const validTones = ["success", "warning", "danger", "info", "neutral", "accent"];
  for (const tone of Object.values(STATUS_TONE)) {
    assert.ok(validTones.includes(tone));
  }
  assert.equal(STATUS_TONE.AUTORIZADO, "success");
  assert.equal(STATUS_TONE.REVOGADO, "danger");
});

test("uiLabels module has zero server-only imports (crypto/Admin SDK) — source-level guard", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const filePath = path.join(process.cwd(), "src/lib/access/uiLabels.ts");
  const src = fs.readFileSync(filePath, "utf8");
  const importLines = src.match(/^\s*import[^\n]*from\s+["'][^"']+["']/gm) || [];
  assert.equal(importLines.length, 0, "uiLabels.ts should have zero imports at all — it's pure enum data");
});
