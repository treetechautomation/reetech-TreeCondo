/**
 * ENCOMENDAS.2F — GET /api/encomendas/[id]/auditoria?condominioId=...
 *
 * Leitura server-autorizada da cadeia de custódia de uma encomenda:
 * quem registrou, quem retirou/confirmou, e o histórico de eventos
 * seguros (sem PIN/QR/hash). Nenhuma leitura direta de Firestore no
 * client — a subcoleção events permanece bloqueada nas rules (2B/2F).
 */
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { resolveEncomendaAuditAuthorization } from "@/lib/encomendas/auditAuthorization";
import { buildEncomendaAuditProjection } from "@/lib/encomendas/auditProjection";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const encomendaId = String(ctx.params.id || "").trim();
    if (!encomendaId) return jsonError("id é obrigatório", 400);

    const url = new URL(req.url);
    const condominioId = String(url.searchParams.get("condominioId") || "").trim();
    if (!condominioId) return jsonError("condominioId é obrigatório", 400);

    // Sem allowedRoles: MORADOR precisa passar pelo apiGuard (vínculo
    // ATIVO no condomínio) para então ser avaliado por unidade abaixo.
    const authCtx = await apiGuard({ request: req, condominioId });

    const db = adminDb();
    const ref = db.collection("condominios").doc(condominioId).collection("encomendas").doc(encomendaId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Encomenda não encontrada.", 404);

    const data = snap.data() as any;
    if (data?.condominioId && String(data.condominioId) !== condominioId) {
      return jsonError("Encomenda não pertence a este condomínio.", 403);
    }

    const authorization = resolveEncomendaAuditAuthorization({
      isSuperAdmin: authCtx.isSuperAdmin,
      role: authCtx.role,
      membroData: authCtx.membroData
        ? {
            status: authCtx.membroData.status,
            unidadeIdNorm: authCtx.membroData.unidadeIdNorm,
            blocoIdNorm: authCtx.membroData.blocoIdNorm,
          }
        : null,
      encomenda: {
        unidadeIdNorm: data?.unidadeIdNorm ?? null,
        blocoIdNorm: data?.blocoIdNorm ?? null,
      },
    });

    if (!authorization.allowed) {
      return jsonError("Você não tem permissão para consultar a auditoria desta encomenda.", 403);
    }

    const eventsSnap = await ref.collection("events").orderBy("timestamp", "asc").get();
    const events = eventsSnap.docs.map((d) => d.data());

    const projection = buildEncomendaAuditProjection(encomendaId, condominioId, data, events);

    return NextResponse.json({ ok: true, auditoria: projection });
  } catch (err: any) {
    if (err instanceof Response) return err;
    return jsonError(err?.message || "Erro inesperado.", Number(err?.status) || 500);
  }
}
