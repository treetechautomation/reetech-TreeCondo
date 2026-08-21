/**
 * SECURITY.P0.11 — UNIT A: apiGuard core + standalone security fixes.
 *
 * Segue o padrão já estabelecido no projeto de verificação estática do
 * código-fonte real para rotas que dependem de Firestore/Auth via Admin SDK
 * (ver first-access-link-flow.test.ts, finalizar-rate-limit.test.ts).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const APIGUARD = path.resolve(__dirname, "../apiGuard.ts");
const BLOCOS_ROUTE = path.resolve(__dirname, "../../app/api/condominios/[condominioId]/blocos/route.ts");
const CRON_ROUTE = path.resolve(__dirname, "../../app/api/cron/anuncios/processar-agendados/route.ts");

async function readSrc(p: string) {
  return fs.readFile(p, "utf8");
}

// J — blocos rejeita request sem autorização.

test("J blocos route exige apiGuard com allowedRoles restritos a operadores", async () => {
  const src = await readSrc(BLOCOS_ROUTE);
  assert.match(src, /apiGuard\(\{/, "rota deve chamar apiGuard");
  assert.match(
    src,
    /allowedRoles:\s*\[\s*"ADMIN_CONDOMINIO"\s*,\s*"ADMIN"\s*,\s*"SINDICO"\s*\]/,
    "allowedRoles deve restringir a ADMIN_CONDOMINIO/ADMIN/SINDICO"
  );
});

test("J blocos route propaga erros do apiGuard (Response) em vez de engoli-los", async () => {
  const src = await readSrc(BLOCOS_ROUTE);
  assert.match(src, /if \(e instanceof Response\) return e;/);
});

// K — cron rejeita secret ausente/incorreto, fail-closed.

test("K cron/processar-agendados falha fechado quando CRON_RESERVAS_SECRET não está configurado", async () => {
  const src = await readSrc(CRON_ROUTE);
  const idx = src.indexOf("if (!cronSecret)");
  assert.ok(idx > 0, "deve existir um branch para secret ausente");
  const window = src.slice(idx, idx + 200);
  assert.match(window, /status:\s*503/, "secret ausente deve retornar 503 (fail-closed), não seguir em frente");
});

test("K cron/processar-agendados rejeita header incorreto com 401", async () => {
  const src = await readSrc(CRON_ROUTE);
  const idx = src.indexOf("if (headerSecret !== cronSecret)");
  assert.ok(idx > 0, "deve existir comparação estrita do header contra o secret");
  const window = src.slice(idx, idx + 200);
  assert.match(window, /status:\s*401/);
});

test("K cron/processar-agendados não expõe o valor do secret em log/resposta", async () => {
  const src = await readSrc(CRON_ROUTE);
  assert.equal(
    /console\.(log|warn|error)\([^)]*cronSecret/.test(src),
    false,
    "cronSecret não deve aparecer em nenhuma chamada de log"
  );
  assert.equal(
    /json\(\s*\{[^}]*cronSecret/.test(src),
    false,
    "cronSecret não deve ser incluído em nenhuma resposta JSON"
  );
});

// L — apiGuard não transforma uma rota autenticada em pública por padrão.

test("L apiGuard.requireAuth tem default true (opt-out explícito, não opt-in)", async () => {
  const src = await readSrc(APIGUARD);
  assert.match(src, /requireAuth\s*=\s*true/, "requireAuth deve ter default true — endpoints públicos precisam declará-lo explicitamente");
});

test("L apiGuard sem token e requireAuth=true retorna 401 antes de qualquer lógica de tenant/role", async () => {
  const src = await readSrc(APIGUARD);
  const noTokenIdx = src.indexOf("if (!token) {");
  const throwIdx = src.indexOf("if (requireAuth) throw jsonError", noTokenIdx);
  const condominioLookupIdx = src.indexOf("if (condominioId) {");
  assert.ok(noTokenIdx > 0 && throwIdx > noTokenIdx, "ausência de token deve lançar 401 dentro do bloco !token");
  assert.match(src.slice(throwIdx, throwIdx + 100), /401/);
  assert.ok(throwIdx < condominioLookupIdx, "checagem de token deve ocorrer antes da lógica de tenant/role");
});

// M — SUPER_ADMIN continua funcionando (bypassa checagem de vínculo ATIVO, mas
// ainda passa pela verificação de token).

test("M apiGuard reconhece SUPER_ADMIN via custom claims (super_admin, superAdmin, role)", async () => {
  const src = await readSrc(APIGUARD);
  assert.match(src, /decoded\.super_admin === true/);
  assert.match(src, /decoded\.superAdmin === true/);
  assert.match(src, /upper\(decoded\.role\) === "SUPER_ADMIN"/);
});

test("M SUPER_ADMIN não é bloqueado pela checagem de vínculo ATIVO (bypass explícito)", async () => {
  const src = await readSrc(APIGUARD);
  assert.match(
    src,
    /if \(!isSuperAdmin && status !== "ATIVO"\)/,
    "checagem de status ATIVO deve ser condicionada a !isSuperAdmin, não aplicada incondicionalmente"
  );
});

// Additional: allowedRoles enforcement is skipped for SUPER_ADMIN too (same guard).

test("allowedRoles não bloqueia SUPER_ADMIN mesmo fora da lista explícita", async () => {
  const src = await readSrc(APIGUARD);
  assert.match(
    src,
    /if \(condominioId && allowedRoles && allowedRoles\.length > 0 && !isSuperAdmin\)/,
    "checagem de allowedRoles deve ser condicionada a !isSuperAdmin"
  );
});
