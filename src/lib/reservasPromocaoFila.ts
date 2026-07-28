import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { DEFAULT_RESERVATION_OFFER_DURATION_MINUTES } from "@/lib/reservasOfertaPrazo";
import { notifyReservasUid } from "@/lib/reservasNotificacoes";

// ── FASE D.5 — SHADOW MODE / FASE D.6-D.7 — DECISION DISPATCHER ──────────
import {
  motorDecision,
} from "@/lib/reservas/policy-engine/shadow/shadowRunner";
import { dispatchReservaDecision } from "@/lib/reservas/policy-engine/dispatcher";
import { adminDb } from "@/lib/firebaseAdmin";
import { normBloco } from "@/lib/normalization/location";

function upper(v: any) {
  return String(v || "").toUpperCase().trim();
}

function isSundayISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getDay() === 0;
}

function isHolidayISO(iso: string) {
  const mmdd = iso.slice(5);
  return mmdd === "12-24" || mmdd === "12-25" || mmdd === "12-31" || mmdd === "01-01";
}

function todaySaoPauloISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}


export async function promoverFilaAposCancelamento(
  db: any,
  params: {
    condominioId: string;
    areaId: string;
    dateStr: string;
    resourceId: string;
    reservaId: string;
    isComposite: boolean;
  }
): Promise<string | null> {
  if (params.isComposite) return null;

  const { condominioId, areaId, dateStr, resourceId, reservaId } = params;
  const slotRef = db.collection("condominios").doc(condominioId)
    .collection("reservasSlots").doc(`${resourceId}__${dateStr}`);
  const filaRef = slotRef.collection("fila");

  const areaRef = db.collection("condominios").doc(condominioId)
    .collection("areasReservaveis").doc(areaId);
  const areaSnap = await areaRef.get();
  const area = areaSnap.exists ? (areaSnap.data() || {}) : {};

  const q = filaRef.orderBy("createdAt", "asc");
  const snap = await q.get();
  if (snap.empty) return null;

  const hoje = todaySaoPauloISO();

  for (const doc of snap.docs) {
    const uid = doc.id;
    const fdata = doc.data() || {};
    const st = String(fdata.status || "");

    if (st === "OFERTA_PENDENTE" || st === "OFERTADA" || st === "INELEGIVEL") continue;

    // CHECK 1: Membro existe e está ATIVO
    const membroRef = db.collection("condominios").doc(condominioId)
      .collection("membros").doc(uid);
    const membroSnap = await membroRef.get();
    if (!membroSnap.exists) {
      await filaRef.doc(uid).set({
        status: "INELEGIVEL",
        motivoInelegibilidade: "Morador não encontrado no condomínio",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      continue;
    }
    const md = membroSnap.data() || {};
    const memberStatus = upper(md.status || "ATIVO");
    if (memberStatus !== "ATIVO") {
      // D.7: dispatcher (auditoria); bloco operacional garantido.
      await dispatchReservaDecision(db, motorDecision({
        action: "QUEUE_PROMOTE", allowed: false,
        blockRule: "MEMBRO_INATIVO", blockPriority: "BLOCKER",
        blockMessage: "Morador inativo ou suspenso",
        blockOrigin: "CONDOMINIO",
      }), { condominioId, areaId, opcaoId: "base", dateStr, uid, actorUid: uid, actorIsSuperAdmin: false, actorRole: "", priceCentavos: 0, isOperatorAction: false });
      await filaRef.doc(uid).set({
        status: "INELEGIVEL",
        motivoInelegibilidade: "Morador inativo ou suspenso",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      continue;
    }

    // CHECK 2: Bloco (escopoReserva)
    if (area.escopoReserva === "BLOCO" && Array.isArray(area.blocosPermitidos) && area.blocosPermitidos.length > 0) {
      const membroBlocoNorm = md.blocoIdNorm || normBloco(md.blocoId || md.bloco);
      if (!membroBlocoNorm || !area.blocosPermitidos.includes(membroBlocoNorm)) {
        // D.7: dispatcher (auditoria); bloco operacional garantido.
        await dispatchReservaDecision(db, motorDecision({
          action: "QUEUE_PROMOTE", allowed: false,
          blockRule: "BLOCO_NAO_PERMITIDO", blockPriority: "BLOCKER",
          blockMessage: "Bloco não permitido para esta área",
          blockOrigin: "AREA",
        }), { condominioId, areaId, opcaoId: "base", dateStr, uid, actorUid: uid, actorIsSuperAdmin: false, actorRole: "", priceCentavos: 0, isOperatorAction: false, memberFactsOverride: { blocoIdNorm: membroBlocoNorm } });
        await filaRef.doc(uid).set({
          status: "INELEGIVEL",
          motivoInelegibilidade: "Bloco não permitido para esta área",
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        continue;
      }
    }

    // CHECK 3: Data ainda é válida
    if (dateStr < hoje) {
      // D.7: dispatcher (auditoria); bloco operacional garantido.
      await dispatchReservaDecision(db, motorDecision({
        action: "QUEUE_PROMOTE", allowed: false,
        blockRule: "DATA_PASSADA", blockPriority: "BLOCKER",
        blockMessage: "Data passada",
        blockOrigin: "DEFAULT",
      }), { condominioId, areaId, opcaoId: "base", dateStr, uid, actorUid: uid, actorIsSuperAdmin: false, actorRole: "", priceCentavos: 0, isOperatorAction: false });
      await filaRef.doc(uid).set({
        status: "INELEGIVEL",
        motivoInelegibilidade: "Data passada",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      continue;
    }
    if (isSundayISO(dateStr)) {
      // D.7: dispatcher (auditoria); bloco operacional garantido.
      await dispatchReservaDecision(db, motorDecision({
        action: "QUEUE_PROMOTE", allowed: false,
        blockRule: "DIA_SEMANA_BLOQUEADO", blockPriority: "VALIDATION",
        blockMessage: "Domingo — reservas não permitidas",
        blockOrigin: "DEFAULT",
      }), { condominioId, areaId, opcaoId: "base", dateStr, uid, actorUid: uid, actorIsSuperAdmin: false, actorRole: "", priceCentavos: 0, isOperatorAction: false });
      await filaRef.doc(uid).set({
        status: "INELEGIVEL",
        motivoInelegibilidade: "Domingo — reservas não permitidas",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      continue;
    }
    if (isHolidayISO(dateStr)) {
      // D.7: dispatcher (auditoria); bloco operacional garantido.
      await dispatchReservaDecision(db, motorDecision({
        action: "QUEUE_PROMOTE", allowed: false,
        blockRule: "FERIADO_BLOQUEADO", blockPriority: "VALIDATION",
        blockMessage: "Feriado — reservas não permitidas",
        blockOrigin: "DEFAULT",
      }), { condominioId, areaId, opcaoId: "base", dateStr, uid, actorUid: uid, actorIsSuperAdmin: false, actorRole: "", priceCentavos: 0, isOperatorAction: false });
      await filaRef.doc(uid).set({
        status: "INELEGIVEL",
        motivoInelegibilidade: "Feriado — reservas não permitidas",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      continue;
    }

    // CHECK 4: Não possui lock de reserva neste slot
    const lockRef = slotRef.collection("reservasPorUid").doc(uid);
    const lockSnap = await lockRef.get();
    if (lockSnap.exists) {
      const lockData = lockSnap.data() || {};
      if (lockData.tipo === "RESERVA") {
        await filaRef.doc(uid).set({
          status: "INELEGIVEL",
          motivoInelegibilidade: "Já possui reserva ativa neste dia/área",
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        continue;
      }
    }

    // ── FASE D.7 — DISPATCHER: Policy Engine decide antes do write ──
    {
      const outcome = await dispatchReservaDecision(db, motorDecision({
        action: "QUEUE_PROMOTE", allowed: true,
      }), { condominioId, areaId, opcaoId: "base", dateStr, uid, actorUid: uid, actorIsSuperAdmin: false, actorRole: "", priceCentavos: 0, isOperatorAction: false });
      if (!outcome.allowed) {
        await filaRef.doc(uid).set({
          status: "INELEGIVEL",
          motivoInelegibilidade: outcome.blockMessage || "Bloqueado pelo regulamento.",
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        continue;
      }
    }

    // ELEGÍVEL — Criar oferta em transação atômica
    const offerNow = new Date();
    const offerExpiresAt = Timestamp.fromDate(
      new Date(offerNow.getTime() + DEFAULT_RESERVATION_OFFER_DURATION_MINUTES * 60 * 1000)
    );

    const offered = await db.runTransaction(async (tx: any) => {
      const ss = await tx.get(slotRef);
      const slotData = ss.exists ? (ss.data() || {}) : null;
      if (!slotData) return false;
      if (slotData.occupied === true) return false;
      if (String(slotData.pendingOfferUid || "").trim()) return false;

      const fe = await tx.get(filaRef.doc(uid));
      if (!fe.exists) return false;
      const feStatus = String(fe.data()?.status || "");
      if (feStatus !== "AGUARDANDO") return false;

      const ls = await tx.get(lockRef);
      if (ls.exists && ls.data()?.tipo === "RESERVA") return false;

      tx.set(filaRef.doc(uid), {
        status: "OFERTA_PENDENTE",
        ofertadaEm: FieldValue.serverTimestamp(),
        ofertaReservaOrigemId: reservaId,
        offerCreatedAt: Timestamp.fromDate(offerNow),
        offerExpiresAt,
        offerVersion: 1,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      tx.set(slotRef, {
        pendingOfferUid: uid,
        pendingOfferAt: FieldValue.serverTimestamp(),
        pendingOfferExpiresAt: offerExpiresAt,
        pendingOfferReservaOrigemId: reservaId,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return true;
    });

    if (offered) {
      const areaNome = String(area.nome || areaId);
      const horarioLimite = offerExpiresAt
        .toDate()
        .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      notifyReservasUid(db, {
        condominioId,
        targetUid: uid,
        tipo: "OFERTA_CRIADA",
        title: "Vaga disponível",
        message: `Uma vaga ficou disponível para ${areaNome} no dia ${dateStr}. Você tem até ${horarioLimite} para aceitar.`,
        reservaId,
        areaId,
        dateStr,
        offerExpiresAt: offerExpiresAt.toDate().toISOString(),
      }).catch(() => {});
      return uid;
    }
  }

  return null;
}
