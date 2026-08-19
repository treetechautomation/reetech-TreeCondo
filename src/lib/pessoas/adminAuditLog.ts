/**
 * REV.1 — AUDITORIA ADMINISTRATIVA TENANT-SCOPED
 *
 * Este repositório não tem nenhuma infraestrutura de audit log pré-existente
 * (confirmado: zero ocorrências de auditLog/AuditLog/activityLog/ActivityLog
 * em src/ e functions/src/, e nenhuma coleção correspondente em
 * firestore.rules). A convenção real do schema para dados subordinados a um
 * condomínio é a subcoleção tenant-nested (ex.:
 * condominios/{condominioId}/incidentes/{id}/historico/{histId}).
 *
 * Este módulo segue essa mesma convenção: grava em
 * condominios/{condominioId}/adminAuditLogs/{autoId}, escopado ao tenant —
 * nunca uma coleção global — via Admin SDK (bypassa firestore.rules; regra
 * de leitura restrita a quem gerencia o condomínio ou SUPER_ADMIN foi
 * adicionada em firestore.rules).
 */

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export type AdminAuditEntity = "MEMBRO";

export type AdminAuditSource = "API" | "SCRIPT" | "SYSTEM";

export interface AdminAuditLogEntry {
  actorUid: string;
  actorEmail?: string | null;
  action: string;
  entity: AdminAuditEntity;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  source: AdminAuditSource;
}

/**
 * Grava uma entrada de auditoria administrativa escopada ao condomínio
 * informado. Não lança em caso de falha de escrita — auditoria não deve
 * derrubar uma operação principal já concluída; o erro é logado no console
 * para investigação.
 */
export async function writeAdminAuditLog(
  condominioId: string,
  entry: AdminAuditLogEntry,
): Promise<void> {
  try {
    const db = adminDb();
    await db
      .collection("condominios")
      .doc(condominioId)
      .collection("adminAuditLogs")
      .add({
        actorUid: entry.actorUid,
        actorEmail: entry.actorEmail ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: entry.before ?? null,
        after: entry.after ?? null,
        source: entry.source,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.error("[adminAuditLog] Falha ao gravar entrada de auditoria:", err);
  }
}
