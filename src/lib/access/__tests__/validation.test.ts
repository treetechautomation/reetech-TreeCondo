import { test } from "node:test";
import assert from "node:assert/strict";
import { validateVisitorSnapshot } from "../validation";

test("accepts minimal valid snapshot (nome only)", () => {
  const r = validateVisitorSnapshot({ nome: "João" });
  assert.equal(r.valid, true);
  if (r.valid) {
    assert.equal(r.snapshot.nome, "João");
    assert.equal(r.snapshot.telefone, null);
    assert.equal(r.snapshot.placa, null);
    assert.equal(r.snapshot.observacao, null);
  }
});

test("rejects missing/empty nome", () => {
  assert.equal(validateVisitorSnapshot({}).valid, false);
  assert.equal(validateVisitorSnapshot({ nome: "   " }).valid, false);
});

test("rejects non-object payload", () => {
  assert.equal(validateVisitorSnapshot(null).valid, false);
  assert.equal(validateVisitorSnapshot("string").valid, false);
  assert.equal(validateVisitorSnapshot(42).valid, false);
});

test("rejects nome exceeding max length", () => {
  const r = validateVisitorSnapshot({ nome: "a".repeat(121) });
  assert.equal(r.valid, false);
});

test("accepts optional fields when within limits", () => {
  const r = validateVisitorSnapshot({ nome: "João", telefone: "11999999999", placa: "ABC1D23", observacao: "Chega de carro" });
  assert.equal(r.valid, true);
});

test("rejects optional field exceeding its limit", () => {
  assert.equal(validateVisitorSnapshot({ nome: "João", observacao: "a".repeat(281) }).valid, false);
  assert.equal(validateVisitorSnapshot({ nome: "João", placa: "a".repeat(13) }).valid, false);
  assert.equal(validateVisitorSnapshot({ nome: "João", telefone: "a".repeat(21) }).valid, false);
});

test("never accepts CPF/documento field — not part of the schema, silently ignored rather than persisted", () => {
  const r = validateVisitorSnapshot({ nome: "João", cpf: "12345678900" });
  assert.equal(r.valid, true);
  if (r.valid) {
    assert.equal((r.snapshot as any).cpf, undefined);
  }
});
