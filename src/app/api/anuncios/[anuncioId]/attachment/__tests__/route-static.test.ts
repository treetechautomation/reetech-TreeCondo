/**
 * FEATURE.ANUNCIOS.1 — validação estática de POST/DELETE
 * /api/anuncios/[anuncioId]/attachment.
 *
 * Mesmo padrão de verificação estática de código-fonte usado em
 * expiration-required-static.test.ts (rota inicializa firebase-admin no
 * import, sem mock de módulo ESM disponível neste test runner).
 * Validação pura de MIME/tamanho/path já coberta comportamentalmente em
 * src/lib/anuncios/__tests__/attachment.test.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const ROUTE = path.resolve(__dirname, "../route.ts");
async function read() { return fs.readFile(ROUTE, "utf8"); }

test("apiGuard chamado com MANAGERS tanto em POST quanto em DELETE (mesma proteção de criar/editar anúncio)", async () => {
  const src = await read();
  const guardCalls = src.match(/apiGuard\(\{ request: req, condominioId, allowedRoles: MANAGERS \}\)/g) || [];
  assert.equal(guardCalls.length, 2, "POST e DELETE devem chamar apiGuard com MANAGERS");
});

// B11 — client não controla storagePath.
test("storagePath nunca é lido do form/body do cliente — sempre derivado por buildAttachmentStoragePath", async () => {
  const src = await read();
  assert.equal(/form\.get\("storagePath"\)/.test(src), false);
  assert.equal(/body\.storagePath/.test(src), false);
  assert.match(src, /const storagePath = buildAttachmentStoragePath\(condominioId, anuncioId, file\.name/);
});

// B12 / cross-tenant — o doc só existe sob o condominioId autenticado; um
// anuncioId de outro tenant simplesmente não é encontrado nesse path.
test("POST e DELETE resolvem o anúncio via condominios/{condominioId}/anuncios/{anuncioId} e 404 se ausente (isolamento cross-tenant)", async () => {
  const src = await read();
  const refBuilds = src.match(/db\.collection\("condominios"\)\.doc\(condominioId\)\.collection\("anuncios"\)\.doc\(anuncioId\)/g) || [];
  assert.equal(refBuilds.length, 2, "POST e DELETE devem escopar por condominioId autenticado");
  const notFoundChecks = src.match(/if \(!snap\.exists\) return jsonError\("Anúncio não encontrado\.", 404\);/g) || [];
  assert.equal(notFoundChecks.length, 2);
});

// B7 — metadata gravada no Firestore tem exatamente o shape esperado.
test("metadata do attachment gravada no Firestore contém storagePath/fileName/contentType/size/uploadedAt/removedAt", async () => {
  const src = await read();
  assert.match(src, /const attachment = \{\s*\n\s*storagePath,\s*\n\s*fileName: String\(file\.name \|\| "arquivo"\),\s*\n\s*contentType,\s*\n\s*size: file\.size,\s*\n\s*uploadedAt: Timestamp\.now\(\),\s*\n\s*removedAt: null,\s*\n\s*\};/);
});

// MIME/tamanho validados antes de qualquer escrita.
test("validação de tipo e tamanho ocorre antes do upload ao Storage", async () => {
  const src = await read();
  const typeCheckIdx = src.indexOf("isAllowedAttachmentType(contentType)");
  const sizeCheckIdx = src.indexOf("file.size > ATTACHMENT_MAX_BYTES");
  const uploadIdx = src.indexOf(".save(buffer");
  assert.ok(typeCheckIdx > 0 && typeCheckIdx < uploadIdx);
  assert.ok(sizeCheckIdx > 0 && sizeCheckIdx < uploadIdx);
});

// E22 — falha de upload não apaga o anexo antigo.
test("se o upload ao Storage falhar, a rota retorna erro antes de qualquer referência ao anexo anterior", async () => {
  const src = await read();
  const uploadCatchIdx = src.indexOf("Falha ao enviar arquivo para o Storage");
  const previousRefIdx = src.indexOf("previousStoragePath && previousStoragePath");
  assert.ok(uploadCatchIdx > 0 && previousRefIdx > 0);
  assert.ok(uploadCatchIdx < previousRefIdx, "o catch do upload deve vir antes de qualquer lógica de limpeza do anexo anterior");
});

// E21 — replace: upload novo → persistência → só então remove o antigo.
test("ordem de operações: upload do novo, depois update do Firestore, e só então delete do anexo anterior", async () => {
  const src = await read();
  const saveIdx = src.indexOf(".save(buffer");
  const updateIdx = src.indexOf("await ref.update({ attachment, updatedAt:");
  const previousDeleteIdx = src.indexOf("deleteStorageObjectIfExists(previousStoragePath)");
  assert.ok(saveIdx > 0 && updateIdx > saveIdx, "Firestore só é atualizado após o upload ter sucesso");
  assert.ok(previousDeleteIdx > updateIdx, "o anexo anterior só é removido depois que o novo já está persistido como ativo");
});

test("se o update do Firestore falhar após upload bem-sucedido, a rota reverte (apaga) o novo objeto recém-enviado", async () => {
  const src = await read();
  assert.match(src, /await deleteStorageObjectIfExists\(storagePath\);\s*\n\s*return jsonError\(e\?\.message \|\| "Falha ao salvar metadados do anexo\."/);
});

// C15/C18-equivalente para o fluxo manual: delete idempotente para objeto ausente.
test("delete usa ignoreNotFound (idempotente para objeto já ausente no Storage)", async () => {
  const src = await read();
  const ignoreNotFoundCalls = src.match(/\.delete\(\{ ignoreNotFound: true \}\)/g) || [];
  assert.ok(ignoreNotFoundCalls.length >= 1);
});

// DELETE manual do anexo (não do anúncio) é idempotente quando não há anexo.
test("DELETE do attachment é idempotente quando o anúncio não possui anexo (não é um erro)", async () => {
  const src = await read();
  assert.match(src, /if \(!storagePath\) \{\s*\n\s*\/\/ Idempotente: nada para remover\.\s*\n\s*return NextResponse\.json\(\{ ok: true, anuncioId, removed: false \}\);/);
});

// D19/D20 — não existe endpoint de delete do anúncio em si (auditado
// separadamente em [anuncioId]/route.ts); este teste documenta que este
// arquivo de rota (attachment) não expõe nenhum meio de apagar o documento
// do anúncio, apenas o anexo — condição prévia confirmada pela auditoria
// FEATURE.ANUNCIOS.1 (ver relatório do gate: nenhum DELETE de anúncio
// existe hoje em [anuncioId]/route.ts, logo D19/D20 não se aplicam ainda).
test("rota de attachment nunca apaga o documento do anúncio (ref.delete() do anúncio nunca é chamado)", async () => {
  const src = await read();
  assert.equal(/\bref\.delete\(\)/.test(src), false);
});
