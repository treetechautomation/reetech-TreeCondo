import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { buildReservaConfirmadaEmail } from "@/lib/emailTemplates";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

// ── FASE D.5 — SHADOW MODE / FASE D.6 — DECISION DISPATCHER ────────────────
import { motorDecision } from "@/lib/reservas/policy-engine/shadow/shadowRunner";
import { dispatchReservaDecision } from "@/lib/reservas/policy-engine/dispatcher";

function upper(v: any) {
  return String(v || "").toUpperCase().trim();
}

function isOperatorRole(role: any) {
  const r = upper(role);
  return ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(r);
}

async function sendConfirmacaoEmail(params: {
  email: string;
  nomeResidente: string;
  areaNome: string;
  dateStr: string;
  opcaoNome?: string;
  condominioNome: string;
  reservaId: string;
  valorCobrado?: number;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "TreeCondo <noreply@treetechautomation.com>";
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://treecondo.treetechautomation.com";

  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY não configurada — e-mail não enviado");
    return;
  }

  const { subject, html } = buildReservaConfirmadaEmail({ ...params, appUrl });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.email],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.warn("[Email] Falha ao enviar e-mail de confirmação:", res.status, err);
  }
}

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    const body = await req.json().catch(() => ({}));
    const condominioId = String(body?.condominioId || "").trim();
    const reservaId = String(body?.reservaId || "").trim();
    const novoStatus = upper(body?.status || "APROVADA");
    const motivoRejeicao = String(body?.motivoRejeicao || "").trim() || null;

    if (!condominioId || !reservaId) return jsonError("condominioId e reservaId são obrigatórios.", 400);
    if (!["APROVADA", "REJEITADA"].includes(novoStatus)) return jsonError("Status inválido. Use APROVADA ou REJEITADA.", 400);

    const ctx = await apiGuard({ request: req, condominioId });

    if (!isOperatorRole(ctx.role) && !ctx.isSuperAdmin) {
      return jsonError("Sem permissão para aprovar/rejeitar reservas.", 403);
    }

    // Buscar reserva (antes do check de membro para ter areaId/dateStr reais)
    const reservaRef = db.collection("condominios").doc(condominioId).collection("reservas").doc(reservaId);
    const reservaSnap = await reservaRef.get();
    if (!reservaSnap.exists) return jsonError("Reserva não encontrada.", 404);

    const r = reservaSnap.data() || {};
    const statusAtual = upper(r.status || "");

    if (["APROVADA", "CANCELADA", "REJEITADA"].includes(statusAtual)) {
      return NextResponse.json({ ok: true, already: true, status: statusAtual });
    }

    // Atualizar status
    const updateData: Record<string, any> = {
      status: novoStatus,
      [`${novoStatus.toLowerCase()}Em`]: FieldValue.serverTimestamp(),
      [`${novoStatus.toLowerCase()}PorUid`]: ctx.uid,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (novoStatus === "REJEITADA" && motivoRejeicao) {
      updateData.motivoRejeicao = motivoRejeicao;
    }

    // ── FASE D.6 — DISPATCHER: Policy Engine decide antes do write ──
    {
      const approveAreaId = String(r.areaId || "");
      const approveDateStr = String(r.dateStr || "");
      const outcome = await dispatchReservaDecision(db, motorDecision({
        action: "APPROVE", allowed: true,
      }), { condominioId, areaId: approveAreaId, opcaoId: String(r.opcaoId || "base"), dateStr: approveDateStr, uid: ctx.uid, actorUid: ctx.uid, actorIsSuperAdmin: ctx.isSuperAdmin, actorRole: ctx.role || "", priceCentavos: Number(r.valorCobrado || 0), isOperatorAction: true });
      if (!outcome.allowed) {
        return jsonError(
          outcome.blockMessage || "Reserva bloqueada pelo regulamento.", 403,
        );
      }
    }

    // ── R2: com_campo — aprovação com transação cross-domain ──
    const isComCampo = String(r.opcaoId || "") === "com_campo";
    if (isComCampo) {
      const dateStr = String(r.dateStr || "");
      const agendaRef = db.collection("condominios").doc(condominioId).collection("campoAgenda").doc(dateStr);

      await db.runTransaction(async (tx: any) => {
        const agendaSnap = await tx.get(agendaRef);
        if (!agendaSnap.exists) throw new Error("Exclusividade não encontrada.");

        const agenda = agendaSnap.data() || {};
        const exc = (agenda as any).exclusividade ?? null;
        if (!exc || exc.reservaId !== reservaId || exc.status !== "HOLD") {
          throw new Error("Exclusividade não encontrada ou status inválido.");
        }

        const now = new Date();
        if (exc.expiresAt && exc.expiresAt.toDate() <= now) {
          // HOLD expirado — não aprovar
          throw new Error("O prazo de exclusividade expirou. Rejeite a reserva e oriente o morador a refazê-la.");
        }

        tx.update(reservaRef, { ...updateData });

        tx.update(agendaRef, {
          "exclusividade.status": "ATIVA",
          "exclusividade.expiresAt": null,
          version: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    } else {
      await reservaRef.update(updateData);
    }
    // Notificação in-app para o morador
    const moradorUid = String(r.uid || r.userId || r.moradorUid || r.createdByUid || "");
    if (moradorUid) {
      const notifRef = db.collection("condominios").doc(condominioId).collection("notificacoes").doc();
      const isAprovada = novoStatus === "APROVADA";
      await notifRef.set({
        tipo: isAprovada ? "RESERVA_APROVADA" : "RESERVA_REJEITADA",
        title: isAprovada ? "✅ Reserva aprovada!" : "❌ Reserva rejeitada",
        message: isAprovada
          ? `Sua reserva${r.areaId ? " da área " + r.areaId : ""} para ${r.dateStr || ""} foi aprovada.`
          : `Sua reserva${r.areaId ? " da área " + r.areaId : ""} para ${r.dateStr || ""} foi rejeitada pela administração.`,
        titulo: isAprovada ? "✅ Reserva aprovada!" : "❌ Reserva rejeitada",
        mensagem: isAprovada ? "Sua reserva foi aprovada." : "Sua reserva foi rejeitada.",
        targetUid: moradorUid,
        condominioId,
        reservaId,
        areaId: r.areaId || null,
        dateStr: r.dateStr || null,
        lida: false,
        arquivada: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // Enviar e-mail de confirmação ao morador (apenas quando aprovada)
    if (novoStatus === "APROVADA" && moradorUid) {
      try {
        // Buscar dados do morador
        const moradorAuthUser = await aauth.getUser(moradorUid).catch(() => null);
        const moradorEmail = moradorAuthUser?.email;

        if (moradorEmail) {
          // Buscar dados do membro para nome
          const membroSnap = await db.collection("condominios").doc(condominioId).collection("membros").doc(moradorUid).get();
          const membroData = membroSnap.data() || {};
          const nomeResidente = membroData.nome || moradorAuthUser?.displayName || moradorEmail;

          // Buscar nome da área
          const areaSnap = await db.collection("condominios").doc(condominioId).collection("areas").doc(r.areaId || "").get().catch(() => null);
          const areaNome = areaSnap?.data()?.nome || r.areaId || "Área Comum";

          // Buscar nome do condomínio
          const condoSnap = await db.collection("condominios").doc(condominioId).get();
          const condominioNome = condoSnap.data()?.nome || "Condomínio";

          await sendConfirmacaoEmail({
            email: moradorEmail,
            nomeResidente,
            areaNome,
            dateStr: r.dateStr || "",
            opcaoNome: r.opcaoNome,
            condominioNome,
            reservaId,
            valorCobrado: r.valorCobrado,
          });
        }
      } catch (e: any) {
        console.warn("[Email] Falha ao enviar e-mail de confirmação de reserva:", e?.message || String(e));
      }
    }

    return NextResponse.json({ ok: true, status: novoStatus });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("[API reservas/aprovar] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
