/**
 * FASE 16.6 / R1 — POST /api/campo/registrar
 *
 * Registra uso compartilhado do Campo/Quadra.
 * Valida via Policy Engine (CAMPO_FORA_HORARIO) com intervalo em minutos.
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { getCompiledPolicy, makeContext, todaySaoPauloISO } from "@/lib/reservas/policy-engine";
import { createAdminPolicyRepository } from "@/lib/reservas/policy-engine/adapters/admin";
import { createCachedPolicyRepository } from "@/lib/reservas/policy-engine/repository";
import { validate } from "@/lib/reservas/policy-engine/validator";
import { normUnidade, normBloco } from "@/lib/normalization/location";
import { checkReservaBlockTx } from "@/lib/reservas/bloqueios-helper";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_HHMM = /^\d{2}:\d{2}$/;

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export async function POST(request: Request) {
  try {
    let body;
    try { body = await request.json(); } catch { return jsonError("Body inválido.", 400); }

    const condominioId = String(body?.condominioId ?? "").trim();
    const dateStr = String(body?.dateStr ?? "").trim();
    const horaInicio = String(body?.horaInicio ?? "").trim();
    const horaFim = String(body?.horaFim ?? "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);
    if (!dateStr || !VALID_DATE.test(dateStr)) return jsonError("dateStr inválido. Use YYYY-MM-DD.", 400);
    if (!horaInicio || !VALID_HHMM.test(horaInicio)) return jsonError("horaInicio inválido. Use HH:mm.", 400);
    if (!horaFim || !VALID_HHMM.test(horaFim)) return jsonError("horaFim inválido. Use HH:mm.", 400);

    const [hiH, hiM] = horaInicio.split(":").map(Number);
    const [hfH, hfM] = horaFim.split(":").map(Number);
    if (hiH > 23 || hiM > 59 || hfH > 23 || hfM > 59) {
      return jsonError("Horário inválido. HH:mm deve estar entre 00:00 e 23:59.", 400);
    }

    const inicioMin = hhmmToMin(horaInicio);
    const fimMin = hhmmToMin(horaFim);
    if (inicioMin < 0 || fimMin > 1440) return jsonError("Intervalo fora dos limites do dia.", 400);
    if (inicioMin >= fimMin) return jsonError("Horário de início deve ser anterior ao horário de fim.", 400);

    if (dateStr < todaySaoPauloISO()) {
      return jsonError("Não é possível registrar uso em data passada.", 400);
    }

    const ctx = await apiGuard({
      request,
      condominioId,
    });

    const membro = ctx.membroData;
    if (!membro) return jsonError("Membro não encontrado no condomínio.", 403);

    const blocoIdNorm = normBloco(membro.blocoIdNorm ?? membro.bloco ?? "");
    const unidadeIdNorm = normUnidade(membro.unidadeIdNorm ?? membro.unidade ?? membro.apartamento ?? "");

    let blocoNome = String(membro.blocoNome ?? membro.blocoNome ?? "").trim();
    let unidadeNumero = String(membro.unidadeNumero ?? membro.unidade ?? membro.apartamento ?? "").trim();

    if (!blocoNome || !unidadeNumero) {
      const db = adminDb();
      const vinculosUnidades = await db.collection("condominios").doc(condominioId)
        .collection("vinculosUnidades")
        .where("uid", "==", ctx.uid)
        .where("status", "==", "ATIVO")
        .limit(1)
        .get();
      if (!vinculosUnidades.empty) {
        const vu = vinculosUnidades.docs[0].data();
        blocoNome = blocoNome || String(vu.blocoNome ?? "").trim();
        unidadeNumero = unidadeNumero || String(vu.unidadeNumero ?? "").trim();
      }
    }

    const nomeMorador = String(membro.nome ?? membro.displayName ?? "").trim();

    const db = adminDb();
    const areaId = "quadra";
    const repo = createCachedPolicyRepository(createAdminPolicyRepository(db));
    const target = { condominioId, areaId };
    const compiled = await getCompiledPolicy(repo, target);
    const policyCtx = makeContext({
      dateStr,
      target,
      actor: {
        uid: ctx.uid,
        exists: true,
        status: "ATIVO",
        role: ctx.role || "MORADOR",
        blocoIdNorm,
        unidadeIdNorm,
        isSuperAdmin: ctx.isSuperAdmin,
        isPaidUp: null,
        recentNoShows: 0,
        suspendedUntil: null,
      },
      campoInicioMin: inicioMin,
      campoFimMin: fimMin,
    });

    const result = validate("CAMPO_REGISTRAR", compiled, policyCtx);
    if (!result.allowed) {
      const violation = result.violations[0];
      return jsonError(
        violation?.message ?? "Uso do Campo não permitido pela política do condomínio.",
        409
      );
    }

    const agendaRef = db.collection("condominios").doc(condominioId).collection("campoAgenda").doc(dateStr);
    const registroRef = db.collection("condominios").doc(condominioId).collection("usoCampo").doc();

    await db.runTransaction(async (tx: any) => {
      const blockCheck = await checkReservaBlockTx(tx, db, {
        condominioId, uid: ctx.uid,
        unidadeIdNorm: blocoIdNorm ?? "", blocoIdNorm: blocoIdNorm ?? "",
        areaId, escopoOperacao: "USO_CAMPO",
      });
      if (blockCheck.blocked) {
        throw Object.assign(
          new Error(blockCheck.motivoPublico ?? "Esta unidade está temporariamente impedida de usar o Campo."),
          { status: 403 }
        );
      }

      const agendaSnap = await tx.get(agendaRef);
      if (agendaSnap.exists) {
        const agenda = agendaSnap.data()!;
        const exc = agenda.exclusividade ?? null;
        if (exc) {
          const now = new Date();
          if (exc.status === "ATIVA" || (exc.status === "HOLD" && exc.expiresAt && exc.expiresAt.toDate() > now)) {
            if (inicioMin < exc.fimMin && fimMin > exc.inicioMin) {
              throw Object.assign(
                new Error("Campo indisponível neste horário devido a exclusividade vinculada à Churrasqueira 2."),
                { status: 409 }
              );
            }
          }
        }
      }

      const ts = FieldValue.serverTimestamp();
      tx.set(registroRef, {
        uid: ctx.uid, unidadeIdNorm, blocoIdNorm, nomeMorador, blocoNome, unidadeNumero,
        dateStr, horaInicio, horaFim, inicioMin, fimMin,
        unitKey: `${condominioId}::${(blocoIdNorm ?? "").toLowerCase()}::${(unidadeIdNorm ?? "").toLowerCase()}`,
        status: "ATIVO", criadoEm: ts, canceladoEm: null, canceladoPorUid: null, updatedAt: ts,
      });

      tx.set(agendaRef, {
        dateStr,
        version: (agendaSnap.exists ? (agendaSnap.data()!.version ?? 0) : 0) + 1,
        updatedAt: ts,
      }, { merge: true });
    });

    return NextResponse.json({ ok: true, registroId: registroRef.id });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
