/**
 * FIX.ANUNCIOS.2A — validação estática de POST/PUT /api/anuncios e do
 * cron processar-agendados. Mesmo padrão de
 * expiration-required-static.test.ts: verificação estática do
 * código-fonte, porque estas rotas inicializam firebase-admin no
 * import. A lógica pura (parseZonedDateTimeLocal, evaluateScheduling
 * Eligibility, canClaimNotification) já tem cobertura comportamental
 * real em src/lib/anuncios/__tests__/scheduling.test.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const POST_ROUTE = path.resolve(__dirname, "../route.ts");
const PUT_ROUTE = path.resolve(__dirname, "../[anuncioId]/route.ts");
const CRON_ROUTE = path.resolve(__dirname, "../../cron/anuncios/processar-agendados/route.ts");
const NOTIF_LIB = path.resolve(__dirname, "../../../../lib/notifications/anuncios.ts");

async function read(p: string) { return fs.readFile(p, "utf8"); }

// --- item 9: POST normaliza publishAt ---

test("POST /api/anuncios: importa parseZonedDateTimeLocal do motor de agendamento", async () => {
  const src = await read(POST_ROUTE);
  assert.match(src, /import \{ parseZonedDateTimeLocal \} from "@\/lib\/anuncios\/scheduling";/);
});

test("POST /api/anuncios: publishAt fornecido é parseado e rejeitado se inválido, ANTES de qualquer escrita", async () => {
  const src = await read(POST_ROUTE);
  assert.match(src, /publishAtParsed = parseZonedDateTimeLocal\(publishAt\);/);
  assert.match(src, /if \(!publishAtParsed\) return jsonError\("publishAt inválido\."/);
  const parseIdx = src.indexOf("parseZonedDateTimeLocal(publishAt)");
  const writeIdx = src.indexOf("await ref.set(data)");
  assert.ok(parseIdx > 0 && writeIdx > parseIdx, "parsing deve ocorrer antes da escrita");
});

test("POST /api/anuncios: AGENDADO sem publishAt parseável continua bloqueado (regressão preservada)", async () => {
  const src = await read(POST_ROUTE);
  assert.match(src, /if \(status === "AGENDADO" && !publishAtParsed\) return jsonError\("publishAt obrigatório para AGENDADO"/);
});

test("POST /api/anuncios: grava publishAt como Timestamp a partir do valor validado (publishAtParsed), nunca a string crua", async () => {
  const src = await read(POST_ROUTE);
  assert.match(src, /status, publishAt: publishAtParsed \? Timestamp\.fromDate\(publishAtParsed\) : null, publishedAt,/);
  assert.doesNotMatch(src, /publishAt: publishAt \|\| null/, "não deve mais gravar a string crua do cliente");
});

test("POST /api/anuncios: comparação expiresAt > publishAt usa os dois valores já parseados (instantes reais, não strings)", async () => {
  const src = await read(POST_ROUTE);
  assert.match(src, /if \(expiresAtParsed && publishAtParsed && expiresAtParsed <= publishAtParsed\) return jsonError\("expiresAt deve ser posterior a publishAt"/);
  assert.doesNotMatch(src, /new Date\(publishAt\)/, "não deve mais fazer parsing ambíguo de publishAt com new Date()");
});

// --- item 10: PUT normaliza publishAt ---

test("PUT [anuncioId]: importa parseZonedDateTimeLocal do motor de agendamento", async () => {
  const src = await read(PUT_ROUTE);
  assert.match(src, /import \{ parseZonedDateTimeLocal \} from "@\/lib\/anuncios\/scheduling";/);
});

test("PUT [anuncioId]: publishAt fornecido é parseado e rejeitado se inválido antes de qualquer escrita", async () => {
  const src = await read(PUT_ROUTE);
  assert.match(src, /publishAtParsed = parseZonedDateTimeLocal\(body\.publishAt\);/);
  assert.match(src, /if \(!publishAtParsed\) return jsonError\("publishAt inválido\."/);
  const parseIdx = src.indexOf("parseZonedDateTimeLocal(body.publishAt)");
  const writeIdx = src.lastIndexOf("await ref.update(patch)");
  assert.ok(parseIdx > 0 && writeIdx > parseIdx, "parsing deve ocorrer antes da escrita final (a última chamada, não as de archive/restore)");
});

test("PUT [anuncioId]: grava publishAt como Timestamp a partir do valor validado, nunca a string crua", async () => {
  const src = await read(PUT_ROUTE);
  assert.match(src, /patch\.publishAt = publishAtParsed \? Timestamp\.fromDate\(publishAtParsed\) : null;/);
  assert.doesNotMatch(src, /patch\.publishAt = body\.publishAt \|\| null/, "não deve mais gravar a string crua do cliente");
});

test("PUT [anuncioId]: publishAt não tocado nesta requisição (body.publishAt undefined) não é validado nem sobrescrito", async () => {
  const src = await read(PUT_ROUTE);
  assert.match(src, /if \(body\.publishAt !== undefined\) \{/);
});

// --- item 11: expiresAt continua funcionando (regressão) ---

test("regressão: expiresAt continua obrigatório para PUBLICADO/AGENDADO em POST e PUT (requiresExpiresAt intacto)", async () => {
  const postSrc = await read(POST_ROUTE);
  const putSrc = await read(PUT_ROUTE);
  assert.match(postSrc, /import \{ requiresExpiresAt \} from "@\/lib\/anuncios\/expiration";/);
  assert.match(putSrc, /import \{ requiresExpiresAt, readDateFlexible \} from "@\/lib\/anuncios\/expiration";/);
  assert.match(postSrc, /if \(requiresExpiresAt\(status\)\) \{/);
  assert.match(putSrc, /requiresExpiresAt\(effectiveStatus\) && \(statusProvided \|\| expiresAtProvided\)/);
});

// --- item 12: publicação manual não regrediu ---

test("regressão: POST com status PUBLICADO continua disparando notificação imediatamente (fora do motor de cron)", async () => {
  const src = await read(POST_ROUTE);
  assert.match(src, /if \(status === "PUBLICADO"\) \{/);
  assert.match(src, /const \{ sendAnnouncementNotifications, resolveAnnouncementRecipients \} = await import\("@\/lib\/notifications\/anuncios"\);/);
});

test("regressão: PUT transicionando para PUBLICADO continua disparando notificação (guardado por notificationSentAt)", async () => {
  const src = await read(PUT_ROUTE);
  assert.match(src, /if \(patch\.status === "PUBLICADO"\) \{/);
  assert.match(src, /if \(!current\.notificationSentAt\) \{/);
});

// --- cron: transação atômica + fail-safe + observabilidade ---

test("cron processar-agendados: usa readDateFlexible (robusto), não faz mais parsing inline frágil de publishAt", async () => {
  const src = await read(CRON_ROUTE);
  assert.match(src, /import \{ readDateFlexible \} from "@\/lib\/anuncios\/expiration";/);
  assert.doesNotMatch(src, /data\.publishAt\.toDate \? data\.publishAt\.toDate\(\) : new Date\(data\.publishAt\._seconds \* 1000\)/, "parsing frágil antigo não deve mais existir");
});

test("cron processar-agendados: elegibilidade e reivindicação de notificação acontecem dentro de db.runTransaction", async () => {
  const src = await read(CRON_ROUTE);
  assert.match(src, /db\.runTransaction\(async \(tx: Transaction\) => \{/);
  assert.match(src, /evaluateSchedulingEligibility\(status, publishAtDate, now\)/);
  assert.match(src, /canClaimNotification\(notificationStatus, claimedAt, now, NOTIFICATION_CLAIM_STALE_MS\)/);
});

test("cron processar-agendados: publishAt inválido gera SKIP + log de aviso, nunca publicação", async () => {
  const src = await read(CRON_ROUTE);
  assert.match(src, /console\.warn\("\[AN\.3\] publishAt ausente\/inválido, publicação automática recusada:"/);
  assert.doesNotMatch(src, /if \(!data\.publishAt\) continue;\s*\n\s*let pubDate: Date;/, "não deve mais existir o caminho antigo que assumia vencido");
});

test("cron processar-agendados: envio de notificação e marcação SENT/FAILED ficam fora da transação principal", async () => {
  const src = await read(CRON_ROUTE);
  assert.match(src, /async function sendClaimedNotification\(/);
  assert.match(src, /notificationStatus: "SENT"/);
  assert.match(src, /notificationStatus: "FAILED"/);
});

test("cron processar-agendados: mantém autenticação x-cron-secret inalterada", async () => {
  const src = await read(CRON_ROUTE);
  assert.match(src, /const cronSecret = process\.env\.CRON_RESERVAS_SECRET;/);
  assert.match(src, /if \(!cronSecret\) \{/);
  assert.match(src, /const headerSecret = req\.headers\.get\("x-cron-secret"\) \|\| "";/);
  assert.match(src, /if \(headerSecret !== cronSecret\) \{/);
});

test("cron processar-agendados: passada de recuperação usa consulta de campo único (notificationStatus == PENDING), sem novo composite index", async () => {
  const src = await read(CRON_ROUTE);
  assert.match(src, /anunciosRef\.where\("notificationStatus", "==", "PENDING"\)/);
});

test("cron processar-agendados: log de observabilidade não contém secret nem conteúdo do comunicado (apenas contadores)", async () => {
  const src = await read(CRON_ROUTE);
  assert.match(src, /console\.log\(\s*\n?\s*"\[AN\.3\] run concluído",/);
  // Garante que o payload logado é só o objeto de contadores, não `data`/`titulo`/`mensagem`.
  const logCallMatch = src.match(/console\.log\(\s*"\[AN\.3\] run concluído",\s*JSON\.stringify\(\{([^}]*)\}\)/);
  assert.ok(logCallMatch, "deve haver exatamente um log estruturado de fim de execução");
  const loggedFields = logCallMatch![1];
  for (const forbidden of ["titulo", "mensagem", "cronSecret", "headerSecret", "secret"]) {
    assert.ok(!loggedFields.includes(forbidden), `campo "${forbidden}" não deve ser logado`);
  }
});

// --- notification idempotency ---

test("sendAnnouncementNotifications: ID do documento de notificação é determinístico (idempotente por construção)", async () => {
  const src = await read(NOTIF_LIB);
  assert.match(src, /\.collection\("notificacoes"\)\.doc\(`anuncio_\$\{anuncioId\}_\$\{uid\}`\)/);
  assert.doesNotMatch(src, /\.collection\("notificacoes"\)\.doc\(\);/, "não deve mais usar ID aleatório para notificação de anúncio");
});

test("sendAnnouncementNotifications: continua usando merge:true no set (upsert seguro em reenvio)", async () => {
  const src = await read(NOTIF_LIB);
  assert.match(src, /\}, \{ merge: true \}\);/);
});

// --- FIX.ANUNCIOS.2A.1: expiresAt alinhado ao mesmo contrato temporal de publishAt ---

test("POST /api/anuncios: expiresAt agora é parseado com parseZonedDateTimeLocal, não mais readDateFlexible", async () => {
  const src = await read(POST_ROUTE);
  assert.match(src, /expiresAtParsed = parseZonedDateTimeLocal\(expiresAt\);/);
  assert.doesNotMatch(src, /expiresAtParsed = readDateFlexible\(expiresAt\);/, "parsing de escrita não deve mais usar readDateFlexible (ambíguo quanto a timezone)");
});

test("POST /api/anuncios: readDateFlexible não é mais importado (nenhum uso restante nesta rota)", async () => {
  const src = await read(POST_ROUTE);
  assert.doesNotMatch(src, /import \{ requiresExpiresAt, readDateFlexible \}/);
  assert.match(src, /import \{ requiresExpiresAt \} from "@\/lib\/anuncios\/expiration";/);
});

test("PUT [anuncioId]: expiresAt fornecido no body agora é parseado com parseZonedDateTimeLocal, não mais readDateFlexible", async () => {
  const src = await read(PUT_ROUTE);
  assert.match(src, /expiresAtParsed = parseZonedDateTimeLocal\(body\.expiresAt\);/);
  assert.doesNotMatch(src, /expiresAtParsed = readDateFlexible\(body\.expiresAt\);/);
});

test("PUT [anuncioId]: readDateFlexible continua importado e usado — mas só para LER o Timestamp já persistido (effectiveExpiresAt), nunca para parsear um novo valor do body", async () => {
  const src = await read(PUT_ROUTE);
  assert.match(src, /import \{ requiresExpiresAt, readDateFlexible \} from "@\/lib\/anuncios\/expiration";/);
  assert.match(src, /readDateFlexible\(currentData\.expiresAt\)/);
});

test("regressão: PUT sem expiresAt no body não toca patch.expiresAt (expiresAtProvided guarda o bloco inteiro)", async () => {
  const src = await read(PUT_ROUTE);
  assert.match(src, /const expiresAtProvided = body\.expiresAt !== undefined;/);
  assert.match(src, /if \(expiresAtProvided\) \{/);
});

test("regressão: PUT com body.expiresAt explicitamente null/vazio continua limpando a expiração (patch.expiresAt = null), sem exigir parse", async () => {
  const src = await read(PUT_ROUTE);
  // if (body.expiresAt) { parse... } — bloco de parse só roda quando o
  // valor é truthy; quando expiresAtProvided=true mas body.expiresAt é
  // null/"" (falsy), expiresAtParsed permanece null e a linha abaixo
  // grava null — comportamento de "remover expiração" preservado.
  assert.match(src, /if \(body\.expiresAt\) \{\s*\n\s*expiresAtParsed = parseZonedDateTimeLocal\(body\.expiresAt\);/);
  assert.match(src, /patch\.expiresAt = expiresAtParsed \? Timestamp\.fromDate\(expiresAtParsed\) : null;/);
});

test("cron processar-expiracao: NÃO foi alterado — continua usando readDateFlexible para ler o Timestamp já persistido", async () => {
  const src = await read(path.resolve(__dirname, "../../cron/anuncios/processar-expiracao/route.ts"));
  assert.match(src, /import \{ readDateFlexible \} from "@\/lib\/anuncios\/expiration";/);
  assert.match(src, /const expiresAt = readDateFlexible\(data\.expiresAt\);/);
});

test("GET /api/anuncios (query-time expiration): NÃO foi alterado — continua interpretando expiresAt.toDate() diretamente", async () => {
  const src = await read(POST_ROUTE);
  assert.match(src, /const exp = a\.expiresAt\.toDate \? a\.expiresAt\.toDate\(\) : new Date\(a\.expiresAt\._seconds \* 1000\);/);
});
