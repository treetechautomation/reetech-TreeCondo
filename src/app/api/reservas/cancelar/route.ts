import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { promoverFilaAposCancelamento } from "@/lib/reservasPromocaoFila";
import { FinanceiroStatus } from "@/lib/financeiroStatus";

// ── FASE D.5 — SHADOW MODE ─────────────────────────────────────────────────
import {
  shadowEvaluate,
  motorDecision,
  logOperational,
} from "@/lib/reservas/policy-engine/shadow/shadowRunner";
import { dispatchReservaDecision } from "@/lib/reservas/policy-engine/dispatcher";
import { readQuotaTx, decrementQuotaTx, type QuotaDoc } from "@/lib/reservas/policy-engine/reservas-quotas.helper";

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
  let status: string | null = null;

  try {
    const mref = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
    const msnap = await mref.get();
    if (msnap.exists) {
      const md = msnap.data() || {};
      if (md?.nome) nome = String(md.nome).trim();
      if (md?.role) role = String(md.role).trim();
      if (md?.status) status = String(md.status).trim();
    }
  } catch (e: any) {
    console.warn("[reservas/cancelar] getActorInfo falhou:", e?.message || String(e));
  }

  return { uid, email, nome, role, status };
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
  const snap = await membrosRef.where("status", "in", ["ATIVO"]).get();

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

    if (!(decoded as any)?.super_admin && !(decoded as any)?.superAdmin) {
      if (upper(actor.status) !== "ATIVO") {
        shadowEvaluate(db, motorDecision({
          action: "CANCEL", allowed: false,
          blockRule: "MEMBRO_INATIVO", blockPriority: "BLOCKER",
          blockMessage: "Membro inativo.",
          blockOrigin: "CONDOMINIO",
        }), { condominioId, areaId: "", opcaoId: "base", dateStr: "", uid: String(decoded.uid), actorUid: String(decoded.uid), actorIsSuperAdmin: false, actorRole: actor.role || "", priceCentavos: 0, isOperatorAction: false }).catch(() => {});
        return jsonError("Membro inativo.", 403);
      }
    }

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

    const cancelAreaId = String(r.areaId || "");
    const cancelDateStr = (() => {
      try {
        const y = dtReserva.getFullYear();
        const m = String(dtReserva.getMonth() + 1).padStart(2, "0");
        const d = String(dtReserva.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      } catch { return ""; }
    })();

    const agora = new Date();
    const limite = new Date(dtReserva.getTime() - cancelamentoMinHoras * 60 * 60 * 1000);

    // operador pode cancelar mesmo fora do prazo (se você quiser restringir, a gente muda)
    if (!isOperador && agora > limite) {
      shadowEvaluate(db, motorDecision({
        action: "CANCEL", allowed: false,
        blockRule: "CANCELAMENTO_TARDIO", blockPriority: "VALIDATION",
        blockMessage: `Cancelamento permitido somente até ${cancelamentoMinHoras}h antes da reserva.`,
        blockOrigin: "DEFAULT",
      }), { condominioId, areaId: cancelAreaId, opcaoId: "base", dateStr: cancelDateStr, uid: String(decoded.uid), actorUid: String(decoded.uid), actorIsSuperAdmin: isOperador, actorRole: actor.role || "", priceCentavos: Number(r.valorCobrado || 0), isOperatorAction: isOperador, reservaEventMs: dtReserva.getTime(), reservaStatus: String(r.status || ""), reservaValor: Number(r.valorCobrado || 0) }).catch(() => {});
      return jsonError(`Cancelamento permitido somente até ${cancelamentoMinHoras}h antes da reserva.`, 403);
    }

    const areaId = String(r.areaId || cancelAreaId);
    const dateStr = cancelDateStr;

    if (!areaId || !dateStr) return jsonError("Reserva sem área ou data válida para cancelamento.", 400);

    const ownerUid = String(r.uid || r.moradorUid || r.userId || r.createdByUid || "");

    // Determina recursos a liberar: composto usa resourceIds, legado usa [areaId]
    const isComposite = r.isComposite === true;
    const cancelResourceIds: string[] = isComposite && Array.isArray(r.resourceIds)
      ? r.resourceIds.map((x: any) => String(x))
      : [areaId];
    // Constrói refs para todos os slots e locks
    const cancelSlots = cancelResourceIds.map(resId => {
      const slotId = `${resId}__${dateStr}`;
      return {
        resourceId: resId,
        slotId,
        slotRef: db.collection("condominios").doc(condominioId).collection("reservasSlots").doc(slotId),
        lockRef: db.collection("condominios").doc(condominioId).collection("reservasSlots").doc(slotId).collection("reservasPorUid").doc(ownerUid),
      };
    });

    // ═══ TRANSAÇÃO ÚNICA: tudo atômico ═══

    // Consulta financeiro por reservaId antes da transação
    const financeiroQuerySnap = await db
      .collection("condominios")
      .doc(condominioId)
      .collection("financeiro")
      .where("reservaId", "==", reservaId)
      .limit(1)
      .get();

    const cobrancaRef =
      !financeiroQuerySnap.empty
        ? financeiroQuerySnap.docs[0].ref
        : null;

    await db.runTransaction(async (tx: any) => {
      // D.11.9.6: ler quota no início da transação (antes de writes).
      let quotaCancelDoc: QuotaDoc | null = null;
      let quotaCancelKey = "";
      let quotaCancelYm = "";
      try {
        const blNorm = String((r as any).blocoIdNorm || (r as any).blocoId || (r as any).bloco || "").toLowerCase().trim();
        const unNorm = String((r as any).unidadeIdNorm || (r as any).unidadeId || (r as any).unidade || "").toLowerCase().trim();
        const resDateStr = String((r as any).dateStr || "");
        if (unNorm && resDateStr) {
          quotaCancelKey = `${condominioId}::${blNorm}::${unNorm}`;
          quotaCancelYm = resDateStr.substring(0, 7);
          quotaCancelDoc = await readQuotaTx(tx, db, condominioId, quotaCancelKey, quotaCancelYm);
        }
      } catch { /* best-effort */ }

      // 1. Lê estado de todos os slots
      const slotSnapshots = [];
      for (const cs of cancelSlots) {
        const ss = await tx.get(cs.slotRef);
        slotSnapshots.push({ ...cs, exists: ss.exists, data: ss.exists ? (ss.data() || {}) : null });
      }

      // 2. Lê financeiro (DEVE ser antes de qualquer write — requisito Firestore)
      let fcStatus: string | null = null;
      if (cobrancaRef) {
        const fcSnap = await tx.get(cobrancaRef);
        if (fcSnap.exists) {
          fcStatus = String((fcSnap.data() || {}).status || "");
        }
      }

      // 3. Libera TODOS os slots
      for (const s of slotSnapshots) {
        if (s.exists) {
          tx.set(s.slotRef, {
            occupied: false,
            reservaId: null,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        } else {
          tx.set(s.slotRef, {
            areaId: s.resourceId,
            dateStr,
            occupied: false,
            reservaId: null,
            filaCount: 0,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }

      // 4. Remove TODOS os locks
      for (const cs of cancelSlots) {
        tx.delete(cs.lockRef);
      }

      // 5. Atualiza financeiro (conforme política de status — usando dados lidos no passo 2)
      if (cobrancaRef && fcStatus != null) {
        if (fcStatus === FinanceiroStatus.AGUARDANDO_ENVIO) {
          // Único status com cancelamento automático
          tx.set(
            cobrancaRef,
            {
              status: FinanceiroStatus.CANCELADO,
              dataCancelamento: FieldValue.serverTimestamp(),
              canceladoPorUid: actor.uid,
              canceladoPorNome: actor.nome,
              canceladoPorRole: actor.role || "MORADOR",
              motivoCancelamento: "Reserva cancelada",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        } else if (
          fcStatus === FinanceiroStatus.ENVIADO_ADMINISTRADORA ||
          fcStatus === FinanceiroStatus.PROCESSANDO ||
          fcStatus === FinanceiroStatus.LANCADO_BOLETO ||
          fcStatus === FinanceiroStatus.QUITADO
        ) {
          // Status avançados: preservar, marcar para ação administrativa
          tx.set(
            cobrancaRef,
            {
              reservaCancelada: true,
              reservaCanceladaEm: FieldValue.serverTimestamp(),
              reservaCanceladaPorUid: actor.uid,
              reservaCanceladaPorNome: actor.nome,
              requerAcaoAdministrativa: true,
              motivoAcaoAdministrativa: "RESERVA_CANCELADA_APOS_ENVIO",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
        // CANCELADO, ISENTO, ESTORNADO → ignorados (terminais)
      }

      // D.11.9.6: decrementar quota (write-only, leitura feita no início).
      if (quotaCancelDoc) {
        decrementQuotaTx(tx, db, condominioId, quotaCancelKey, quotaCancelYm, reservaId, quotaCancelDoc);
      }

      // 6. Atualiza reserva → CANCELADA
      const cancelData: Record<string, any> = {
        status: "CANCELADA",
        canceladaEm: FieldValue.serverTimestamp(),
        canceladaPorUid: actor.uid,
        canceladaPorNome: actor.nome,
        cancelamentoVersion: 2,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // D.11.9.6: auditoria de cancelamento tardio
      if (agora > limite) {
        cancelData.cancelamentoTardio = true;
        cancelData.cobrancaMantida = true;
      }

      // ── R2: liberar exclusividade do Campo ──
      const reserveOpcaoId = String((r as any).opcaoId || "");
      if (reserveOpcaoId === "com_campo" && cancelDateStr) {
        const agendaRef = db.collection("condominios").doc(condominioId).collection("campoAgenda").doc(cancelDateStr);
        const agendaSnap = await tx.get(agendaRef);
        if (agendaSnap.exists) {
          const agenda = agendaSnap.data() || {};
          const exc = (agenda as any).exclusividade ?? null;
          if (exc && exc.reservaId === reservaId && (exc.status === "HOLD" || exc.status === "ATIVA")) {
            tx.update(agendaRef, {
              "exclusividade.status": "LIBERADA",
              "exclusividade.liberadoEm": FieldValue.serverTimestamp(),
              "exclusividade.expiresAt": null,
              version: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }
      }

      tx.set(ref, cancelData, { merge: true });
    });
    // ═══ FIM DA TRANSAÇÃO ═══

    // Notifica operadores (fora da transação — não-crítico)
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

    // ═══ PROMOÇÃO DA FILA (pós-commit, fora da transação) ═══
    let promotedUid: string | null = null;
    try {
      promotedUid = await promoverFilaAposCancelamento(db, {
        condominioId,
        areaId,
        dateStr,
        resourceId: cancelSlots[0].resourceId,
        reservaId,
        isComposite,
      });
    } catch (e: any) {
      console.error("[reservas/cancelar] falha ao promover fila:", e?.message || e);
    }

    // ── FASE D.5 — SHADOW: sucesso CANCEL ──
    shadowEvaluate(db, motorDecision({
      action: "CANCEL", allowed: true,
    }), { condominioId, areaId: areaId || "", opcaoId: "base", dateStr: dateStr || "", uid: String(decoded.uid), actorUid: String(decoded.uid), actorIsSuperAdmin: isOperador, actorRole: actor.role || "", priceCentavos: Number(r.valorCobrado || 0), isOperatorAction: isOperador, reservaEventMs: dtReserva.getTime(), reservaStatus: "CANCELADA", reservaValor: Number(r.valorCobrado || 0) }).catch(() => {});

    // ── D.12.3: Dispatcher para CANCEL (autoridade via Feature Flag) ──
    dispatchReservaDecision(db, motorDecision({
      action: "CANCEL", allowed: true,
    }), { condominioId, areaId: areaId || "", opcaoId: "base", dateStr: dateStr || "", uid: String(decoded.uid), actorUid: String(decoded.uid), actorIsSuperAdmin: isOperador, actorRole: actor.role || "", priceCentavos: Number(r.valorCobrado || 0), isOperatorAction: isOperador, reservaEventMs: dtReserva.getTime(), reservaStatus: "CANCELADA", reservaValor: Number(r.valorCobrado || 0) }).catch(() => {});

    return NextResponse.json({ ok: true, promotedUid: promotedUid || undefined });
  } catch (err: any) {
    console.error("[API reservas/cancelar] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
