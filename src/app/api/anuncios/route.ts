/**
 * AN.2 — API DE ANÚNCIOS (server-side)
 *
 * GET  /api/anuncios?condominioId=... → listar
 * POST /api/anuncios → criar
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { requiresExpiresAt } from "@/lib/anuncios/expiration";
import { parseZonedDateTimeLocal } from "@/lib/anuncios/scheduling";

import type { GuardRole } from "@/lib/apiGuard";
const MANAGERS: GuardRole[] = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: [...MANAGERS, "PORTEIRO", "ZELADOR", "MORADOR"],
    });

    const db = adminDb();
    const isManager = ctx.isSuperAdmin || MANAGERS.includes(ctx.role as GuardRole);

    const snap = await db.collection("condominios").doc(condominioId)
      .collection("anuncios").orderBy("createdAt", "desc").get();

    let anuncios = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));

    if (isManager) {
      return NextResponse.json({ ok: true, anuncios, isManager: true, role: ctx.role });
    }

    const now = new Date();
    const md = ctx.membroData || {};
    const pessoaId = String(md.pessoaId || "");

    // Resolve resident's blocos via VinculoUnidade
    const residentBlocos = new Set<string>();
    if (pessoaId) {
      try {
        const vincSnap = await db.collection("condominios").doc(condominioId)
          .collection("vinculosUnidades")
          .where("pessoaId", "==", pessoaId)
          .where("status", "==", "ATIVO")
          .where("resideNaUnidade", "==", true)
          .get();
        vincSnap.docs.forEach(d => {
          const v = d.data() || {};
          if (v.blocoId) residentBlocos.add(String(v.blocoId));
        });
      } catch { /* ignore */ }
    }

    // Legacy fallback: if no VinculoUnidade, try membro.blocoId
    if (residentBlocos.size === 0 && !ctx.isSuperAdmin) {
      try {
        const membroSnap = await db.collection("condominios").doc(condominioId)
          .collection("membros").doc(ctx.uid).get();
        if (membroSnap.exists) {
          const membroMd = membroSnap.data() || {};
          if (membroMd.blocoId) residentBlocos.add(String(membroMd.blocoId));
        }
      } catch { /* ignore */ }
    }

    anuncios = anuncios.filter((a: any) => {
      const status = a.status || "PUBLICADO";
      if (status !== "PUBLICADO") return false;

      if (a.expiresAt) {
        try {
          const exp = a.expiresAt.toDate ? a.expiresAt.toDate() : new Date(a.expiresAt._seconds * 1000);
          if (exp <= now) return false;
        } catch { /* ignore */ }
      }

      if (a.publishAt) {
        try {
          const pub = a.publishAt.toDate ? a.publishAt.toDate() : new Date(a.publishAt._seconds * 1000);
          if (pub > now) return false;
        } catch { /* ignore */ }
      }

      const scope = String(a.targetScope || "CONDOMINIO").toUpperCase();
      if (scope !== "BLOCO") return true;

      const blocoId = String(a.targetBlocoId || "");
      return blocoId ? residentBlocos.has(blocoId) : true;
    });

    return NextResponse.json({ ok: true, anuncios, isManager: false, role: ctx.role });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as any;
    const condominioId = String(body.condominioId || "").trim();
    const titulo = String(body.titulo || "").trim();
    const mensagem = String(body.mensagem || "").trim();
    const targetScope = String(body.targetScope || "CONDOMINIO").toUpperCase();
    const targetBlocoId = targetScope === "BLOCO" ? String(body.targetBlocoId || "").trim() : null;
    const status = String(body.status || "RASCUNHO").toUpperCase();
    const publishAt = body.publishAt || null;
    const expiresAt = body.expiresAt || null;

    if (!condominioId) return jsonError("condominioId obrigatório", 400);
    if (!titulo) return jsonError("titulo obrigatório", 400);
    if (!mensagem) return jsonError("mensagem obrigatória", 400);
    if (!["CONDOMINIO", "BLOCO"].includes(targetScope)) return jsonError("targetScope inválido", 400);
    if (!["RASCUNHO", "AGENDADO", "PUBLICADO"].includes(status)) return jsonError("status inválido", 400);
    if (targetScope === "BLOCO" && !targetBlocoId) return jsonError("targetBlocoId obrigatório para BLOCO", 400);
    if (status === "AGENDADO" && !publishAt) return jsonError("publishAt obrigatório para AGENDADO", 400);

    // FIX.ANUNCIOS.2A: publishAt chega como string "datetime-local" (sem
    // timezone) e precisa ser normalizado para um instante absoluto antes
    // de ser persistido — ver src/lib/anuncios/scheduling.ts para o
    // contrato temporal completo. Nunca aceitar silenciosamente um valor
    // não-parseável quando o status exige agendamento.
    let publishAtParsed: Date | null = null;
    if (publishAt) {
      publishAtParsed = parseZonedDateTimeLocal(publishAt);
      if (!publishAtParsed) return jsonError("publishAt inválido.", 400);
    }
    if (status === "AGENDADO" && !publishAtParsed) return jsonError("publishAt obrigatório para AGENDADO", 400);

    // FEATURE.ANUNCIOS.1: expiração é obrigatória para publicar/agendar.
    // RASCUNHO continua podendo ficar incompleto (comportamento já suportado).
    // FIX.ANUNCIOS.2A.1: expiresAt chega como a mesma string datetime-local
    // (sem timezone) que publishAt — usa o mesmo contrato temporal
    // explícito (America/Sao_Paulo), não mais o parsing ambíguo de
    // readDateFlexible (que interpretaria a string pelo timezone do host,
    // UTC, gerando um desvio de 3h em relação à intenção do operador).
    let expiresAtParsed: Date | null = null;
    if (expiresAt) {
      expiresAtParsed = parseZonedDateTimeLocal(expiresAt);
      if (!expiresAtParsed) return jsonError("Expiração inválida.", 400);
    }
    if (requiresExpiresAt(status)) {
      if (!expiresAtParsed) return jsonError("Expiração é obrigatória para publicar ou agendar um anúncio.", 400);
      if (expiresAtParsed.getTime() <= Date.now()) return jsonError("Expiração deve ser uma data futura.", 400);
    }
    if (expiresAtParsed && publishAtParsed && expiresAtParsed <= publishAtParsed) return jsonError("expiresAt deve ser posterior a publishAt", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: MANAGERS,
    });

    const db = adminDb();

    // Validate bloco if BLOCO scope
    let targetBlocoNome: string | null = null;
    if (targetScope === "BLOCO" && targetBlocoId) {
      const blocoSnap = await db.collection("condominios").doc(condominioId)
        .collection("blocos").doc(targetBlocoId).get();
      if (!blocoSnap.exists) return jsonError("Bloco não encontrado.", 404);
      const bd = blocoSnap.data() || {};
      if (bd.ativo === false) return jsonError("Bloco inativo.", 400);
      targetBlocoNome = String(bd.nome || bd.blocoNome || targetBlocoId);
    }

    const publishedAt = status === "PUBLICADO" ? FieldValue.serverTimestamp() : null;

    const ref = db.collection("condominios").doc(condominioId).collection("anuncios").doc();
    const data: Record<string, any> = {
      titulo, mensagem,
      targetScope, targetBlocoId: targetBlocoId || null, targetBlocoNome,
      status, publishAt: publishAtParsed ? Timestamp.fromDate(publishAtParsed) : null, publishedAt,
      expiresAt: expiresAtParsed ? Timestamp.fromDate(expiresAtParsed) : null,
      archivedAt: null,
      createdByUid: ctx.uid,
      updatedByUid: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await ref.set(data);

    // AN.3: Send notifications if published now
    let notified = 0;
    let audienceCount = 0;
    if (status === "PUBLICADO") {
      try {
        const { sendAnnouncementNotifications, resolveAnnouncementRecipients } = await import("@/lib/notifications/anuncios");
        audienceCount = (await resolveAnnouncementRecipients(condominioId, targetScope, targetBlocoId)).length;
        const result = await sendAnnouncementNotifications(condominioId, ref.id, titulo, targetScope, targetBlocoId);
        notified = result.notified;
        await ref.update({ audienceCount, notificationSentAt: FieldValue.serverTimestamp() });
      } catch (e: any) {
        console.error("[AN.3] Falha ao notificar:", e?.message || e);
      }
    }

    return NextResponse.json({ ok: true, anuncioId: ref.id, status, titulo, notified, audienceCount });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
