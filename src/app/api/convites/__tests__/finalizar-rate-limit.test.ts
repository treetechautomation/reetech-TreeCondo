/**
 * ADMIN_CONDOMINIO.1E — RATE LIMIT: finalizar-primeiro-acesso
 *
 * Fecha o bloqueador encontrado em ADMIN_CONDOMINIO.1D: o endpoint é
 * público (requireAuth=false por design) e protegido apenas por posse do
 * código de convite (8 caracteres). Sem limite de tentativas, fica exposto
 * a força bruta ilimitada. Homologado em staging via apiGuard; portado aqui
 * usando checkRateLimit já existente em @/lib/rateLimiter — sem dependência
 * nova.
 *
 * Os testes A–G usam a função pura checkRateLimit diretamente (mesmo padrão
 * de teste de lógica pura já usado em todo o projeto — ver
 * identityResolver.test.ts). Os testes H/I/J são verificações estáticas do
 * código-fonte real (mesmo padrão de first-access-link-flow.test.ts K/L),
 * já que o handler completo depende de Firestore/Auth via Admin SDK.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { checkRateLimit } from "../../../../lib/rateLimiter";

const ROUTE = path.resolve(__dirname, "../finalizar-primeiro-acesso/route.ts");

async function readSrc() {
  return fs.readFile(ROUTE, "utf8");
}

function uniqueKey(label: string) {
  // Cada teste usa uma chave própria para não compartilhar estado com os
  // demais (o store do rate limiter é um Map em memória de processo único).
  return `test:${label}:${Math.random().toString(36).slice(2)}`;
}

// A — chamadas dentro do limite passam.

test("A chamadas dentro do limite (1-5) são permitidas", () => {
  const key = uniqueKey("within-limit");
  for (let i = 1; i <= 5; i++) {
    const r = checkRateLimit({ key, limit: 5, windowSec: 60 });
    assert.equal(r.allowed, true, `tentativa ${i} deveria ser permitida`);
  }
});

// B — excesso é bloqueado.

test("B a 6a chamada na mesma janela é bloqueada", () => {
  const key = uniqueKey("over-limit");
  for (let i = 1; i <= 5; i++) {
    checkRateLimit({ key, limit: 5, windowSec: 60 });
  }
  const sixth = checkRateLimit({ key, limit: 5, windowSec: 60 });
  assert.equal(sixth.allowed, false, "a 6a tentativa deveria ser bloqueada");
  assert.equal(sixth.remaining, 0);
});

// C — resposta de bloqueio usa status esperado (verificação estática, já
// que rateLimitResponse importa NextResponse dinamicamente).

test("C rateLimitResponse usa status 429 (verificação estática)", async () => {
  const rateLimiterSrc = await fs.readFile(
    path.resolve(__dirname, "../../../../lib/rateLimiter.ts"),
    "utf8"
  );
  assert.match(rateLimiterSrc, /status:\s*429/);
});

// D — janela configurada é 60s.

test("D janela configurada no endpoint é 60s", async () => {
  const src = await readSrc();
  assert.match(src, /windowSec:\s*60/);
});

// E — limite configurado é 5.

test("E limite configurado no endpoint é 5", async () => {
  const src = await readSrc();
  assert.match(src, /checkRateLimit\(\{[\s\S]{0,120}limit:\s*5,/);
});

// F — endpoint continua requireAuth=false (nenhuma verificação de
// Authorization/Bearer foi introduzida — o rate limit não exige sessão).

test("F endpoint continua público (sem exigência de Authorization Bearer)", async () => {
  const src = await readSrc();
  assert.equal(/authHeader|Bearer /.test(src), false, "endpoint não deve exigir token de autenticação");
});

// G — rate limiting não altera payload de sucesso: a checagem acontece
// ANTES da leitura do body, então nenhum campo de resposta de sucesso foi
// tocado.

test("G checagem de rate limit ocorre antes da leitura do body (não interfere no payload de sucesso)", async () => {
  const src = await readSrc();
  const rlIndex = src.indexOf("checkRateLimit(");
  const bodyIndex = src.indexOf("await req.json()");
  assert.ok(rlIndex > 0 && bodyIndex > 0);
  assert.ok(rlIndex < bodyIndex, "checkRateLimit deve ocorrer antes de ler o body");
});

// H — rate limiting não altera a checagem de convite expirado (o guard de
// expiresAt permanece intacto, ver ADMIN_CONDOMINIO.1C-R2).

test("H checagem de expiração permanece intacta", async () => {
  const src = await readSrc();
  assert.match(src, /expiresAt[\s\S]{0,80}toMillis\(\)\s*<\s*Date\.now\(\)/);
});

// I — rate limiting não altera a checagem de BLOQUEADO.

test("I checagem de status BLOQUEADO permanece intacta", async () => {
  const src = await readSrc();
  assert.match(src, /status === "BLOQUEADO"/);
});

// J — nenhuma senha/código sensível é incluída em logs ou erro do limiter.

test("J resposta/erro do rate limiter não inclui senha nem código do convite", async () => {
  const src = await readSrc();
  const rlBlock = src.match(/const rl = checkRateLimit\([\s\S]*?rateLimitResponse\(rl\);/);
  assert.ok(rlBlock, "bloco de rate limit deve existir");
  assert.equal(/senha|code:|codigoHash/.test(rlBlock![0]), false, "bloco de rate limit não deve referenciar senha/código");
});

// Reset de janela: determinístico via janela artificialmente curta
// (windowSec=0 força expiração imediata na checagem seguinte).

test("reset de janela: nova janela após expiração permite novamente", async () => {
  const key = uniqueKey("window-reset");
  const first = checkRateLimit({ key, limit: 1, windowSec: 0 });
  assert.equal(first.allowed, true);
  // windowSec=0 => resetAt = now, então a próxima chamada já está em nova janela
  await new Promise((r) => setTimeout(r, 5));
  const second = checkRateLimit({ key, limit: 1, windowSec: 0 });
  assert.equal(second.allowed, true, "após a janela expirar, uma nova tentativa deve ser permitida");
});
