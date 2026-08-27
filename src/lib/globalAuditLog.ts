/**
 * G1.6.1 — Helper único de auditoria global (Painel Global Treetech).
 *
 * Centraliza toda escrita em globalAuditLogs/{logId}. As Rules dessa coleção
 * negam create/update/delete ao client — só o Admin SDK (server-side, aqui)
 * grava, o que é coerente com o append-only exigido.
 *
 * Reutilizado pelas APIs de Clientes a partir da G1.6.2 — não duplicar esta
 * lógica em cada rota.
 *
 * G1.6.4 (Ajuste 2 — revisão final): aceita opcionalmente uma Transaction ou
 * WriteBatch, permitindo que a escrita do log ocorra na mesma operação atômica
 * da mutação da entidade (POST e PATCH de globalClientes). Chamadas sem
 * `options` continuam funcionando exatamente como antes (escrita isolada via
 * `.add()`), preservando compatibilidade com usos existentes.
 *
 * G1.6.5 — reutilizado (sem duplicar lógica) pela API de Empresas Globais.
 * G1.7 — reutilizado (sem duplicar lógica) pela API de Produtos Globais.
 * G1.7.1 — reutilizado (sem duplicar lógica) pela API de Licenciamento Global.
 * G1.7.2 — reutilizado (sem duplicar lógica) pela API de Planos Globais.
 * G1.7.3 — reutilizado (sem duplicar lógica) pela API de Assinaturas Globais.
 * G1.7.5 — reutilizado (sem duplicar lógica) pelo Catálogo Global de Recursos.
 */
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export type GlobalAuditEntity = "GLOBAL_CLIENT" | "GLOBAL_EMPRESA" | "GLOBAL_PRODUTO" | "GLOBAL_LICENSE" | "GLOBAL_PLAN" | "GLOBAL_SUBSCRIPTION" | "GLOBAL_RESOURCE";
export type GlobalAuditSource = "API" | "SCRIPT" | "SYSTEM";

/** Campos nunca persistidos em texto claro dentro de before/after (LGPD). */
const REDACTED_SNAPSHOT_FIELDS = ["documento"] as const;

export type GlobalAuditLogInput = {
  actorUid: string;
  actorEmail?: string;
  action: string;
  entity: GlobalAuditEntity;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  correlationId?: string;
  source?: GlobalAuditSource;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeSnapshot(value: unknown): unknown {
  if (value === undefined || !isPlainObject(value)) return value;
  const sanitized: Record<string, unknown> = { ...value };
  for (const field of REDACTED_SNAPSHOT_FIELDS) {
    if (sanitized[field] !== undefined) sanitized[field] = "[REDACTED]";
  }
  return sanitized;
}

export type GlobalAuditLogOptions = {
  /** Grava dentro de uma Transaction em andamento (todos os t.get() já concluídos). */
  transaction?: FirebaseFirestore.Transaction;
  /** Grava dentro de um WriteBatch ainda não commitado. */
  batch?: FirebaseFirestore.WriteBatch;
};

/**
 * Grava um registro de auditoria. Lança erro se campos mínimos estiverem
 * ausentes — nunca grava um documento incompleto silenciosamente.
 *
 * Se `options.transaction` ou `options.batch` for informado, o log é
 * anexado a essa operação (via `.set()` num doc pré-gerado) em vez de ser
 * gravado isoladamente — garantindo atomicidade com a mutação da entidade.
 */
export async function writeGlobalAuditLog(
  input: GlobalAuditLogInput,
  options?: GlobalAuditLogOptions
): Promise<void> {
  const actorUid = String(input.actorUid || "").trim();
  const action = String(input.action || "").trim();
  const entityId = String(input.entityId || "").trim();

  if (!actorUid) throw new Error("writeGlobalAuditLog: actorUid é obrigatório.");
  if (!action) throw new Error("writeGlobalAuditLog: action é obrigatório.");
  if (!input.entity) throw new Error("writeGlobalAuditLog: entity é obrigatório.");
  if (!entityId) throw new Error("writeGlobalAuditLog: entityId é obrigatório.");

  const doc: Record<string, unknown> = {
    actorUid,
    action,
    entity: input.entity,
    entityId,
    source: input.source || "API",
    createdAt: FieldValue.serverTimestamp(),
  };

  if (input.actorEmail) doc.actorEmail = input.actorEmail;
  if (input.ip) doc.ip = input.ip;
  if (input.correlationId) doc.correlationId = input.correlationId;

  const before = sanitizeSnapshot(input.before);
  const after = sanitizeSnapshot(input.after);
  if (before !== undefined) doc.before = before;
  if (after !== undefined) doc.after = after;

  if (options?.transaction) {
    const ref = adminDb().collection("globalAuditLogs").doc();
    options.transaction.set(ref, doc);
    return;
  }

  if (options?.batch) {
    const ref = adminDb().collection("globalAuditLogs").doc();
    options.batch.set(ref, doc);
    return;
  }

  await adminDb().collection("globalAuditLogs").add(doc);
}
