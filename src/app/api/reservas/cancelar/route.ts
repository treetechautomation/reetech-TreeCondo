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

function isOperatorRole(role: any) {
  const r = upper(role);
  return ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(r);
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

async function getActorInfo(db: any, params: { condominioId: string; uid: string; decoded: any }) {
  const { condominioId, uid, decoded } = params;
  const email = String(decoded?.email || "").toLowerCase();
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
    console.warn("[reservas/cancelar] getActorInfo falhou:", e?.message || String(e));
  }

  return { uid, email, nome, role };
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

  // Não dá pra fazer "in" com muitos sem índice/limites, então buscamos "ATIVO" e filtramos em memória
  const snap = await membrosRef.where("status", "in", ["ATIVO", "PENDENTE"]).get();

  const ops = snap.docs
    .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((m: any) => isOperatorRole(m.role));

  if (!ops.length) return;

  const batch = db.batch();
  for (const m of ops) {
    const uid = m.id;
    const ref = db.collection("condominios").doc(condId).collection("notificacoes").doc();
    batch.set(ref, {
      tipo: params.tipo,
      title: params.title,
      message: params.message,
      titulo: params.title,
      mensagem: params.message,
      targetUid: uid,
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
    const reservaId = String(body?.reservaId || "").trim();

    if (!condominioId || !reservaId) return jsonError("condominioId e reservaId são obrigatórios.", 400);

    const actor = await getActorInfo(db, { condominioId, uid: decoded.uid, decoded });
    const isOperador = isOperatorRole(actor.role) || (decoded as any)?.super_admin === true || (decoded as any)?.superAdmin === true;

    const ref = db.collection("condominios").doc(condominioId).collection("reservas").doc(reservaId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Reserva não encontrada.", 404);

    const r = snap.data() || {};
    const ownerUids = [
      r.uid, r.userId, r.moradorUid, r.createdByUid,
      (r.createdBy && r.createdBy.uid) ? r.createdBy.uid : null,
    ].filter(Boolean).map((v: any) => String(v));

    const isOwner = ownerUids.includes(String(decoded.uid));

    if (!isOperador && !isOwner) {
      return jsonError("Sem permissão para cancelar esta reserva.", 403);
    }

    const st = upper(r.status);
    if (st === "CANCELADA") return NextResponse.json({ ok: true, already: true });

    // Regra 48h (mínimo antes da data da reserva)
    const cancelamentoMinHoras = 48; // depois podemos ler do doc de config se você quiser
    const dtReserva = toDateSafe(r.data);
    if (!dtReserva) return jsonError("Reserva sem campo data válido.", 400);

    const agora = new Date();
    const limite = new Date(dtReserva.getTime() - cancelamentoMinHoras * 60 * 60 * 1000);

    // operador pode cancelar mesmo fora do prazo (se você quiser restringir, a gente muda)
    if (!isOperador && agora > limite) {
      return jsonError(`Cancelamento permitido somente até ${cancelamentoMinHoras}h antes da reserva.`, 403);
    }

    const areaId = String(r.areaId || "");
    const dateStr = (() => {
      try {
        const y = dtReserva.getFullYear();
        const m = String(dtReserva.getMonth() + 1).padStart(2, "0");
        const d = String(dtReserva.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      } catch { return null; }
    })();

    // Cancela + auditoria
    await ref.update({
      status: "CANCELADA",
      canceladaEm: FieldValue.serverTimestamp(),
      canceladaPorUid: actor.uid,
      canceladaPorNome: actor.nome,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Notifica operadores (desistência)
    try {
      await notifyOperadores(db, {
        condominioId,
        tipo: "RESERVA_CANCELADA",
        title: "⚠️ Reserva cancelada",
        message: `${actor.nome} cancelou a reserva${areaId ? " da área " + areaId : ""}${dateStr ? " em " + dateStr : ""}.`,
        reservaId,
        areaId: areaId || null,
        dateStr: dateStr || null,
      });
    } catch (e: any) {
      console.error("[reservas/cancelar] falha ao notificar operadores:", e?.message || e);
    }

    // Se existir fila: PROMOVE automaticamente o primeiro da fila (atômico)
      try {
        if (areaId && dateStr) {
          const slotId = `${areaId}__${dateStr}`;
          const slotRef = db
            .collection("condominios").doc(condominioId)
            .collection("reservasSlots").doc(slotId);

          await db.runTransaction(async (tx: any) => {
            // 1) libera slot + remove lock do dono cancelado
            const slotSnap = await tx.get(slotRef);
            if (slotSnap.exists) {
              tx.set(slotRef, {
                occupied: false,
                reservaId: null,
                updatedAt: FieldValue.serverTimestamp(),
              }, { merge: true });
            } else {
              // se não existir, cria base (pra o calendário ter consistência)
              tx.set(slotRef, {
                areaId,
                dateStr,
                occupied: false,
                reservaId: null,
                filaCount: 0,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              }, { merge: true });
            }

            // lock do dono
            const ownerUid = String(r.uid || r.moradorUid || r.userId || r.createdByUid || "");
            if (ownerUid) {
              const lockOwnerRef = slotRef.collection("reservasPorUid").doc(ownerUid);
              tx.delete(lockOwnerRef);
            }

            // 2) pega primeiro da fila
            const filaRef = slotRef.collection("fila");
            const q = filaRef.orderBy("createdAt", "asc").limit(1);
            const qSnap = await tx.get(q);

            if (qSnap.empty) {
              // sem fila -> slot fica verde
              return;
            }

            const first = qSnap.docs[0];
            const nextUid = first.id;
            const fd = first.data() || {};

            // 3) cria reserva para o primeiro da fila
            const reservaNovaRef = db
              .collection("condominios").doc(condominioId)
              .collection("reservas").doc();

            const dt = new Date(`${dateStr}T12:00:00.000Z`);

            tx.set(reservaNovaRef, {
              areaId,
              condominioId,
              uid: nextUid,
              status: "PENDENTE",
              precisaAprovacao: true,
              data: Timestamp.fromDate(dt),
              dateStr,
              valorCobrado: Number(fd.valorCobrado || 0) || 0,
              opcaoId: String(fd.opcaoId || "base"),
              opcaoNome: String(fd.opcaoNome || "Base"),
              capacidadeMax: (fd.capacidadeMax == null) ? null : Number(fd.capacidadeMax),
              criadoEm: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
              origemFila: true,
              promotedFromReservaId: reservaId,
            });

            // 4) ocupa slot e ajusta filaCount
            tx.set(slotRef, {
              occupied: true,
              reservaId: reservaNovaRef.id,
              filaCount: FieldValue.increment(-1),
              updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });

            // 5) remove da fila
            tx.delete(first.ref);

            // 6) atualiza lock do promovido (FILA -> RESERVA)
            const lockNextRef = slotRef.collection("reservasPorUid").doc(nextUid);
            tx.set(lockNextRef, {
              uid: nextUid,
              tipo: "RESERVA",
              areaId,
              dateStr,
              reservaId: reservaNovaRef.id,
              updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });

            // 7) notifica o morador promovido (fora do tx via batch não dá; vamos notificar depois)
            tx.set(
              db.collection("condominios").doc(condominioId).collection("notificacoes").doc(),
              {
                tipo: "RESERVA_PROMOVIDA_DA_FILA",
                title: "✅ Sua reserva foi criada (fila)",
                message: `Você era o primeiro da fila e sua reserva foi criada automaticamente${areaId ? " na área " + areaId : ""}${dateStr ? " em " + dateStr : ""}.`,
                titulo: "✅ Sua reserva foi criada (fila)",
                mensagem: `Você era o primeiro da fila e sua reserva foi criada automaticamente${areaId ? " na área " + areaId : ""}${dateStr ? " em " + dateStr : ""}.`,
                targetUid: nextUid,
                condominioId,
                reservaId: reservaNovaRef.id,
                areaId: areaId || null,
                dateStr: dateStr || null,
                lida: false,
                arquivada: false,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          });
        }
      } catch (e: any) {
        console.error("[reservas/cancelar] falha ao promover fila:", e?.message || e);
      }

      return NextResponse.json({ ok: true });
return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[API reservas/cancelar] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
