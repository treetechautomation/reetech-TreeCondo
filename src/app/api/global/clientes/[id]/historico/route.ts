/**
 * G1.6.4 — Histórico de auditoria de um Cliente Global.
 *
 * GET /api/global/clientes/[id]/historico
 *
 * AJUSTE 4 (G1.6.4 — revisão final): a consulta abaixo foi testada diretamente
 * contra o Firestore de produção (Admin SDK, fora do runtime da app) em
 * 2026-08-06. Resultado: FAILED_PRECONDITION (code 9) — o Firestore exige um
 * índice composto para `globalAuditLogs` nos campos:
 *   entity ASC, entityId ASC, createdAt DESC, __name__ DESC
 *
 * Por decisão explícita do arquiteto para esta fase:
 *   - NÃO criar esse índice composto;
 *   - NÃO remover os filtros (`entity` / `entityId`) para contornar o erro;
 *   - NÃO buscar a coleção inteira / filtrar em memória como fallback;
 *   - Documentar a necessidade do índice (este comentário + relatório da fase);
 *   - Interromper SOMENTE esta funcionalidade — o restante do CRUD de Clientes
 *     Globais (listagem, criação, edição, detalhes) permanece funcional.
 *
 * A tentativa da query permanece em runtime (não hardcoded como "sempre
 * indisponível"): se um índice for criado numa fase futura aprovada pelo
 * arquiteto, esta rota volta a funcionar automaticamente, sem alteração de
 * código. Enquanto o índice não existir, retornamos um payload explícito
 * `indexRequired: true` para a UI tratar como estado "indisponível", nunca
 * como erro genérico.
 */
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

const REQUIRED_COMPOSITE_INDEX = "globalAuditLogs: entity ASC, entityId ASC, createdAt DESC";

function isMissingIndexError(e: any): boolean {
  return e?.code === 9 || /requires an index/i.test(String(e?.message || e?.details || ""));
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await apiGuard({
      request: req,
      requireSuperAdmin: true,
      rateLimit: { limit: 60, windowSec: 60 },
    });

    const id = params.id;
    const db = adminDb();

    try {
      const snap = await db
        .collection("globalAuditLogs")
        .where("entity", "==", "GLOBAL_CLIENT")
        .where("entityId", "==", id)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();

      const items = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          action: data.action,
          actorUid: data.actorUid,
          actorEmail: data.actorEmail || null,
          source: data.source,
          createdAt: data.createdAt?.toDate?.().toISOString() || null,
          before: data.before || null,
          after: data.after || null,
        };
      });

      return NextResponse.json({ ok: true, data: items, indexRequired: false });
    } catch (queryError: any) {
      if (!isMissingIndexError(queryError)) throw queryError;

      // Ver comentário de topo (AJUSTE 4): limitação estrutural documentada,
      // não um erro inesperado. Não removemos filtros nem escaneamos a coleção.
      console.warn(
        `[G1.6.4][historico] Índice composto ausente (${REQUIRED_COMPOSITE_INDEX}). ` +
          `Funcionalidade de histórico indisponível para clienteId=${id} até aprovação de índice.`
      );
      return NextResponse.json({
        ok: true,
        data: [],
        indexRequired: true,
        message:
          "Histórico indisponível nesta fase: consulta exige índice composto no Firestore " +
          `(${REQUIRED_COMPOSITE_INDEX}), que não foi criado por decisão do arquiteto (G1.6.4). ` +
          "As demais funcionalidades do módulo Clientes continuam operando normalmente.",
      });
    }
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
