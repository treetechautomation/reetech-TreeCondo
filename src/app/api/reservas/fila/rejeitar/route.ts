import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { promoverFilaAposCancelamento } from "@/lib/reservasPromocaoFila";
import { notifyReservasUid } from "@/lib/reservasNotificacoes";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

// ── FASE D.5 — SHADOW MODE / FASE D.6-D.7 — DECISION DISPATCHER ──────────
import { motorDecision } from "@/lib/reservas/policy-engine/shadow/shadowRunner";
import { dispatchReservaDecision } from "@/lib/reservas/policy-engine/dispatcher";

export async function POST(req: Request) {
  const db = adminDb();

  try {
    const body = await req.json().catch(() => ({}));

    const condominioId = String(body?.condominioId || "").trim();
    const areaId = String(body?.areaId || "").trim();
    const dateStr = String(body?.dateStr || "").trim();

    if (!condominioId || !areaId || !dateStr) {
      return jsonError("condominioId, areaId e dateStr são obrigatórios.", 400);
    }

    const ctx = await apiGuard({ request: req, condominioId });
    const uid = ctx.uid;

    // ── FASE D.7 — DISPATCHER: Policy Engine decide antes do write ──
    {
      const outcome = await dispatchReservaDecision(db, motorDecision({
        action: "OFFER_REJECT", allowed: true,
      }), { condominioId, areaId, opcaoId: "base", dateStr, uid, actorUid: uid, actorIsSuperAdmin: ctx.isSuperAdmin, actorRole: ctx.role || "", priceCentavos: 0, isOperatorAction: false });
      if (!outcome.allowed) {
        return jsonError(
          outcome.blockMessage || "Rejeição bloqueada pelo regulamento.", 403,
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

    let resourceId: string;
    let reservaOrigemId: string;

    await db.runTransaction(async (tx: any) => {
      // 1. Reler slot
      const slotSnap = await tx.get(slotRef);
      if (!slotSnap.exists) {
        throw Object.assign(new Error("Slot da área não encontrado."), { status: 404 });
      }

      const slot = slotSnap.data() || {};

      // 2. Confirmar pendingOfferUid
      if (String(slot.pendingOfferUid || "") !== uid) {
        throw Object.assign(
          new Error("Esta vaga não está ofertada para você."),
          { status: 409 },
        );
      }

      // 3. Ler fila
      const filaSnap = await tx.get(filaDocRef);
      if (!filaSnap.exists) {
        throw Object.assign(new Error("Seu registro na fila não foi encontrado."), { status: 404 });
      }

      const filaStatus = String((filaSnap.data() || {}).status || "").toUpperCase().trim();

      // 4. Confirmar status == OFERTA_PENDENTE
      if (filaStatus !== "OFERTA_PENDENTE") {
        throw Object.assign(
          new Error("Sua oferta não está mais disponível."),
          { status: 409 },
        );
      }

      resourceId = areaId;
      reservaOrigemId = String(slot.pendingOfferReservaOrigemId || "");

      // 5. Fila → RECUSADA
      tx.set(
        filaDocRef,
        {
          status: "RECUSADA",
          recusadaEm: FieldValue.serverTimestamp(),
          recusadaPorUid: uid,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      // 6. Limpar pendingOffer*
      tx.set(
        slotRef,
        {
          pendingOfferUid: FieldValue.delete(),
          pendingOfferAt: FieldValue.delete(),
          pendingOfferExpiresAt: FieldValue.delete(),
          pendingOfferReservaOrigemId: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });

    // PÓS-COMMIT: promover próximo da fila
    let promotedUid: string | null = null;
    try {
      promotedUid = await promoverFilaAposCancelamento(db, {
        condominioId,
        areaId,
        dateStr,
        resourceId: resourceId!,
        reservaId: reservaOrigemId!,
        isComposite: false,
      });
    } catch (e: any) {
      console.error(
        "[reservas/fila/rejeitar] Falha ao promover fila:",
        e?.message || e,
      );
    }

    notifyReservasUid(db, {
      condominioId,
      targetUid: uid,
      tipo: "OFERTA_RECUSADA",
      title: "Oferta recusada",
      message: `Você recusou a vaga disponível para ${areaId} no dia ${dateStr}.`,
      areaId,
      dateStr,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      recusada: true,
      promotedUid: promotedUid || undefined,
    });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("[API reservas/fila/rejeitar] erro:", err);
    return jsonError(
      err?.message || "Erro inesperado",
      err?.status || 500,
    );
  }
}
