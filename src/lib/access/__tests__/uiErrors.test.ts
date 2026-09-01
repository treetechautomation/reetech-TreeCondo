import { test } from "node:test";
import assert from "node:assert/strict";
import { mapCreateError } from "../uiErrors";

test("NO_ACTIVE_UNIT maps to the friendly zero-unit message", () => {
  const r = mapCreateError({ code: "NO_ACTIVE_UNIT" });
  assert.equal(r.description, "Não encontramos uma unidade vinculada ao seu acesso.");
});

test("INVALID_UNIT maps to the friendly stale-unit message", () => {
  const r = mapCreateError({ code: "INVALID_UNIT" });
  assert.equal(r.description, "Sua unidade selecionada não está mais disponível. Atualize e tente novamente.");
});

test("unknown/other codes fall back to a generic message, never a technical code", () => {
  const r = mapCreateError({ code: "CONFIGURATION_ERROR", message: "some internal detail" });
  assert.doesNotMatch(r.description, /CONFIGURATION_ERROR/);
});

test("never leaks the raw error code string into either title or description", () => {
  for (const code of ["NO_ACTIVE_UNIT", "INVALID_UNIT", "FORBIDDEN", "PIN_GENERATION_FAILED"]) {
    const r = mapCreateError({ code });
    assert.doesNotMatch(r.title, new RegExp(code));
    assert.doesNotMatch(r.description, new RegExp(code));
  }
});
