/**
 * FEATURE.ANUNCIOS.1 — testes puros de src/lib/anuncios/expiration.ts.
 *
 * Sem import de firebaseAdmin/apiGuard (nenhuma inicialização de Firebase) —
 * mesma convenção de src/lib/__tests__/firebase-admin-project-selection.test.ts.
 * A validação a nível de rota (POST/PUT) é coberta separadamente por testes
 * estáticos de código-fonte, seguindo o padrão já estabelecido no projeto
 * para rotas que dependem de Admin SDK (ver criar-apiguard-reconciliation.test.ts).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { requiresExpiresAt, readDateFlexible } from "../expiration";

// A6 — draft não exige expiração; publicar/agendar exige.
test("requiresExpiresAt: PUBLICADO e AGENDADO exigem expiração", () => {
  assert.equal(requiresExpiresAt("PUBLICADO"), true);
  assert.equal(requiresExpiresAt("AGENDADO"), true);
});

test("requiresExpiresAt: RASCUNHO não exige expiração (comportamento de draft preservado)", () => {
  assert.equal(requiresExpiresAt("RASCUNHO"), false);
});

test("requiresExpiresAt: case-insensitive e tolera valor ausente", () => {
  assert.equal(requiresExpiresAt("publicado"), true);
  assert.equal(requiresExpiresAt(""), false);
  assert.equal(requiresExpiresAt(undefined as any), false);
});

// A3 — expiração inválida.
test("readDateFlexible: string não-data retorna null (expiração inválida)", () => {
  assert.equal(readDateFlexible("não é uma data"), null);
  assert.equal(readDateFlexible("abc123"), null);
});

test("readDateFlexible: ausente/vazio retorna null", () => {
  assert.equal(readDateFlexible(null), null);
  assert.equal(readDateFlexible(undefined), null);
  assert.equal(readDateFlexible(""), null);
});

// A5 — expiração válida em formato datetime-local (o que o <input> do form envia).
test("readDateFlexible: string ISO datetime-local válida é aceita", () => {
  const d = readDateFlexible("2027-01-15T10:30");
  assert.ok(d instanceof Date);
  assert.equal(isNaN(d!.getTime()), false);
});

// Compat com o schema legado (Firestore Timestamp e forma serializada {_seconds}).
test("readDateFlexible: aceita Firestore Timestamp (.toDate()) e forma serializada (._seconds)", () => {
  const fakeTimestamp = { toDate: () => new Date("2027-06-01T00:00:00Z") };
  assert.equal(readDateFlexible(fakeTimestamp)!.getTime(), new Date("2027-06-01T00:00:00Z").getTime());

  const serialized = { _seconds: 1798761600 }; // 2027-01-01T00:00:00Z
  assert.equal(readDateFlexible(serialized)!.getTime(), 1798761600 * 1000);
});

test("readDateFlexible: Date nativo passa através", () => {
  const now = new Date();
  assert.equal(readDateFlexible(now)!.getTime(), now.getTime());
});
