import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
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

function isoNoonUTC(dateStr: string) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0, 0));
}

async function getActorInfo(db: any, params: { condominioId: string; uid: string; decoded: any }) {
  const { condominioId, uid, decoded } = params;
  let nome = String(decoded?.name || decoded?.email || "Usuário").trim();
  let role: string | null = null;

  try {
    const mref = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
    const msnap = await mref.get();
    if (msnap.exists) {
      const md = msnap.data() || {};
      if (md?.nome) nome = String(md.nome).trim();
      if (md?.role) role = String(md.role).trim();
    }
  } catch (e: any) {
    console.warn("[reservas/fila-assumir] getActorInfo falhou:", e?.message || String(e));
  }

  return { uid, nome, role };
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
  const snap = await membrosRef.where("status", "in", ["ATIVO", "PENDENTE"]).get();

  const ops = snap.docs
    .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((m: any) => ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(upper(m.role)));

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
    const actor = await getActorInfo(db, { condominioId, uid, decoded });

    const slotId = `${areaId}__${dateStr}`;
    const slotRef = db.collection("condominios").doc(condominioId).collection("reservasSlots").doc(slotId);
    const filaDocRef = slotRef.collection("fila").doc(uid);
    const lockRef = slotRef.collection("reservasPorUid").doc(uid);
    const reservasCol = db.collection("condominios").doc(condominioId).collection("reservas");

    let reservaNovaId = "";

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
      if (upper(fila.status) !== "OFERTADA") {
        throw Object.assign(new Error("Sua vaga ainda não está pronta para ser assumida."), { status: 409 });
      }

      const lockSnap = await tx.get(lockRef);
      if (!lockSnap.exists) {
        throw Object.assign(new Error("Seu lock da fila não foi encontrado."), { status: 409 });
      }

      const reservaRef = reservasCol.doc();
      reservaNovaId = reservaRef.id;
      const dt = new Date(`${dateStr}T12:00:00.000Z`);

      tx.set(reservaRef, {
        areaId,
        condominioId,
        uid,
        criadoPorUid: uid,
        reservaManualPorOperador: false,
        status: "PENDENTE",
        precisaAprovacao: true,
        data: Timestamp.fromDate(dt),
        dateStr,
        valorCobrado: Number(fila.valorCobrado || 0) || 0,
        opcaoId: String(fila.opcaoId || "base"),
        opcaoNome: String(fila.opcaoNome || "Base"),
        capacidadeMax: fila.capacidadeMax == null ? null : Number(fila.capacidadeMax),
        criadoEm: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        origemFila: true,
        assumidaDeOferta: true,
        ofertadaEm: fila.ofertadaEm || null,
        ofertaReservaOrigemId: fila.ofertaReservaOrigemId || null,
      });

      tx.set(slotRef, {
        occupied: true,
        reservaId: reservaRef.id,
        pendingOfferUid: null,
        pendingOfferAt: null,
        pendingOfferExpiresAt: null,
        pendingOfferReservaOrigemId: null,
        filaCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      tx.delete(filaDocRef);

      tx.set(lockRef, {
        uid,
        tipo: "RESERVA",
        areaId,
        dateStr,
        reservaId: reservaRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

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
        message: `${actor.nome} assumiu a vaga liberada${areaId ? " na área " + areaId : ""}${dateStr ? " para " + dateStr : ""}.`,
        reservaId: reservaNovaId,
        areaId,
        dateStr,
      });
    } catch (e: any) {
      console.error("[reservas/fila-assumir] falha ao notificar operadores:", e?.message || e);
    }

    return NextResponse.json({ ok: true, reservaId: reservaNovaId });
  } catch (err: any) {
    console.error("[API reservas/fila-assumir] erro:", err);
    return jsonError(err?.message || "Erro inesperado", err?.status || 500);
  }
}
