/**
 * R1.0 — Gate E.3.2A — Admin project selection (fail-closed) — teste puro.
 *
 * Testa exclusivamente `resolveTargetProjectId()`, exportada com mudança de
 * uma única palavra (`export`) sem alterar nenhum comportamento runtime.
 *
 * NÃO importa/chama `adminDb`/`adminAuth`/`adminMessaging` — evita qualquer
 * inicialização real do Firebase Admin SDK. A importação do módulo em si
 * não abre rede nem inicializa Firebase (apenas calcula `TARGET_PROJECT_ID`
 * uma vez, no topo, chamando a própria função pura que este arquivo testa).
 *
 * Cada teste salva e restaura `TREECONDO_ENV`/`TREECONDO_STAGING_PROJECT_ID`
 * para não vazar estado entre casos. `GOOGLE_APPLICATION_CREDENTIALS` nunca
 * é tocada.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { resolveTargetProjectId } from "../firebaseAdmin";

const PRODUCTION_PROJECT_ID = "studio-7559545170-41328";
const STAGING_PROJECT_ID = "treecondo-staging";

const ENV_KEYS = ["TREECONDO_ENV", "TREECONDO_STAGING_PROJECT_ID"] as const;

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
}
function restoreEnv(snap: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
}
function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

test("ADMIN-01 sem TREECONDO_ENV e sem TREECONDO_STAGING_PROJECT_ID -> production project", () => {
  const snap = snapshotEnv();
  try {
    clearEnv();
    assert.equal(resolveTargetProjectId(), PRODUCTION_PROJECT_ID);
  } finally {
    restoreEnv(snap);
  }
});

test("ADMIN-02 TREECONDO_ENV=staging + TREECONDO_STAGING_PROJECT_ID=treecondo-staging -> treecondo-staging", () => {
  const snap = snapshotEnv();
  try {
    clearEnv();
    process.env.TREECONDO_ENV = "staging";
    process.env.TREECONDO_STAGING_PROJECT_ID = STAGING_PROJECT_ID;
    assert.equal(resolveTargetProjectId(), STAGING_PROJECT_ID);
  } finally {
    restoreEnv(snap);
  }
});

test("ADMIN-03 TREECONDO_ENV=staging sem TREECONDO_STAGING_PROJECT_ID -> throw explícito (fail-closed)", () => {
  const snap = snapshotEnv();
  try {
    clearEnv();
    process.env.TREECONDO_ENV = "staging";
    // TREECONDO_STAGING_PROJECT_ID ausente de propósito
    assert.throws(
      () => resolveTargetProjectId(),
      /TREECONDO_STAGING_PROJECT_ID ausente/,
      "deve lançar erro explícito mencionando a variável ausente"
    );
  } finally {
    restoreEnv(snap);
  }
});

test("ADMIN-04 TREECONDO_ENV=staging + TREECONDO_STAGING_PROJECT_ID=produção -> throw explícito (fail-closed)", () => {
  const snap = snapshotEnv();
  try {
    clearEnv();
    process.env.TREECONDO_ENV = "staging";
    process.env.TREECONDO_STAGING_PROJECT_ID = PRODUCTION_PROJECT_ID;
    assert.throws(
      () => resolveTargetProjectId(),
      /aponta para o projeto de produção/,
      "deve lançar erro explícito recusando staging apontar para produção"
    );
  } finally {
    restoreEnv(snap);
  }
});

test("ADMIN-05 TREECONDO_ENV=qa (valor desconhecido) -> production project (somente 'staging' exato ativa staging)", () => {
  const snap = snapshotEnv();
  try {
    clearEnv();
    process.env.TREECONDO_ENV = "qa";
    process.env.TREECONDO_STAGING_PROJECT_ID = STAGING_PROJECT_ID;
    assert.equal(resolveTargetProjectId(), PRODUCTION_PROJECT_ID);
  } finally {
    restoreEnv(snap);
  }
});
