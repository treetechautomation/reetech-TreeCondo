/**
 * FEATURE.ANUNCIOS.1 — validação estática de
 * POST /api/cron/anuncios/processar-expiracao.
 * Mesmo padrão de verificação estática usado nos demais testes deste gate.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const ROUTE = path.resolve(__dirname, "../processar-expiracao/route.ts");
const SIBLING_CRON = path.resolve(__dirname, "../processar-agendados/route.ts");
async function read(p: string) { return fs.readFile(p, "utf8"); }

// Segurança do cron: mesmo mecanismo do cron irmão já homologado.
test("usa exatamente o mesmo mecanismo de auth do cron irmão (x-cron-secret == CRON_RESERVAS_SECRET, fail-closed)", async () => {
  const src = await read(ROUTE);
  const sibling = await read(SIBLING_CRON);
  assert.match(src, /const cronSecret = process\.env\.CRON_RESERVAS_SECRET;/);
  assert.match(src, /if \(!cronSecret\) \{\s*\n\s*return NextResponse\.json\(\{ ok: false, error: "Serviço não configurado\." \}, \{ status: 503 \}\);/);
  assert.match(src, /const headerSecret = req\.headers\.get\("x-cron-secret"\) \|\| "";/);
  assert.match(src, /if \(headerSecret !== cronSecret\) \{\s*\n\s*return NextResponse\.json\(\{ ok: false, error: "Não autorizado\." \}, \{ status: 401 \}\);/);
  assert.ok(sibling.includes("CRON_RESERVAS_SECRET"), "pré-condição: cron irmão usa o mesmo secret (reaproveitamento, não segredo novo)");
});

test("nunca publica GET (só POST) — não é acessível por navegação simples", async () => {
  const src = await read(ROUTE);
  assert.equal(/export async function GET/.test(src), false);
  assert.match(src, /export async function POST/);
});

// C14 — expirado sem attachment é idempotente (nem chega a checar data).
test("anúncio sem attachment.storagePath é pulado antes mesmo de avaliar a data de expiração (idempotente)", async () => {
  const src = await read(ROUTE);
  const skipIdx = src.indexOf("if (!storagePath) { skippedNoAttachment++; continue; }");
  const expiresCheckIdx = src.indexOf("readDateFlexible(data.expiresAt)");
  assert.ok(skipIdx > 0 && expiresCheckIdx > skipIdx, "checagem de anexo ausente deve vir antes da checagem de expiração");
});

// C16 — não expirado não é deletado.
test("não deleta quando expiresAt é nulo/inválido ou ainda está no futuro", async () => {
  const src = await read(ROUTE);
  assert.match(src, /if \(!expiresAt \|\| expiresAt > now\) continue;/);
});

// C13 — expirado com attachment é deletado.
test("expirado com attachment chama delete no Storage com ignoreNotFound", async () => {
  const src = await read(ROUTE);
  assert.match(src, /await adminStorage\(\)\.file\(storagePath\)\.delete\(\{ ignoreNotFound: true \}\);/);
});

// C15 — arquivo já ausente é idempotente (ignoreNotFound cobre isso; sem
// try/catch tratando "not found" como erro fatal).
test("delete usa ignoreNotFound — arquivo já ausente não gera exceção/erro", async () => {
  const src = await read(ROUTE);
  assert.match(src, /ignoreNotFound: true/);
});

// C17 — delete falha => estado consistente (não marca como limpo).
test("se o delete do Storage lançar, NÃO atualiza o Firestore (não marca attachment como limpo) e segue para o próximo", async () => {
  const src = await read(ROUTE);
  const catchBlockMatch = src.match(/\} catch \(e: any\) \{\s*\n\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*failed\+\+;\s*\n\s*console\.error\([^)]*\);\s*\n\s*continue;\s*\n\s*\}/);
  assert.ok(catchBlockMatch, "catch block deve incrementar failed e `continue` sem tocar Firestore");
  assert.equal(catchBlockMatch![0].includes("doc.ref.update"), false, "catch do delete não deve chamar doc.ref.update");
});

// C13/C18 — sucesso marca storagePath=null (idempotência por construção: a
// próxima execução vê storagePath ausente e cai no early-skip de C14).
test("sucesso marca attachment.storagePath=null e attachment.removedAt (idempotente por construção em reexecuções)", async () => {
  const src = await read(ROUTE);
  assert.match(src, /"attachment\.storagePath": null,/);
  assert.match(src, /"attachment\.removedAt": FieldValue\.serverTimestamp\(\),/);
});

// Nunca apaga o documento do anúncio, só o binário — histórico preservado.
test("nunca chama delete no documento do anúncio (só no objeto do Storage) — histórico/auditoria preservados", async () => {
  const src = await read(ROUTE);
  assert.equal(/doc\.ref\.delete\(\)/.test(src), false);
  assert.equal(/\bref\.delete\(\)/.test(src), false);
});

// Não itera anúncios de outros condomínios ao apagar — cada delete usa o
// storagePath já tenant-scoped (condominios/{condominioId}/anuncios/{id}/...)
// gravado no momento do upload, não um path reconstruído a partir de input.
test("delete usa o storagePath já persistido no doc (tenant-scoped na origem), nunca reconstrói o path a partir de condominioId de outro loop", async () => {
  const src = await read(ROUTE);
  assert.match(src, /const storagePath: string \| null = data\.attachment\?\.storagePath \|\| null;/);
});
