/**
 * R1.0 — GATE DEVELOPMENT.PIPELINE.2 — guards de higiene do pipeline de staging.
 *
 * Cobre:
 *  A. src/server/firebaseAdmin.ts não existe mais, e nada importa dele.
 *  B. runtime oficial do Admin SDK continua sendo src/lib/firebaseAdmin.ts
 *     (resolveTargetProjectId exportada e fail-closed).
 *  C/D. scripts/bootstrap-staging.mjs recusa produção e resolve
 *     corretamente para o projeto de staging.
 *  F. PRODUCTION_PROJECT_ID conhecido continua estável.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

// este arquivo vive em src/lib/__tests__/ -> raiz do repo é 3 níveis acima
const ROOT = path.resolve(__dirname, "..", "..", "..");
const PRODUCTION_PROJECT_ID = "studio-7559545170-41328";
const STAGING_PROJECT_ID = "treecondo-staging";

test("A — src/server/firebaseAdmin.ts não existe mais (dead code removido)", () => {
  const deadFile = path.join(ROOT, "src", "server", "firebaseAdmin.ts");
  assert.equal(existsSync(deadFile), false, "arquivo morto deveria ter sido removido");
});

test("A2 — nenhum arquivo em src/ importa server/firebaseAdmin", () => {
  let hits = "";
  try {
    // exclui este próprio arquivo de guard (que cita a string como fixture de teste)
    hits = execFileSync(
      "grep",
      ["-rl", "--exclude=staging-pipeline-hygiene.test.ts", "server/firebaseAdmin", path.join(ROOT, "src")],
      { encoding: "utf8" }
    );
  } catch (e: any) {
    if (e.status !== 1) throw e; // exit 1 do grep = nenhum match, esperado
  }
  assert.equal(hits.trim(), "", `referências inesperadas encontradas:\n${hits}`);
});

test("B — src/lib/firebaseAdmin.ts continua sendo a única fonte, fail-closed", () => {
  const officialFile = path.join(ROOT, "src", "lib", "firebaseAdmin.ts");
  const contents = readFileSync(officialFile, "utf8");
  assert.match(contents, /export function resolveTargetProjectId/);
  assert.match(contents, /TREECONDO_STAGING_PROJECT_ID ausente/);
  assert.match(contents, /aponta para o projeto de produção/);
});

function runBootstrap(env: Record<string, string | undefined>, cwd: string) {
  const merged: Record<string, string | undefined> = { ...process.env };
  // TREECONDO_ENV/TREECONDO_STAGING_PROJECT_ID nunca devem vazar do ambiente
  // real do runner para dentro do processo filho isolado do teste.
  delete merged.TREECONDO_ENV;
  delete merged.TREECONDO_STAGING_PROJECT_ID;
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete merged[k];
    else merged[k] = v;
  }
  return execFileSync("node", [path.join(ROOT, "scripts", "bootstrap-staging.mjs")], {
    cwd,
    env: merged as NodeJS.ProcessEnv,
    encoding: "utf8",
  });
}

test("C — bootstrap-staging recusa (fail-closed) quando staging aponta para produção", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "treecondo-bootstrap-test-"));
  try {
    writeFileSync(path.join(tmp, ".env.local"), "");
    assert.throws(() =>
      runBootstrap(
        { TREECONDO_ENV: "staging", TREECONDO_STAGING_PROJECT_ID: PRODUCTION_PROJECT_ID },
        tmp
      )
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("C2 — bootstrap-staging recusa quando TREECONDO_ENV != staging", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "treecondo-bootstrap-test-"));
  try {
    writeFileSync(path.join(tmp, ".env.local"), "");
    assert.throws(() =>
      runBootstrap(
        { TREECONDO_ENV: "production", TREECONDO_STAGING_PROJECT_ID: STAGING_PROJECT_ID },
        tmp
      )
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("D — bootstrap-staging gera .firebaserc apontando para treecondo-staging", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "treecondo-bootstrap-test-"));
  try {
    writeFileSync(path.join(tmp, ".env.local"), "");
    runBootstrap(
      { TREECONDO_ENV: "staging", TREECONDO_STAGING_PROJECT_ID: STAGING_PROJECT_ID },
      tmp
    );
    const generated = JSON.parse(readFileSync(path.join(tmp, ".firebaserc"), "utf8"));
    assert.equal(generated.projects.default, STAGING_PROJECT_ID);
    assert.notEqual(generated.projects.default, PRODUCTION_PROJECT_ID);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("D2 — bootstrap-staging é idempotente (rodar 2x dá o mesmo resultado)", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "treecondo-bootstrap-test-"));
  try {
    writeFileSync(path.join(tmp, ".env.local"), "");
    const env = { TREECONDO_ENV: "staging", TREECONDO_STAGING_PROJECT_ID: STAGING_PROJECT_ID };
    runBootstrap(env, tmp);
    const first = readFileSync(path.join(tmp, ".firebaserc"), "utf8");
    runBootstrap(env, tmp);
    const second = readFileSync(path.join(tmp, ".firebaserc"), "utf8");
    assert.equal(first, second);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("D3 — bootstrap-staging lê TREECONDO_STAGING_PROJECT_ID do .env.local quando não vem do ambiente", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "treecondo-bootstrap-test-"));
  try {
    writeFileSync(
      path.join(tmp, ".env.local"),
      `TREECONDO_ENV=staging\nTREECONDO_STAGING_PROJECT_ID=${STAGING_PROJECT_ID}\n`
    );
    runBootstrap({ TREECONDO_ENV: undefined, TREECONDO_STAGING_PROJECT_ID: undefined }, tmp);
    const generated = JSON.parse(readFileSync(path.join(tmp, ".firebaserc"), "utf8"));
    assert.equal(generated.projects.default, STAGING_PROJECT_ID);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("F — PRODUCTION_PROJECT_ID continua o mesmo valor conhecido em src/lib/firebaseAdmin.ts", () => {
  const officialFile = path.join(ROOT, "src", "lib", "firebaseAdmin.ts");
  const contents = readFileSync(officialFile, "utf8");
  assert.match(contents, new RegExp(`PRODUCTION_PROJECT_ID = "${PRODUCTION_PROJECT_ID}"`));
});
