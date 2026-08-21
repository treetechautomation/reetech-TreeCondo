import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { executeAceitarOfertaTx } from "@/lib/reservasAceitarOferta";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

// ── FASE D.5 — SHADOW MODE / FASE D.6-D.7 — DECISION DISPATCHER ──────────
import {
  motorDecision,
} from "@/lib/reservas/policy-engine/shadow/shadowRunner";
import { dispatchReservaDecision } from "@/lib/reservas/policy-engine/dispatcher";
import { normBloco } from "@/lib/normalization/location";


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

function isoNoonUTC(dateStr: string) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0, 0));
}

async function notifyOperadores(db: any, params: {
  condominioId: string;
  title: string;
  message: string;
  tipo: string;
  reservaId: string;
  areaId?: string | null;
  dateStr?: string | null;
}) {
  const condId = params.condominioId;
  if (!condId) return;

  const membrosRef = db.collection("condominios").doc(condId).collection("membros");
  const snap = await membrosRef.where("status", "in", ["ATIVO"]).get();

  const ops = snap.docs
    .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((m: any) => ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(String(m.role || "").toUpperCase().trim()));

  if (!ops.length) return;

  const batch = db.batch();
  for (const m of ops) {
    const ref = db.collection("condominios").doc(condId).collection("notificacoes").doc();
    batch.set(ref, {
      tipo: params.tipo,
      title: params.title,
      message: params.message,
      titulo: params.title,
      mensagem: params.message,
      targetUid: String(m.id),
      condominioId: condId,
      reservaId: params.reservaId,
      areaId: params.areaId ?? null,
      dateStr: params.dateStr ?? null,
      lida: false,
      arquivada: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  await batch.commit();
}

async function notifyUid(db: any, params: {
  condominioId: string;
  targetUid: string;
  tipo: string;
  title: string;
  message: string;
  reservaId: string;
  areaId?: string | null;
  dateStr?: string | null;
}) {
  const condId = params.condominioId;
  if (!condId || !params.targetUid) return;

  const ref = db.collection("condominios").doc(condId).collection("notificacoes").doc();
  await ref.set({
    tipo: params.tipo,
    title: params.title,
    message: params.message,
    titulo: params.title,
    mensagem: params.message,
    targetUid: params.targetUid,
    condominioId: condId,
    reservaId: params.reservaId,
    areaId: params.areaId ?? null,
    dateStr: params.dateStr ?? null,
    lida: false,
    arquivada: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

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

    const areaSnap = await db.collection("condominios").doc(condominioId).collection("areasReservaveis").doc(areaId).get();
    const area = areaSnap.exists ? (areaSnap.data() || {}) : null;
    if (!area || !area.ativo) {
      // D.7: dispatcher (auditoria + decisão); bloco operacional garantido.
      await dispatchReservaDecision(db, motorDecision({
        action: "OFFER_ACCEPT", allowed: false,
        blockRule: "AREA_INATIVA", blockPriority: "BLOCKER",
        blockMessage: "Área não encontrada ou desativada.",
        blockOrigin: "AREA",
      }), { condominioId, areaId, opcaoId: "base", dateStr, uid, actorUid: uid, actorIsSuperAdmin: ctx.isSuperAdmin, actorRole: ctx.role || "", priceCentavos: 0, isOperatorAction: false });
      return jsonError("Área não encontrada ou desativada.", 404);
    }

    if (area.escopoReserva === "BLOCO" && Array.isArray(area.blocosPermitidos) && area.blocosPermitidos.length > 0) {
      const md = ctx.membroData || {};
      const membroBlocoNorm = String(md.blocoIdNorm || normBloco(md.blocoId || md.bloco) || "");
      if (!membroBlocoNorm || !area.blocosPermitidos.includes(membroBlocoNorm)) {
        // D.7: dispatcher (auditoria + decisão); bloco operacional garantido.
        const outcome = await dispatchReservaDecision(db, motorDecision({
          action: "OFFER_ACCEPT", allowed: false,
          blockRule: "BLOCO_NAO_PERMITIDO", blockPriority: "BLOCKER",
          blockMessage: "Esta área é exclusiva para moradores de outro bloco.",
          blockOrigin: "AREA",
        }), { condominioId, areaId, opcaoId: "base", dateStr, uid, actorUid: uid, actorIsSuperAdmin: ctx.isSuperAdmin, actorRole: ctx.role || "", priceCentavos: 0, isOperatorAction: false, memberFactsOverride: { blocoIdNorm: membroBlocoNorm } });
        if (!outcome.allowed) return jsonError("Esta área é exclusiva para moradores de outro bloco.", 403);
      }
    }

    // ── FASE D.7 — DISPATCHER: Policy Engine decide antes do write ──
    {
      const outcome = await dispatchReservaDecision(db, motorDecision({
        action: "OFFER_ACCEPT", allowed: true,
      }), { condominioId, areaId, opcaoId: "base", dateStr, uid, actorUid: uid, actorIsSuperAdmin: ctx.isSuperAdmin, actorRole: ctx.role || "", priceCentavos: 0, isOperatorAction: false });
      if (!outcome.allowed) {
        return jsonError(
          outcome.blockMessage || "Aceite bloqueado pelo regulamento.", 403,
        );
      }
    }

    const slotId = `${areaId}__${dateStr}`;
    const slotRef = db.collection("condominios").doc(condominioId).collection("reservasSlots").doc(slotId);
    const filaDocRef = slotRef.collection("fila").doc(uid);
    const lockRef = slotRef.collection("reservasPorUid").doc(uid);
    const reservasCol = db.collection("condominios").doc(condominioId).collection("reservas");

    let reservaNovaId = "";
    let gerouFinanceiro = false;

    await db.runTransaction(async (tx: any) => {
      const slotSnap = await tx.get(slotRef);
      if (!slotSnap.exists) {
        throw Object.assign(new Error("Slot da área não encontrado."), { status: 404 });
      }

      const slot = slotSnap.data() || {};
      if (String(slot.pendingOfferUid || "") !== uid) {
        throw Object.assign(new Error("Esta vaga não está ofertada para você."), { status: 409 });
      }

      const expiresAt = toDateSafe(slot.pendingOfferExpiresAt);
      if (expiresAt && Date.now() > expiresAt.getTime()) {
        throw Object.assign(new Error("A oferta desta vaga expirou."), { status: 409 });
      }

      const filaSnap = await tx.get(filaDocRef);
      if (!filaSnap.exists) {
        throw Object.assign(new Error("Seu registro na fila não foi encontrado."), { status: 404 });
      }

      const fila = filaSnap.data() || {};
      const filaStatusNorm = String(fila.status || "").toUpperCase().trim();
      if (filaStatusNorm !== "OFERTADA" && filaStatusNorm !== "OFERTA_PENDENTE") {
        throw Object.assign(new Error("Sua vaga ainda não está pronta para ser assumida."), { status: 409 });
      }

      const lockSnap = await tx.get(lockRef);
      if (!lockSnap.exists) {
        throw Object.assign(new Error("Seu lock da fila não foi encontrado."), { status: 409 });
      }

      const membroSnap = await tx.get(
        db.collection("condominios").doc(condominioId).collection("membros").doc(uid),
      );
      const membro = membroSnap.exists ? (membroSnap.data() || {}) : {};

      const txResult = await executeAceitarOfertaTx(tx, {
        db,
        condominioId,
        areaId,
        dateStr,
        uid,
        area: area || {},
        membro,
        fila,
        slotRef,
        filaDocRef,
        lockRef,
        reservasCol,
        modo: "OFERTADA",
      });

      reservaNovaId = txResult.reservaId;
      gerouFinanceiro = txResult.gerouFinanceiro;
    });

    const actorNome = ctx.membroData?.nome || ctx.decodedToken?.name || ctx.email || "Usuário";

    try {
      await notifyUid(db, {
        condominioId,
        targetUid: uid,
        tipo: "RESERVA_FILA_ASSUMIDA",
        title: "✅ Você assumiu a vaga liberada",
        message: `Sua reserva foi criada com sucesso${areaId ? " na área " + areaId : ""}${dateStr ? " para " + dateStr : ""}.`,
        reservaId: reservaNovaId,
        areaId,
        dateStr,
      });
    } catch (e: any) {
      console.error("[reservas/fila-assumir] falha ao notificar morador:", e?.message || e);
    }

    try {
      await notifyOperadores(db, {
        condominioId,
        tipo: "RESERVA_FILA_ASSUMIDA",
        title: "✅ Vaga da fila assumida",
        message: `${actorNome} assumiu a vaga liberada${areaId ? " na área " + areaId : ""}${dateStr ? " para " + dateStr : ""}.`,
        reservaId: reservaNovaId,
        areaId,
        dateStr,
      });
    } catch (e: any) {
      console.error("[reservas/fila-assumir] falha ao notificar operadores:", e?.message || e);
    }

    return NextResponse.json({ ok: true, reservaId: reservaNovaId });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("[API reservas/fila-assumir] erro:", err);
    return jsonError(err?.message || "Erro inesperado", err?.status || 500);
  }
}
