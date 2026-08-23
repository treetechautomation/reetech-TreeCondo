#!/usr/bin/env node
/**
 * Gera .firebaserc local (gitignorado) para o ambiente de staging do TreeCondo.
 *
 * Fail-closed: recusa gerar qualquer config que resolva para o projeto de
 * produção. Espelha a mesma lógica de `resolveTargetProjectId()` em
 * `src/lib/firebaseAdmin.ts`, para as duas fontes de verdade (CLI e Admin
 * SDK) nunca poderem divergir sobre "o que é produção".
 *
 * Idempotente: pode ser rodado quantas vezes for preciso (após `git pull`,
 * `npm ci`, etc.) — sempre produz o mesmo resultado a partir do mesmo env.
 *
 * Resolve caminhos relativos ao cwd (mesmo padrão de
 * scripts/gen-firebase-messaging-sw.js) — deve ser rodado a partir da raiz
 * do checkout, como `node scripts/bootstrap-staging.mjs` ou
 * `npm run bootstrap:staging`.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const PRODUCTION_PROJECT_ID = "studio-7559545170-41328";

function loadDotEnvLocal(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = (m[2] ?? "").trim();
    if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function fail(msg) {
  console.error(`[bootstrap-staging] ERRO: ${msg}`);
  process.exit(1);
}

const envFile = loadDotEnvLocal(".env.local");
const env = { ...envFile, ...process.env };

const TREECONDO_ENV = env.TREECONDO_ENV;
const TREECONDO_STAGING_PROJECT_ID = env.TREECONDO_STAGING_PROJECT_ID;

if (TREECONDO_ENV !== "staging") {
  fail(
    `TREECONDO_ENV deve ser "staging" para rodar este script (valor atual: ${JSON.stringify(
      TREECONDO_ENV
    )}). Este script só deve rodar dentro de um checkout de staging.`
  );
}

if (!TREECONDO_STAGING_PROJECT_ID) {
  fail("TREECONDO_STAGING_PROJECT_ID ausente (esperado em .env.local ou no ambiente).");
}

if (TREECONDO_STAGING_PROJECT_ID === PRODUCTION_PROJECT_ID) {
  fail(
    `TREECONDO_STAGING_PROJECT_ID aponta para o projeto de produção (${PRODUCTION_PROJECT_ID}). Abortando — staging nunca pode ter produção como default do Firebase CLI.`
  );
}

const content = {
  projects: {
    default: TREECONDO_STAGING_PROJECT_ID,
  },
};

writeFileSync(".firebaserc", JSON.stringify(content, null, 2) + "\n", "utf8");
console.log(
  `[bootstrap-staging] OK: .firebaserc local gerado com default="${TREECONDO_STAGING_PROJECT_ID}"`
);
