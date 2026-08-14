import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { FinanceiroStatus } from "@/lib/financeiroStatus";
import { notifyReservasUid } from "@/lib/reservasNotificacoes";

// ── FASE D.4 — SHADOW MODE ─────────────────────────────────────────────────
import { getCompiledPolicy, makeContext, todaySaoPauloISO, getLegacyPolicyForCondominio } from "@/lib/reservas/policy-engine";
import { createAdminPolicyRepository } from "@/lib/reservas/policy-engine/adapters/admin";
import { createCachedPolicyRepository } from "@/lib/reservas/policy-engine/repository";
import { validate } from "@/lib/reservas/policy-engine/validator";
import { dispatchReservaDecision } from "@/lib/reservas/policy-engine/dispatcher";
import {
  compare,
  MotorDecision,
  motorDecision,
  logDivergence,
  logMatch,
  type ShadowCreateContext,
} from "@/lib/reservas/policy-engine/shadow/DecisionComparator";
import type { ReservaAction, ValidationResult } from "@/lib/reservas/policy-engine/types";
import { readQuotaTx, incrementQuotaTx } from "@/lib/reservas/policy-engine/reservas-quotas.helper";
import { normUnidade, normBloco } from "@/lib/normalization/location";
import { checkReservaBlock, checkReservaBlockTx } from "@/lib/reservas/bloqueios-helper";

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isValidISODate(dateStr: string) {
  // YYYY-MM-DD simples
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function isSundayISO(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.getDay() === 0;
}

function isHolidayISO(dateStr: string) {
  // Véspera de Natal, Natal, Véspera de Ano Novo e Ano Novo
  const mmdd = dateStr.slice(5);
  return mmdd === "12-24" || mmdd === "12-25" || mmdd === "12-31" || mmdd === "01-01";
}



function isoNoonUTC(dateStr: string) {
  // evita “virar o dia” por fuso do servidor
  return new Date(`${dateStr}T12:00:00.000Z`);
}

function todayInSaoPaulo(): string {
  // data oficial da aplicação (America/Sao_Paulo), formato YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// R1.0 — Etapa 0.1 (P1 #1): hora civil em America/Sao_Paulo, independente do
// timezone do host/processo. Nunca usar new Date().getHours() para regras
// horárias do regulamento (essas são sempre pensadas em horário de Brasília).
export function hourInSaoPaulo(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(now)
  );
}

// ── SHADOW HELPER ─────────────────────────────────────────────────────────────

async function shadowEvaluate(
  db: ReturnType<typeof adminDb>,
  motor: MotorDecision,
  ctx: ShadowCreateContext,
): Promise<void> {
  try {
    const repo = createCachedPolicyRepository(createAdminPolicyRepository(db));
    const compiled = await getCompiledPolicy(repo, {
      condominioId: ctx.condominioId,
      areaId: ctx.areaId,
      opcaoId: ctx.opcaoId !== "base" ? ctx.opcaoId : undefined,
    });
    const memberFacts = await repo.getMemberFacts(ctx.condominioId, ctx.uid);
    memberFacts.isSuperAdmin = ctx.actorIsSuperAdmin;
    const quotaFacts = await repo.getQuotaFacts(ctx.condominioId, {
      areaId: ctx.areaId,
      dateStr: ctx.dateStr,
      uid: ctx.uid,
    });
    const now = new Date();
    const context = makeContext({
      now,
      dateStr: ctx.dateStr,
      target: {
        condominioId: ctx.condominioId,
        areaId: ctx.areaId,
        opcaoId: ctx.opcaoId !== "base" ? ctx.opcaoId : undefined,
      },
      actor: memberFacts,
      area: { ativo: true },
      quota: quotaFacts,
      priceCentavos: ctx.priceCentavos,
      isOperatorAction: ctx.isOperatorAction,
    });
    const policyResult = validate(motor.action, compiled, context);
    const comparison = compare(motor, policyResult);
    if (comparison.match) {
      logMatch(motor, policyResult);
    } else {
      logDivergence(comparison);
    }
  } catch (err) {
    console.error("[Shadow:ERROR]", String(err));
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

    console.error("[API reservas/criar][debug] body bruto:", body);

    const condominioId = String(body?.condominioId || "").trim();
    const areaId = String(body?.areaId || "").trim();
    const dateStr = String(body?.dateStr || "").trim();

    const opcaoId = body?.opcaoId != null ? String(body.opcaoId) : "base";
      const targetUidBody = String(body?.targetUid || "").trim();

    if (!condominioId || !areaId || !dateStr) {
      return jsonError("condominioId, areaId e dateStr são obrigatórios.", 400);
    }
    if (!isValidISODate(dateStr)) {
      return jsonError("dateStr inválido. Use YYYY-MM-DD.", 400);
    }

    // Bloqueio de data passada (fuso oficial America/Sao_Paulo; o dia atual continua permitido)
    if (dateStr < todayInSaoPaulo()) {
      shadowEvaluate(db, motorDecision({
        action: "CREATE", allowed: false,
        blockRule: "DATA_PASSADA", blockPriority: "BLOCKER",
        blockMessage: "Não é possível criar reserva para uma data passada.",
        blockOrigin: "DEFAULT",
      }), { condominioId, areaId, opcaoId, dateStr, uid: String(decoded.uid), actorUid: String(decoded.uid), actorIsSuperAdmin: !!(decoded as any)?.super_admin || !!(decoded as any)?.superAdmin, actorRole: "", priceCentavos: 0, isOperatorAction: false }).catch(() => {});
      return jsonError("Não é possível criar reserva para uma data passada.", 403);
    }

    // Bloqueios globais
    // R1.0 — Etapa 0.1 (P1 #2): domingo/feriado são regras do regulamento
    // legado da Chácara Itaguaí (LEGACY_POLICY_REGISTRY), NÃO uma regra
    // universal do SaaS. Condomínios fora do registry (DEFAULT_POLICY,
    // permissiva) não podem herdar esse bloqueio por acidente.
    const temRegulamentoLegadoComRestricaoCalendario = getLegacyPolicyForCondominio(condominioId) != null;
    if (temRegulamentoLegadoComRestricaoCalendario && isSundayISO(dateStr)) {
      shadowEvaluate(db, motorDecision({
        action: "CREATE", allowed: false,
        blockRule: "DIA_SEMANA_BLOQUEADO", blockPriority: "VALIDATION",
        blockMessage: "Não é permitido fazer reservas aos domingos.",
        blockOrigin: "DEFAULT",
      }), { condominioId, areaId, opcaoId, dateStr, uid: String(decoded.uid), actorUid: String(decoded.uid), actorIsSuperAdmin: !!(decoded as any)?.super_admin || !!(decoded as any)?.superAdmin, actorRole: "", priceCentavos: 0, isOperatorAction: false }).catch(() => {});
      return jsonError("❌ Não é permitido fazer reservas aos domingos.", 403);
    }
    if (temRegulamentoLegadoComRestricaoCalendario && isHolidayISO(dateStr)) {
      shadowEvaluate(db, motorDecision({
        action: "CREATE", allowed: false,
        blockRule: "FERIADO_BLOQUEADO", blockPriority: "VALIDATION",
        blockMessage: "Não é permitido fazer reservas nesta data (feriado).",
        blockOrigin: "DEFAULT",
      }), { condominioId, areaId, opcaoId, dateStr, uid: String(decoded.uid), actorUid: String(decoded.uid), actorIsSuperAdmin: !!(decoded as any)?.super_admin || !!(decoded as any)?.superAdmin, actorRole: "", priceCentavos: 0, isOperatorAction: false }).catch(() => {});
      return jsonError("❌ Não é permitido fazer reservas nesta data (feriado).", 403);
    }

    // Buscar área no Firestore (fonte da verdade para preço, opção e capacidade)
    const areaRef = db.collection("condominios").doc(condominioId).collection("areasReservaveis").doc(areaId);
    const areaSnap = await areaRef.get();
    if (!areaSnap.exists) return jsonError("Área não encontrada.", 404);
    const area = areaSnap.data() || {};
    if (!area.ativo) {
      shadowEvaluate(db, motorDecision({
        action: "CREATE", allowed: false,
        blockRule: "AREA_INATIVA", blockPriority: "BLOCKER",
        blockMessage: "Área desativada.",
        blockOrigin: "AREA",
      }), { condominioId, areaId, opcaoId, dateStr, uid: String(decoded.uid), actorUid: String(decoded.uid), actorIsSuperAdmin: !!(decoded as any)?.super_admin || !!(decoded as any)?.superAdmin, actorRole: "", priceCentavos: 0, isOperatorAction: false }).catch(() => {});
      return jsonError("Área desativada.", 403);
    }

    // R2: Áreas de uso comum não podem ser reservadas como privativas
    if ((area as any).ehUsoComum === true) {
      return jsonError("Esta área é de uso comum e não pode ser reservada como área privativa.", 400);
    }

    // Resolver preço e nome da opção (servidor, não do body)
    let valorCobrado: number;
    let opcaoNome: string;
    let opcao: any = null;
    if (!opcaoId || opcaoId === "base") {
      valorCobrado = Number.isFinite(Number(area.precoCentavos ?? area.preco)) ? Number(area.precoCentavos ?? area.preco) : 0;
      opcaoNome = String(area.nome || "Área");
    } else {
      const ops = Array.isArray(area.opcoes) ? area.opcoes : [];
      opcao = ops.find((o: any) => String(o.id || "") === opcaoId);
      if (!opcao) return jsonError("Opção não encontrada na área.", 400);
      valorCobrado = Number.isFinite(Number(opcao.precoCentavos ?? opcao.preco)) ? Number(opcao.precoCentavos ?? opcao.preco) : 0;
      opcaoNome = String(opcao.nome || opcaoId);
    }

    // Extrai resourceIds da opção (backend é a única fonte de verdade)
    const resourceIds: string[] | null = (() => {
      if (!opcao) return null;
      const ids = opcao.resourceIds;
      if (!Array.isArray(ids)) return null;
      const mapped = ids.map((x: any) => String(x).trim()).filter(Boolean);
      return mapped.length >= 2 ? mapped : null;
    })();

    // Valida que cada recurso existe e está ativo e captura nomes para auditoria/PDF
    let resourceNames: string[] | null = null;
    if (resourceIds) {
      const names: string[] = [];
      for (const resid of resourceIds) {
        const ref = db.collection("condominios").doc(condominioId).collection("areasReservaveis").doc(resid);
        const snap = await ref.get();
        if (!snap.exists) return jsonError(`Recurso "${resid}" não encontrado.`, 404);
        const data = snap.data() || {};
        if (!data.ativo) return jsonError(`Recurso "${resid}" está desativado.`, 403);
        names.push(String(data.nome || resid));
      }
      resourceNames = names;
    }

    // Capacidade exclusivamente da área
    const capacidadeMax: number | null = Number.isFinite(Number(area.capacidadeMax)) ? Number(area.capacidadeMax) : null;

    // Ler políticas do condomínio e calcular status/aprovação (servidor, não do body)
    const politicasRef = db.collection("condominios").doc(condominioId).collection("config").doc("reservas");
    const politicasSnap = await politicasRef.get();
    const politicas = politicasSnap.exists ? (politicasSnap.data() || {}) : {};
    const autoAprovarAposHoras = Number(politicas.autoAprovarAposHoras ?? 24);
    const exigirAprovacaoQuandoMenosQueHoras = Number(politicas.exigirAprovacaoQuandoMenosQueHoras ?? 24);
    const horas = (isoNoonUTC(dateStr).getTime() - Date.now()) / 3600000;
    const hasFee = valorCobrado > 0;
    const statusFinal = hasFee ? "PENDENTE_PAGAMENTO" : (horas >= autoAprovarAposHoras ? "APROVADA" : "PENDENTE");
    const precisaAprovacao = !hasFee && horas < exigirAprovacaoQuandoMenosQueHoras;

    let uid = String(decoded.uid);

      console.error("[API reservas/criar][debug] actor/target inicial:", {
        actorUid: String(decoded.uid),
        targetUidBody,
        condominioId,
        areaId,
        dateStr,
      });

      if (targetUidBody && targetUidBody !== uid) {
        const actorVincRef = db
          .collection("userCondominios")
          .doc(String(decoded.uid))
          .collection("vinculos")
          .doc(condominioId);

        const actorVincSnap = await actorVincRef.get();
        const actorRole = actorVincSnap.exists ? String(actorVincSnap.data()?.role || "") : "";
        const isOperador =
          isOperatorRole(actorRole) ||
          (decoded && decoded.super_admin === true) ||
          (decoded && decoded.superAdmin === true);

        console.error("[API reservas/criar][debug] actor role check:", {
          actorUid: String(decoded.uid),
          actorRole,
          isOperador,
        });

        if (!isOperador) {
          return jsonError("Sem permissão para criar reserva para outro morador.", 403);
        }

        const targetMembroRef = db
          .collection("condominios")
          .doc(condominioId)
          .collection("membros")
          .doc(targetUidBody);

        const targetMembroSnap = await targetMembroRef.get();
        if (!targetMembroSnap.exists) {
          return jsonError("Morador selecionado não encontrado.", 404);
        }

        const targetMembro = targetMembroSnap.data() || {};
        const targetStatus = upper(targetMembro.status || "");

        console.error("[API reservas/criar][debug] target membro:", {
          targetUidBody,
          exists: targetMembroSnap.exists,
          targetStatus,
        });

        if (targetStatus !== "ATIVO") {
          return jsonError("Morador selecionado está inativo.", 403);
        }

        uid = targetUidBody;
      }

      console.error("[API reservas/criar][debug] uid final:", {
        actorUid: String(decoded.uid),
        targetUidBody,
        uidFinal: uid,
      });

      const slotId = `${areaId}__${dateStr}`;

      const slotRef = db.collection("condominios").doc(condominioId).collection("reservasSlots").doc(slotId);
      const lockRef = slotRef.collection("reservasPorUid").doc(uid);
      const filaDocRef = slotRef.collection("fila").doc(uid);

      const isCompound = !!(resourceIds && resourceIds.length >= 2);
      const resourceSlots = (isCompound ? resourceIds! : [areaId]).map(resId => ({
        resourceId: resId,
        slotId: `${resId}__${dateStr}`,
        slotRef: db.collection("condominios").doc(condominioId).collection("reservasSlots").doc(`${resId}__${dateStr}`),
        lockRef: db.collection("condominios").doc(condominioId).collection("reservasSlots").doc(`${resId}__${dateStr}`).collection("reservasPorUid").doc(uid),
      }));


    const reservasCol = db.collection("condominios").doc(condominioId).collection("reservas");

    const membroPreSnap = await db.collection("condominios").doc(condominioId).collection("membros").doc(uid).get();
    const mdPre = membroPreSnap.exists ? (membroPreSnap.data() || {}) : {};

    if (!(decoded as any)?.super_admin && !(decoded as any)?.superAdmin) {
      const membroStatus = upper(mdPre.status || "");
      if (!membroPreSnap.exists || membroStatus !== "ATIVO") {
        shadowEvaluate(db, motorDecision({
          action: "CREATE", allowed: false,
          blockRule: "MEMBRO_INATIVO", blockPriority: "BLOCKER",
          blockMessage: "Membro inativo.",
          blockOrigin: "CONDOMINIO",
        }), { condominioId, areaId, opcaoId, dateStr, uid, actorUid: String(decoded.uid), actorIsSuperAdmin: !!(decoded as any)?.super_admin || !!(decoded as any)?.superAdmin, actorRole: "", priceCentavos: valorCobrado, isOperatorAction: uid !== String(decoded.uid) }).catch(() => {});
        return jsonError("Membro inativo.", 403);
      }
    }

    // UN.6C.1: Resolve canonical unit via VinculoUnidade (not Membership)
    const pessoaId = String(mdPre.pessoaId || "");
    let canonicalBlocoId = "";
    let canonicalUnitDocId = "";
    let canonicalUnidadeNumero = "";
    let canonicalBlocoNome = "";
    let canonicalBlocoIdNorm = "";
    let canonicalUnidadeIdNorm = "";

    if (pessoaId) {
      // Query VinculoUnidade for principal residence
      try {
        const vincSnap = await db.collection("condominios").doc(condominioId)
          .collection("vinculosUnidades")
          .where("pessoaId", "==", pessoaId)
          .where("status", "==", "ATIVO")
          .where("resideNaUnidade", "==", true)
          .where("principal", "==", true)
          .limit(1).get();

        if (!vincSnap.empty) {
          const vinc = vincSnap.docs[0].data() || {};
          canonicalBlocoId = String(vinc.blocoId || "");
          canonicalUnitDocId = String(vinc.unitDocId || "");

          // Resolve bloco nome from catalog
          if (canonicalBlocoId) {
            try {
              const blocoSnap = await db.collection("condominios").doc(condominioId)
                .collection("blocos").doc(canonicalBlocoId).get();
              if (blocoSnap.exists) {
                const bd = blocoSnap.data() || {};
                canonicalBlocoNome = String(bd.nome || bd.blocoNome || canonicalBlocoId);
                canonicalBlocoIdNorm = String(bd.nomeNorm || bd.blocoNomeNorm || normBloco(canonicalBlocoNome) || "");
              }
            } catch { canonicalBlocoNome = canonicalBlocoId; }
          }

          // Resolve unidade numero from catalog
          if (canonicalUnitDocId && canonicalBlocoId) {
            try {
              const unidadeSnap = await db.collection("condominios").doc(condominioId)
                .collection("blocos").doc(canonicalBlocoId)
                .collection("unidades").doc(canonicalUnitDocId).get();
              if (unidadeSnap.exists) {
                const ud = unidadeSnap.data() || {};
                canonicalUnidadeNumero = String(ud.numero || ud.unidadeNumero || "");
                canonicalUnidadeIdNorm = String(ud.numeroNorm || ud.unidadeNumeroNorm || normUnidade(canonicalUnidadeNumero) || "");
              }
            } catch { canonicalUnidadeNumero = canonicalUnitDocId; }
          }
        }
      } catch { /* ignore — fall through to legacy */ }
    }

    // LEGACY FALLBACK: use membro doc if VinculoUnidade didn't resolve
    const blocoIdPre = canonicalBlocoId || String(mdPre.blocoId || mdPre.bloco || "");
    let blocoNome = canonicalBlocoNome;
    if (!blocoNome && blocoIdPre) {
      try {
        const blocoSnap = await db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoIdPre).get();
        blocoNome = blocoSnap.exists ? String(blocoSnap.data()?.nome || blocoIdPre) : String(blocoIdPre);
      } catch { blocoNome = String(blocoIdPre); }
    }

    if (area.escopoReserva === "BLOCO" && Array.isArray(area.blocosPermitidos) && area.blocosPermitidos.length > 0) {
      const membroBlocoNorm = canonicalBlocoIdNorm || mdPre.blocoIdNorm || normBloco(mdPre.blocoId || mdPre.bloco);
      if (!membroBlocoNorm || !area.blocosPermitidos.includes(membroBlocoNorm)) {
        shadowEvaluate(db, motorDecision({
          action: "CREATE", allowed: false,
          blockRule: "BLOCO_NAO_PERMITIDO", blockPriority: "BLOCKER",
          blockMessage: "Esta área é exclusiva para moradores de outro bloco.",
          blockOrigin: "AREA",
        }), { condominioId, areaId, opcaoId, dateStr, uid, actorUid: String(decoded.uid), actorIsSuperAdmin: !!(decoded as any)?.super_admin || !!(decoded as any)?.superAdmin, actorRole: "", priceCentavos: valorCobrado, isOperatorAction: uid !== String(decoded.uid) }).catch(() => {});
        return jsonError("Esta área é exclusiva para moradores de outro bloco.", 403);
      }
    }

    // ── TRANSAÇÃO (com inner try/catch p/ shadow de erros de transação) ──
    let result: any;

    // D.11.9.6: ler versão publicada do regulamento para Policy Snapshot.
    let policyVersion = 0;
    let policyHashStr = "";
    try {
      const policyPubSnap = await db
        .collection("condominios").doc(condominioId)
        .collection("config").doc("reservasPolicy")
        .collection("dados").doc("publicada").get();
      if (policyPubSnap.exists) {
        const pd = policyPubSnap.data() || {};
        policyVersion = Number(pd.currentVersion ?? 0);
      }
      // Hash será preenchido após a definição da política completa.
      // Por ora, usa versão publicada.
    } catch { /* policyVersion permanece 0 (legado) */ }

    try {
      result = await db.runTransaction(async (tx: any) => {
      const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
      const membroSnap = await tx.get(membroRef);

      // ── R4.1: revalidação transacional de bloqueios administrativos ──
      {
        const md = membroSnap.exists ? (membroSnap.data() || {}) as Record<string, any> : {};
        const blNorm = canonicalBlocoIdNorm || String(md.blocoIdNorm || normBloco(md.blocoId || md.bloco || ""));
        const unNorm = canonicalUnidadeIdNorm || String(md.unidadeIdNorm || normUnidade(md.unidadeId || md.apto || ""));
        const blockCheck = await checkReservaBlockTx(tx, db, {
          condominioId, uid,
          unidadeIdNorm: unNorm, blocoIdNorm: blNorm,
          areaId, escopoOperacao: "RESERVA_PRIVATIVA",
        });
        if (blockCheck.blocked) {
          throw Object.assign(
            new Error(blockCheck.motivoPublico ?? "Esta unidade está temporariamente impedida de realizar reservas."),
            { status: 403 }
          );
        }
      }

      // Verifica locks para TODOS os recursos (simples ou composto)
      for (const rs of resourceSlots) {
        const ls = await tx.get(rs.lockRef);
        if (ls.exists) {
          const t = (ls.data() || {}).tipo || "LOCK";
          throw Object.assign(
            new Error(`Você já tem ${t === "FILA" ? "fila" : "reserva"} em um dos recursos neste dia.`),
            { status: 409 }
          );
        }
      }

      // Lê estado de todos os slots
      const slotStates = [];
      for (const rs of resourceSlots) {
        const ss = await tx.get(rs.slotRef);
        const slot = ss.exists ? (ss.data() || {}) : null;
        slotStates.push({
          ...rs,
          exists: ss.exists,
          slot,
          occupied: Boolean(slot?.occupied === true),
          filaCount: Number(slot?.filaCount || 0) || 0,
        });
      }

      // D.11.9.4: ler quota no início (antes de qualquer write).
      let quotaDoc: any = null;
      let quotaKey: string | null = null;
      let quotaYm: string | null = null;
      try {
        const memberData = membroSnap.exists ? (membroSnap.data() || {}) : {};
        const blNorm = String(memberData.blocoIdNorm || normBloco(memberData.blocoId || memberData.bloco || "")).toLowerCase().trim();
        const unNorm = String(memberData.unidadeIdNorm || normUnidade(memberData.unidadeId || memberData.apto || "")).toLowerCase().trim();
        if (unNorm) {
          quotaKey = `${condominioId}::${blNorm}::${unNorm}`;
          quotaYm = dateStr.substring(0, 7);
          quotaDoc = await readQuotaTx(tx, db, condominioId, quotaKey, quotaYm);
        }
      } catch { /* quota read é best-effort */ }

      console.error("[API reservas/criar][debug] slot states:", slotStates.map(s => ({
        slotId: s.slotId,
        occupied: s.occupied,
        filaCount: s.filaCount,
        exists: s.exists,
      })));

      // ── CAMINHO COMPOSTO ──
      if (isCompound) {
        const anyOccupied = slotStates.some(s => s.occupied);
        if (anyOccupied) {
          throw Object.assign(
            new Error("Um ou mais recursos já estão ocupados neste dia."),
            { status: 409 }
          );
        }

        // Garante docs base para todos os slots
        for (const s of slotStates) {
          if (!s.exists) {
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

        // Cria UMA reserva
        const reservaRef = reservasCol.doc();
        const dt = isoNoonUTC(dateStr);

        // UN.6C.1: Canonical unit fields resolved from VinculoUnidade (or legacy fallback)
        const md = membroPreSnap.exists ? (membroPreSnap.data() || {}) : {};
        // Canonical fields from VinculoUnidade when available
        const reservaBlocoId = canonicalBlocoId || String(md.blocoId || md.bloco || "");
        const reservaBlocoNombre = canonicalBlocoNome || blocoNome || "";
        // For blocoIdNorm: use catalog norm if canonical, else derive from membro
        const reservaBlocoIdNormVal = canonicalBlocoIdNorm || String(md.blocoIdNorm || normBloco(md.blocoId || md.bloco) || "");
        // For unidade: canonical unit number or membro fallback
        const reservaUnidadeId = canonicalUnidadeNumero || String(md.unidadeId || md.apto || "");
        const reservaUnidadeIdNormVal = canonicalUnidadeIdNorm || String(md.unidadeIdNorm || normUnidade(reservaUnidadeId) || "");
        const reservaUnitDocId = canonicalUnitDocId || String(md.unitDocId || "");
        const reservaPessoaId = pessoaId || String(md.pessoaId || "");

        // UN.6C.1: Build unidadeSnapshot from VinculoUnidade or catalog
        const reservaUnidadeSnapshot = reservaUnitDocId ? {
          unitDocId: reservaUnitDocId,
          blocoId: reservaBlocoId,
          blocoNome: reservaBlocoNombre || reservaBlocoId,
          unidadeNumero: reservaUnidadeId,
        } : null;

        tx.set(reservaRef, {
          areaId,
          condominioId,
          uid,
          criadoPorUid: String(decoded.uid),
          reservaManualPorOperador: uid !== String(decoded.uid),
          status: statusFinal,
          precisaAprovacao,
          data: Timestamp.fromDate(dt),
          dateStr,
          valorCobrado,
          opcaoId,
          opcaoNome,
          capacidadeMax: Number.isFinite(Number(capacidadeMax)) ? Number(capacidadeMax) : null,
          // UN.6C.1: Canonical unit fields
          blocoId: reservaBlocoId || null,
          blocoIdNorm: reservaBlocoIdNormVal || null,
          unidadeId: reservaUnidadeId || null,
          unidadeIdNorm: reservaUnidadeIdNormVal || null,
          unitDocId: reservaUnitDocId || null,
          unidadeSnapshot: reservaUnidadeSnapshot || null,
          pessoaId: reservaPessoaId || null,
          isComposite: true,
          resourceCount: resourceIds!.length,
          resourceIds,
          resourceNames,
          policyVersion,
          policyHash: policyHashStr || null,
          criadoEm: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Cria UM lançamento financeiro (se houver taxa)
        if (hasFee) {
          const cobrancaRef = db.collection("condominios").doc(condominioId).collection("financeiro").doc();
          const md = membroSnap.exists ? (membroSnap.data() || {}) : {};
          // UN.6C.1: Use canonical resolved fields instead of membro doc
          const unidadeIdRaw = reservaUnidadeId || String(md.unidadeId || md.apto || "");
          const unidadeIdNormVal = reservaUnidadeIdNormVal || String(md.unidadeIdNorm || normUnidade(unidadeIdRaw) || "");
          const numeroReserva = dateStr.replace(/-/g, "") + "-" + reservaRef.id.substring(0, 6).toUpperCase();
          const competenciaVal = dateStr.substring(0, 7);
          const unidadeNomeVal = [reservaBlocoNombre || blocoNome, unidadeIdRaw].filter(Boolean).join(" - ") || unidadeIdRaw || "";

          tx.set(cobrancaRef, {
            tipo: "TAXA_RESERVA",
            reservaId: reservaRef.id,
            numeroReserva,
            moradorUid: uid,
            moradorNome: String(md.nome || ""),
            blocoId: reservaBlocoId || String(md.blocoId || md.bloco || ""),
            blocoIdNorm: reservaBlocoIdNormVal || String(md.blocoIdNorm || normBloco(md.blocoId || md.bloco) || ""),
            blocoNome: reservaBlocoNombre || blocoNome || String(md.blocoId || md.bloco || ""),
            unidadeId: unidadeIdRaw,
            unidadeIdNorm: unidadeIdNormVal,
            unidadeNome: unidadeNomeVal,
            areaId,
            areaNome: String(area?.nome || areaId),
            opcaoId,
            opcaoNome,
            valorCentavos: valorCobrado,
            competencia: competenciaVal,
            competenciaOriginal: competenciaVal,
            status: FinanceiroStatus.AGUARDANDO_ENVIO,
            descricao: `Taxa de Reserva — ${opcaoNome || "Área Comum"} (${dateStr})`,
            dataSolicitacao: FieldValue.serverTimestamp(),
            dataEvento: Timestamp.fromDate(dt),
            dataCriacaoLancamento: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            observacoes: "",
          });
        }

        // D.11.9.4: incrementar quota (write-only, leitura feita no início).
        if (quotaDoc && quotaKey && quotaYm) {
          incrementQuotaTx(tx, db, condominioId, quotaKey, quotaYm, reservaRef.id, quotaDoc);
        }

        // Atualiza TODOS os slots → ocupados
        for (const s of slotStates) {
          tx.set(s.slotRef, {
            areaId: s.resourceId,
            dateStr,
            occupied: true,
            reservaId: reservaRef.id,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        // Cria lock para TODOS os recursos
        for (const s of slotStates) {
          tx.set(s.lockRef, {
            uid,
            tipo: "RESERVA",
            areaId: s.resourceId,
            dateStr,
            reservaId: reservaRef.id,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        return { mode: "RESERVA", slotId: slotStates[0].slotId, reservaId: reservaRef.id };
      }

      // ── R2: CAMINHO COM_CAMPO (exclusividade Campo + Churrasqueira 2) ──
      if (opcaoId === "com_campo") {
        const repoLocal = createCachedPolicyRepository(createAdminPolicyRepository(db));
        const compiled = await getCompiledPolicy(repoLocal, { condominioId, areaId, opcaoId });
        const md = (membroSnap.exists ? (membroSnap.data() || {}) : {}) as Record<string, any>;
        const mRole = String(md.role ?? "MORADOR");
        const mBlocoNorm = (md.blocoIdNorm || normBloco(md.blocoId || md.bloco || "")) as string ?? "";
        const mUnidNorm = (md.unidadeIdNorm || normUnidade(md.unidadeId || md.apto || "")) as string ?? "";
        const mBlocoNome = String(md.blocoNome || md.bloco || canonicalBlocoNome || "");
        const mUnidadeNum = String(md.unidadeNumero || md.unidade || canonicalUnidadeNumero || "");

        const policyCtx = makeContext({
          dateStr, target: { condominioId, areaId, opcaoId },
          actor: { uid, exists: true, status: "ATIVO", role: mRole, blocoIdNorm: mBlocoNorm, unidadeIdNorm: mUnidNorm, isSuperAdmin: false, isPaidUp: null, recentNoShows: 0, suspendedUntil: null },
        });
        const policyCheck = validate("CREATE", compiled, policyCtx);
        if (!policyCheck.allowed) {
          const v = policyCheck.violations[0];
          throw Object.assign(new Error(v?.message ?? "Exclusividade não permitida pela política."), { status: 409 });
        }

        const exc = compiled.policy.campo.exclusividade;
        if (!exc.habilitada || !exc.horaInicio || !exc.horaFim || !exc.holdHoras) {
          throw Object.assign(new Error("Exclusividade não configurada para este condomínio."), { status: 400 });
        }

        // Não permitir após início da faixa no mesmo dia
        const today = todaySaoPauloISO();
        if (dateStr === today) {
          const nowHr = hourInSaoPaulo();
          if (nowHr >= exc.horaInicio) {
            throw Object.assign(new Error("Não é possível reservar a exclusividade do Campo após o início da faixa de exclusividade."), { status: 400 });
          }
        }

        const inicioMin = exc.horaInicio * 60;
        const fimMin = exc.horaFim * 60;

        // Transação cross-domain: campoAgenda + reserva + financeiro
        const agendaRef = db.collection("condominios").doc(condominioId).collection("campoAgenda").doc(dateStr);
        const agendaSnap = await tx.get(agendaRef);
        const agenda = agendaSnap.exists ? (agendaSnap.data() || {}) : { dateStr, version: 0 };
        const existingExc = (agenda as any).exclusividade ?? null;

        // Verificar exclusividade existente
        if (existingExc) {
          const isHolding = existingExc.status === "HOLD" && existingExc.expiresAt && existingExc.expiresAt.toDate() > new Date();
          if (isHolding || existingExc.status === "ATIVA") {
            throw Object.assign(new Error("Já existe exclusividade para esta data."), { status: 409 });
          }
        }

        // Verificar usos existentes do Campo que conflitem
        const usosSnap = await tx.get(
          db.collection("condominios").doc(condominioId).collection("usoCampo")
            .where("dateStr", "==", dateStr).where("status", "==", "ATIVO")
        );
        for (const usoDoc of usosSnap.docs) {
          const u = usoDoc.data();
          if (u.inicioMin < fimMin && u.fimMin > inicioMin) {
            throw Object.assign(
              new Error("Não foi possível reservar a opção com exclusividade do Campo. Já existem utilizações do Campo cadastradas entre 18h e 22h nessa data."),
              { status: 409 }
            );
          }
        }

        // Calcular expiresAt
        const holdDurationMs = exc.holdHoras * 3600_000;
        const evento18h = new Date(`${dateStr}T${String(exc.horaInicio).padStart(2,"0")}:00:00-03:00`);
        const expiresAt = new Date(Math.min(Date.now() + holdDurationMs, evento18h.getTime()));

        // Criar reserva
        const reservaRef = reservasCol.doc();
        const dt = isoNoonUTC(dateStr);
        const statusFinal = hasFee ? "PENDENTE_PAGAMENTO" : "APROVADA";
        tx.set(reservaRef, {
          areaId, condominioId, uid, criadoPorUid: String(decoded.uid),
          reservaManualPorOperador: uid !== String(decoded.uid),
          status: statusFinal, precisaAprovacao: !hasFee,
          data: Timestamp.fromDate(dt), dateStr, valorCobrado, opcaoId, opcaoNome,
          capacidadeMax, criadoEm: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
          isComposite: false, resourceIds: null, resourceNames: null,
        });

        // Ocupar slot da churrasqueira_2
        tx.set(slotRef, { areaId, dateStr, occupied: true, reservaId: reservaRef.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        tx.set(lockRef, { uid, tipo: "RESERVA", areaId, dateStr, reservaId: reservaRef.id, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });

        // Financeiro
        if (hasFee) {
          const cobrancaRef = db.collection("condominios").doc(condominioId).collection("financeiro").doc();
          tx.set(cobrancaRef, { tipo: "TAXA_RESERVA", reservaId: reservaRef.id, moradorUid: uid, areaId, opcaoId, opcaoNome, valorCentavos: valorCobrado, status: "AGUARDANDO_ENVIO", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        }

        // Criar HOLD no campoAgenda
        tx.set(agendaRef, {
          dateStr,
          version: ((agenda as any).version ?? 0) + 1,
          exclusividade: {
            tipo: "EXCLUSIVIDADE_CHURRASQUEIRA_2",
            reservaId: reservaRef.id,
            unidadeIdNorm: mUnidNorm, blocoIdNorm: mBlocoNorm,
            unidadeNumero: mUnidadeNum, blocoNome: mBlocoNome,
            inicioMin, fimMin,
            status: "HOLD",
            expiresAt: Timestamp.fromDate(expiresAt),
            criadoEm: FieldValue.serverTimestamp(),
            liberadoEm: null,
          },
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        return { mode: "RESERVA", slotId, reservaId: reservaRef.id };
      }

      // ── CAMINHO SIMPLES (compatível com comportamento existente) ──
      const primary = slotStates[0];
      const occupied = primary.occupied;
      const filaCount = primary.filaCount;

      // garante doc base do slot primário
      if (!primary.exists) {
        tx.set(slotRef, {
          areaId,
          dateStr,
          occupied: false,
          reservaId: null,
          filaCount: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        primary.slot = { areaId, dateStr, occupied: false, reservaId: null, filaCount: 0 };
      }

      if (occupied) {
        if (filaCount >= 3) {
          throw Object.assign(new Error("❌ Fila cheia (limite de 3)."), { status: 409 });
        }

        tx.set(filaDocRef, {
          uid,
          status: "AGUARDANDO",
          criadoPorUid: String(decoded.uid),
          reservaManualPorOperador: uid !== String(decoded.uid),
          opcaoId,
          opcaoNome,
          valorCobrado,
          capacidadeMax: Number.isFinite(Number(capacidadeMax)) ? Number(capacidadeMax) : null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        tx.set(lockRef, {
          uid,
          tipo: "FILA",
          areaId,
          dateStr,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        tx.set(slotRef, {
          filaCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        return { mode: "FILA", slotId, filaCount: filaCount + 1 };
      }

      // Slot livre → cria reserva e ocupa
      const reservaRef = reservasCol.doc();
      const dt = isoNoonUTC(dateStr);

        // UN.6C.1: Canonical unit fields (simple path — use outer scope canonical vars)
        const mdSp = membroPreSnap.exists ? (membroPreSnap.data() || {}) : {};
        const spBlocoId = canonicalBlocoId || String(mdSp.blocoId || mdSp.bloco || "");
        const spBlocoIdNorm = canonicalBlocoIdNorm || String(mdSp.blocoIdNorm || normBloco(mdSp.blocoId || mdSp.bloco) || "");
        const spUnidadeId = canonicalUnidadeNumero || String(mdSp.unidadeId || mdSp.apto || "");
        const spUnidadeIdNorm = canonicalUnidadeIdNorm || String(mdSp.unidadeIdNorm || normUnidade(spUnidadeId) || "");
        const spUnitDocId = canonicalUnitDocId || String(mdSp.unitDocId || "");
        const spPessoaId = pessoaId || String(mdSp.pessoaId || "");
        const spUnidadeSnapshot = spUnitDocId ? { unitDocId: spUnitDocId, blocoId: spBlocoId, blocoNome: canonicalBlocoNome || blocoNome || spBlocoId, unidadeNumero: spUnidadeId } : null;

      tx.set(reservaRef, {
        areaId,
        condominioId,
        uid,
        criadoPorUid: String(decoded.uid),
        reservaManualPorOperador: uid !== String(decoded.uid),
        status: statusFinal,
        precisaAprovacao,
        data: Timestamp.fromDate(dt),
        dateStr,
        valorCobrado,
        opcaoId,
        opcaoNome,
        capacidadeMax: Number.isFinite(Number(capacidadeMax)) ? Number(capacidadeMax) : null,
        // UN.6C.1: Canonical fields
        blocoId: spBlocoId || null,
        blocoIdNorm: spBlocoIdNorm || null,
        unidadeId: spUnidadeId || null,
        unidadeIdNorm: spUnidadeIdNorm || null,
        unitDocId: spUnitDocId || null,
        unidadeSnapshot: spUnidadeSnapshot || null,
        pessoaId: spPessoaId || null,
        policyVersion,
        policyHash: policyHashStr || null,
        criadoEm: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (hasFee) {
        const cobrancaRef = db.collection("condominios").doc(condominioId).collection("financeiro").doc();
        const md = membroSnap.exists ? (membroSnap.data() || {}) : {};
        const unidadeIdRaw = canonicalUnidadeNumero || String(md.unidadeId || md.apto || "");
        const unidadeIdNormVal = canonicalUnidadeIdNorm || String(md.unidadeIdNorm || normUnidade(unidadeIdRaw) || "");
        const numeroReserva = dateStr.replace(/-/g, "") + "-" + reservaRef.id.substring(0, 6).toUpperCase();
        const competenciaVal = dateStr.substring(0, 7);
        const unidadeNomeVal = [canonicalBlocoNome || blocoNome, unidadeIdRaw].filter(Boolean).join(" - ") || unidadeIdRaw || "";

        tx.set(cobrancaRef, {
          tipo: "TAXA_RESERVA",
          reservaId: reservaRef.id,
          numeroReserva,
          moradorUid: uid,
          moradorNome: String(md.nome || ""),
          blocoId: canonicalBlocoId || String(md.blocoId || md.bloco || ""),
          blocoIdNorm: canonicalBlocoIdNorm || String(md.blocoIdNorm || normBloco(md.blocoId || md.bloco) || ""),
          blocoNome: canonicalBlocoNome || blocoNome || String(md.blocoId || md.bloco || ""),
          unidadeId: unidadeIdRaw,
          unidadeIdNorm: unidadeIdNormVal,
          unidadeNome: unidadeNomeVal,
          areaId,
          areaNome: String(area?.nome || areaId),
          opcaoId,
          opcaoNome,
          valorCentavos: valorCobrado,
          competencia: competenciaVal,
          competenciaOriginal: competenciaVal,
          status: FinanceiroStatus.AGUARDANDO_ENVIO,
          descricao: `Taxa de Reserva — ${opcaoNome || "Área Comum"} (${dateStr})`,
          dataSolicitacao: FieldValue.serverTimestamp(),
          dataEvento: Timestamp.fromDate(dt),
          dataCriacaoLancamento: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          observacoes: "",
        });
      }

      // D.11.9.4: incrementar quota no caminho simples (write-only).
      if (quotaDoc && quotaKey && quotaYm) {
        incrementQuotaTx(tx, db, condominioId, quotaKey, quotaYm, reservaRef.id, quotaDoc);
      }

      tx.set(slotRef, {
        areaId,
        dateStr,
        occupied: true,
        reservaId: reservaRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      tx.set(lockRef, {
        uid,
        tipo: "RESERVA",
        areaId,
        dateStr,
        reservaId: reservaRef.id,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return { mode: "RESERVA", slotId, reservaId: reservaRef.id };
    });
    } catch (txErr: any) {
      const txMsg = String(txErr?.message || "");
      const txMsgLower = txMsg.toLowerCase();
      let motorDecisionDataTx: Parameters<typeof motorDecision>[0] | null = null;

      if (txMsgLower.includes("fila cheia")) {
        motorDecisionDataTx = {
          action: "QUEUE_JOIN", allowed: false,
          blockRule: "FILA_CHEIA", blockPriority: "VALIDATION",
          blockMessage: txMsg, blockOrigin: "DEFAULT",
        };
      } else if (txMsgLower.includes("você já tem")) {
        motorDecisionDataTx = {
          action: "CREATE", allowed: false,
          blockRule: undefined, blockPriority: undefined,
          blockMessage: txMsg, blockOrigin: undefined,
        };
      } else if (txMsgLower.includes("um ou mais recursos")) {
        motorDecisionDataTx = {
          action: "CREATE", allowed: false,
          blockRule: undefined, blockPriority: undefined,
          blockMessage: txMsg, blockOrigin: undefined,
        };
      }

      if (motorDecisionDataTx) {
        shadowEvaluate(db, motorDecision(motorDecisionDataTx), {
          condominioId, areaId, opcaoId, dateStr, uid,
          actorUid: String(decoded.uid),
          actorIsSuperAdmin: !!(decoded as any)?.super_admin || !!(decoded as any)?.superAdmin,
          actorRole: "", priceCentavos: valorCobrado,
          isOperatorAction: uid !== String(decoded.uid),
        }).catch(() => {});
      }

      throw txErr;
    }

    // Notificação de entrada na fila (pós-commit)
    if ((result as any)?.mode === "FILA") {
      notifyReservasUid(db, {
        condominioId,
        targetUid: uid,
        tipo: "FILA_ENTRADA",
        title: "Fila de espera",
        message: `Você entrou na fila de espera para ${String(area.nome || areaId)} no dia ${dateStr}.`,
        areaId,
        dateStr,
      }).catch(() => {});
    }

    // ── FASE D.4 — SHADOW: sucesso (RESERVA ou FILA) ──
    {
      const isFila = (result as any)?.mode === "FILA";
      shadowEvaluate(db, motorDecision({
        action: isFila ? "QUEUE_JOIN" : "CREATE",
        allowed: true,
        mode: isFila ? "FILA" : "RESERVA",
      }), { condominioId, areaId, opcaoId, dateStr, uid, actorUid: String(decoded.uid), actorIsSuperAdmin: !!(decoded as any)?.super_admin || !!(decoded as any)?.superAdmin, actorRole: "", priceCentavos: valorCobrado, isOperatorAction: uid !== String(decoded.uid) }).catch(() => {});
    }

    // ── D.12.2.1: Dispatcher para QUEUE_JOIN (autoridade via Feature Flag) ──
    if ((result as any)?.mode === "FILA") {
      dispatchReservaDecision(db, motorDecision({
        action: "QUEUE_JOIN", allowed: true,
      }), { condominioId, areaId, opcaoId, dateStr, uid, actorUid: String(decoded.uid), actorIsSuperAdmin: false, actorRole: "", priceCentavos: valorCobrado, isOperatorAction: false }).catch(() => {});
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    const status = Number(err?.status || 0) || 500;
    const msg = String(err?.message || "Erro inesperado");
    console.error("[API reservas/criar] erro:", err);
    return jsonError(msg, status);
  }
}
