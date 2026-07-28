import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { executeAceitarOfertaTx } from "@/lib/reservasAceitarOferta";
import { notifyReservasUid } from "@/lib/reservasNotificacoes";

// ── FASE D.5 — SHADOW MODE / FASE D.6-D.7 — DECISION DISPATCHER ──────────
import { motorDecision } from "@/lib/reservas/policy-engine/shadow/shadowRunner";
import { dispatchReservaDecision } from "@/lib/reservas/policy-engine/dispatcher";
import { normBloco } from "@/lib/normalization/location";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function upper(v: any) {
  return String(v || "").toUpperCase().trim();
}


function toDateSafe(v: any): Date | null {
  try {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v?.toDate === "function") return v.toDate();
    if (typeof v?._seconds === "number") return new Date(v._seconds * 1000);
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const decoded = await aauth.verifyIdToken(token);
    const body = await req.json().catch(() => ({}));

    const condominioId = String(body?.condominioId || "").trim();
    const areaId = String(body?.areaId || "").trim();
    const dateStr = String(body?.dateStr || "").trim();

    if (!condominioId || !areaId || !dateStr) {
      return jsonError("condominioId, areaId e dateStr são obrigatórios.", 400);
    }

    const uid = String(decoded.uid);

    if (!(decoded as any)?.super_admin && !(decoded as any)?.superAdmin) {
      const membroCheck = await db
        .collection("condominios")
        .doc(condominioId)
        .collection("membros")
        .doc(uid)
        .get();
      const membroStatus = upper((membroCheck.data() || {}).status || "");
      if (!membroCheck.exists || membroStatus !== "ATIVO") {
        // D.7: dispatcher (auditoria); bloco operacional garantido.
        await dispatchReservaDecision(db, motorDecision({
          action: "OFFER_ACCEPT", allowed: false,
          blockRule: "MEMBRO_INATIVO", blockPriority: "BLOCKER",
          blockMessage: "Membro inativo.",
          blockOrigin: "CONDOMINIO",
        }), { condominioId, areaId, opcaoId: "base", dateStr, uid, actorUid: String(decoded.uid), actorIsSuperAdmin: false, actorRole: "", priceCentavos: 0, isOperatorAction: false });
        return jsonError("Membro inativo.", 403);
      }
    }

    const areaSnap = await db
      .collection("condominios")
      .doc(condominioId)
      .collection("areasReservaveis")
      .doc(areaId)
      .get();
    const area = areaSnap.exists ? (areaSnap.data() || {}) : null;
    if (!area || !area.ativo) {
      // D.7: dispatcher (auditoria); bloco operacional garantido.
      await dispatchReservaDecision(db, motorDecision({
        action: "OFFER_ACCEPT", allowed: false,
        blockRule: "AREA_INATIVA", blockPriority: "BLOCKER",
        blockMessage: "Área não encontrada ou desativada.",
        blockOrigin: "AREA",
      }), { condominioId, areaId, opcaoId: "base", dateStr, uid, actorUid: String(decoded.uid), actorIsSuperAdmin: false, actorRole: "", priceCentavos: 0, isOperatorAction: false });
      return jsonError("Área não encontrada ou desativada.", 404);
    }

    if (
      area.escopoReserva === "BLOCO" &&
      Array.isArray(area.blocosPermitidos) &&
      area.blocosPermitidos.length > 0
    ) {
      const membroCheck = await db
        .collection("condominios")
        .doc(condominioId)
        .collection("membros")
        .doc(uid)
        .get();
      const md = membroCheck.exists ? (membroCheck.data() || {}) : {};
      const membroBlocoNorm =
        md.blocoIdNorm || normBloco(md.blocoId || md.bloco);
      if (!membroBlocoNorm || !area.blocosPermitidos.includes(membroBlocoNorm)) {
        // D.7: dispatcher (auditoria + decisão); bloco operacional garantido.
        const outcome = await dispatchReservaDecision(db, motorDecision({
          action: "OFFER_ACCEPT", allowed: false,
          blockRule: "BLOCO_NAO_PERMITIDO", blockPriority: "BLOCKER",
          blockMessage: "Esta área é exclusiva para moradores de outro bloco.",
          blockOrigin: "AREA",
        }), { condominioId, areaId, opcaoId: "base", dateStr, uid, actorUid: String(decoded.uid), actorIsSuperAdmin: false, actorRole: "", priceCentavos: 0, isOperatorAction: false, memberFactsOverride: { blocoIdNorm: membroBlocoNorm } });
        if (!outcome.allowed) return jsonError("Esta área é exclusiva para moradores de outro bloco.", 403);
      }
    }

    // ── FASE D.7 — DISPATCHER: Policy Engine decide antes do write ──
    {
      const outcome = await dispatchReservaDecision(db, motorDecision({
        action: "OFFER_ACCEPT", allowed: true,
      }), { condominioId, areaId, opcaoId: "base", dateStr, uid, actorUid: String(decoded.uid), actorIsSuperAdmin: false, actorRole: "", priceCentavos: 0, isOperatorAction: false });
      if (!outcome.allowed) {
        return jsonError(
          outcome.blockMessage || "Aceite bloqueado pelo regulamento.", 403,
        );
      }
    }

    const slotId = `${areaId}__${dateStr}`;
    const slotRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("reservasSlots")
      .doc(slotId);
    const filaDocRef = slotRef.collection("fila").doc(uid);
    const lockRef = slotRef.collection("reservasPorUid").doc(uid);
    const reservasCol = db
      .collection("condominios")
      .doc(condominioId)
      .collection("reservas");

    let result: { reservaId: string; gerouFinanceiro: boolean };

    await db.runTransaction(async (tx: any) => {
      const slotSnap = await tx.get(slotRef);
      if (!slotSnap.exists) {
        throw Object.assign(new Error("Slot da área não encontrado."), { status: 404 });
      }

      const slot = slotSnap.data() || {};

      if (String(slot.pendingOfferUid || "") !== uid) {
        throw Object.assign(
          new Error("Esta vaga não está ofertada para você."),
          { status: 409 },
        );
      }

      const expiresAt = toDateSafe(slot.pendingOfferExpiresAt);
      if (expiresAt && Date.now() > expiresAt.getTime()) {
        throw Object.assign(new Error("Sua oferta expirou."), { status: 409 });
      }

      const filaSnap = await tx.get(filaDocRef);
      if (!filaSnap.exists) {
        throw Object.assign(new Error("Seu registro na fila não foi encontrado."), { status: 404 });
      }

      const fila = filaSnap.data() || {};
      if (upper(fila.status) !== "OFERTA_PENDENTE") {
        throw Object.assign(
          new Error("Sua oferta não está mais disponível."),
          { status: 409 },
        );
      }

      const lockSnap = await tx.get(lockRef);
      if (!lockSnap.exists) {
        throw Object.assign(
          new Error("Seu lock da fila não foi encontrado."),
          { status: 409 },
        );
      }

      const membroSnap = await tx.get(
        db.collection("condominios").doc(condominioId).collection("membros").doc(uid),
      );
      const membro = membroSnap.exists ? (membroSnap.data() || {}) : {};

      result = await executeAceitarOfertaTx(tx, {
        db,
        condominioId,
        areaId,
        dateStr,
        uid,
        area,
        membro,
        fila,
        slotRef,
        filaDocRef,
        lockRef,
        reservasCol,
        modo: "ACEITA",
      });
    });

    const areaNome = String(area.nome || areaId);

    notifyReservasUid(db, {
      condominioId,
      targetUid: uid,
      tipo: "OFERTA_ACEITA",
      title: "Reserva confirmada",
      message: `Sua reserva para ${areaNome} no dia ${dateStr} foi confirmada.`,
      reservaId: result!.reservaId,
      areaId,
      dateStr,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      reservaId: result!.reservaId,
      gerouFinanceiro: result!.gerouFinanceiro,
    });
  } catch (err: any) {
    console.error("[API reservas/fila/aceitar] erro:", err);
    return jsonError(
      err?.message || "Erro inesperado",
      err?.status || 500,
    );
  }
}
