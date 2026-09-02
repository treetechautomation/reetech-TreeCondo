import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { createHash } from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { createWithdrawEvent } from "@/lib/encomendas/withdrawal";
import { evaluatePackagePinAttempt, type PackagePinOutcome } from "@/lib/encomendas/packagePinPolicy";
import { logEncomendaEvent, extractCorrelationId } from "@/lib/encomendas/logger";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { normUnidade, normBloco } from "@/lib/normalization/location";
import { notifyUnidade } from "@/lib/notifications/notifyUnidade";

/**
 * ENCOMENDAS.2D — mapeamento seguro de outcome -> resposta HTTP.
 * Nenhuma mensagem revela hash, PIN esperado, ou detalhes de implementação
 * além do necessário para a UX (ex.: até quando o bloqueio dura).
 */
function packagePinOutcomeToResponse(outcome: PackagePinOutcome): { message: string; status: number } {
  switch (outcome.code) {
    case "PIN_INVALID":
      return { message: "PIN incorreto.", status: 403 };
    case "PIN_LOCKED":
      return { message: `PIN bloqueado por excesso de tentativas. Tente novamente após ${outcome.lockedUntil}.`, status: 429 };
    case "PIN_EXPIRED":
      return { message: "PIN expirado.", status: 410 };
    case "CREDENTIAL_NOT_CONFIGURED":
      return { message: "PIN de retirada não configurado para esta encomenda.", status: 400 };
    case "PACKAGE_ALREADY_WITHDRAWN":
      return { message: "Essa encomenda já foi retirada.", status: 409 };
    case "STATUS_INVALID":
      return { message: "Encomenda não está aguardando retirada.", status: 409 };
    default:
      return { message: "Não foi possível confirmar a retirada.", status: 400 };
  }
}

function sha256(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

export async function POST(req: Request) {
  const db = adminDb();
  const correlationId = extractCorrelationId(req);

  try {
    const body = (await req.json().catch(() => ({}))) as any;

    const condominioId = String(body?.condominioId || "").trim();
    const encomendaId = String(body?.encomendaId || "").trim();
    const codigo = body?.codigo ? String(body.codigo).trim() : "";
    const moradorUid = body?.moradorUid ? String(body.moradorUid).trim() : "";
    const pinMorador = body?.pinMorador ? String(body.pinMorador).trim() : "";
    const recebedorNome = body?.recebedorNome ? String(body.recebedorNome).trim() : "";
    const recebedorCpf = body?.recebedorCpf ? String(body.recebedorCpf).trim() : "";
    const recebedorParentesco = body?.recebedorParentesco ? String(body.recebedorParentesco).trim() : "";

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!encomendaId) return jsonError("encomendaId é obrigatório", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["PORTEIRO", "ZELADOR", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO"],
    });

    const actorUid = ctx.uid;
    const actorEmail = ctx.email;
    const actorNome = String(ctx.membroData?.nome || ctx.decodedToken?.name || ctx.decodedToken?.email || "Operador").trim();
    const actorRole = String(ctx.membroData?.role || ctx.role || "");

    if (String(actorRole).toUpperCase() === "MORADOR") {
      return jsonError("A retirada deve ser confirmada por um operador da portaria.", 403);
    }

    const ref = db.collection("condominios").doc(condominioId).collection("encomendas").doc(encomendaId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Encomenda não encontrada.", 404);

    const data = snap.data() as any;

    if (data?.condominioId && String(data.condominioId) !== condominioId) {
      return jsonError("Encomenda não pertence a este condomínio.", 403);
    }

    if (String(data?.status || "").toUpperCase() === "RETIRADA") {
      return jsonError("Essa encomenda já foi retirada.", 409);
    }

    if (moradorUid && pinMorador) {
      const pinDigits = pinMorador.replace(/\D/g, "");
      if (pinDigits.length < 4) return jsonError("PIN inválido.", 400);
      if (!recebedorNome) return jsonError("O nome de quem retira é obrigatório.", 400);

      const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(moradorUid);
      const membroSnap = await membroRef.get();
      if (!membroSnap.exists) return jsonError("Morador selecionado não encontrado.", 404);

      const membroData = membroSnap.data() as any;
      const failedAttempts = membroData.encomendaPinFailedAttempts || 0;

      if (failedAttempts >= 6) {
        return jsonError("PIN bloqueado por excesso de tentativas. O morador precisa redefinir o PIN na tela de Configurações.", 429);
      }

      const pinHash = sha256(pinDigits);
      const storedPinHash = membroData.encomendaPinHash || membroData.pinEncomendasHash;
      if (!storedPinHash) {
        return jsonError("PIN de retirada não configurado para este morador.", 400);
      }
      if (pinHash !== storedPinHash) {
        const newAttempts = failedAttempts + 1;
        await membroRef.update({ encomendaPinFailedAttempts: newAttempts });
        const attemptsLeft = 6 - newAttempts;
        const errorMsg = attemptsLeft > 0
          ? `PIN inválido. Você tem mais ${attemptsLeft} tentativas.`
          : "PIN inválido. Seu PIN foi bloqueado.";
        return jsonError(errorMsg, 403);
      }

      const membroUnNorm = String(
        membroData.unidadeIdNorm || normUnidade(membroData.unidadeId || membroData.apartamento) || ""
      ).trim();
      const membroBlNorm =
        membroData.blocoIdNorm != null && String(membroData.blocoIdNorm).trim() !== ""
          ? String(membroData.blocoIdNorm).trim()
          : (membroData.blocoId || membroData.bloco ? normBloco(membroData.blocoId || membroData.bloco) : "");

      const encUnNorm = String(data?.unidadeIdNorm || normUnidade(data?.unidadeId) || "").trim();
      const encBlNorm =
        data?.blocoIdNorm != null && String(data.blocoIdNorm).trim() !== ""
          ? String(data.blocoIdNorm).trim()
          : (data?.blocoId ? normBloco(data.blocoId) : "");

      if (!membroUnNorm || encUnNorm !== membroUnNorm || encBlNorm !== membroBlNorm) {
        return jsonError("O PIN informado não pertence ao destinatário desta encomenda.", 403);
      }

      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(ref);
        if (!fresh.exists) {
          throw Object.assign(new Error("Encomenda não encontrada."), { status: 404 });
        }
        if (String((fresh.data() as any)?.status || "").toUpperCase() !== "AGUARDANDO") {
          throw Object.assign(new Error("Essa encomenda já foi retirada."), { status: 409 });
        }
        if (failedAttempts > 0) {
          tx.update(membroRef, { encomendaPinFailedAttempts: 0 });
        }
        tx.update(ref, {
          status: "RETIRADA",
          retiradaEm: FieldValue.serverTimestamp(),
          retiradoEm: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          registradoPorUid: actorUid,
          registradoPorNome: String(ctx.decodedToken?.name || ctx.decodedToken?.email || "Operador"),
          retiradoPorUid: actorUid,
          retiradoPorNome: actorNome,
          retiradoPorEmail: actorEmail,
          retiradoPorRole: actorRole,
          retiradaRecebedorNome: recebedorNome,
          retiradaRecebedorCpfHash: recebedorCpf ? sha256(recebedorCpf.replace(/\D/g, "")) : null,
          retiradaRecebedorCpfLast4: recebedorCpf ? recebedorCpf.replace(/\D/g, "").slice(-4) : null,
          retiradaRecebedorParentesco: recebedorParentesco || "Não informado",
          withdrawMethod: "PIN",
        });
        const eventRef = ref.collection("events").doc();
        tx.set(eventRef, createWithdrawEvent(
          "WITHDRAWN",
          actorUid,
          actorRole,
          actorNome,
          { method: "PIN", encomendaId, condominioId },
        ));
      });

    } else if (codigo) {
      // ENCOMENDAS.2D: a credencial ativa por encomenda é pinHash (emitida/
      // reemitida por /api/encomendas/credencial), não codigoRetiradaHash
      // (campo legado, nunca atualizado na reemissão — ver ENCOMENDAS.2D
      // finding). Toda a decisão de segurança acontece dentro da MESMA
      // transação, sobre leitura fresca, seguindo evaluatePackagePinAttempt.
      let pinOutcome: PackagePinOutcome | undefined;

      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(ref);
        if (!fresh.exists) {
          throw Object.assign(new Error("Encomenda não encontrada."), { status: 404 });
        }
        const freshData = fresh.data() as any;
        const evalResult = evaluatePackagePinAttempt(freshData, codigo, new Date());
        pinOutcome = evalResult.outcome;

        // Mutação de tentativa/bloqueio/reset SEMPRE commita, mesmo quando
        // o resultado final é rejeição — do contrário o Firestore reverteria
        // o incremento junto com o restante do callback (ver ENCOMENDAS.2D
        // Fase 10). Por isso este bloco nunca lança para PIN_INVALID/
        // PIN_LOCKED/PIN_EXPIRED — apenas aplica a mutação e retorna.
        if (evalResult.mutation) {
          tx.update(ref, evalResult.mutation);
        }

        if (evalResult.outcome.code === "SUCCESS") {
          tx.update(ref, {
            status: "RETIRADA",
            retiradaEm: FieldValue.serverTimestamp(),
            retiradoEm: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            registradoPorUid: actorUid,
            registradoPorNome: String(ctx.decodedToken?.name || ctx.decodedToken?.email || "Operador"),
            retiradoPorUid: actorUid,
            retiradoPorNome: actorNome,
            retiradoPorEmail: actorEmail,
            retiradoPorRole: actorRole,
            retiradaRecebedorNome: recebedorNome || "Próprio morador",
            withdrawMethod: "PIN",
          });
          const eventRef2 = ref.collection("events").doc();
          tx.set(eventRef2, createWithdrawEvent(
            "WITHDRAWN",
            actorUid,
            actorRole,
            actorNome,
            { method: "PIN", encomendaId, condominioId },
          ));
        }
      });

      if (!pinOutcome || pinOutcome.code !== "SUCCESS") {
        const outcome = pinOutcome as PackagePinOutcome;
        const { message, status } = packagePinOutcomeToResponse(outcome);

        if (outcome.code === "PIN_INVALID") {
          logEncomendaEvent({
            event: "PACKAGE_PIN_FAILED",
            timestamp: new Date().toISOString(),
            operation: "retirar",
            result: "failed",
            condominioId,
            encomendaId,
            actorUid,
            actorRole,
            method: "PIN",
            attempt: outcome.attempt,
            correlationId,
          });
          if (outcome.locked && outcome.lockedUntil) {
            logEncomendaEvent({
              event: "PACKAGE_PIN_LOCKED",
              timestamp: new Date().toISOString(),
              operation: "retirar",
              result: "blocked",
              condominioId,
              encomendaId,
              actorUid,
              actorRole,
              method: "PIN",
              lockedUntil: outcome.lockedUntil,
              correlationId,
            });
          }
        } else if (outcome.code === "PIN_LOCKED") {
          logEncomendaEvent({
            event: "PACKAGE_PIN_LOCKED",
            timestamp: new Date().toISOString(),
            operation: "retirar",
            result: "blocked",
            condominioId,
            encomendaId,
            actorUid,
            actorRole,
            method: "PIN",
            lockedUntil: outcome.lockedUntil,
            correlationId,
          });
        }

        return jsonError(message, status);
      }
    } else {
      return jsonError("Informe o código da encomenda (PKG-...) ou use o modo 'Sem Celular' com PIN do morador.", 400);
    }

    try {
      await notifyUnidade(db, {
        condominioId,
        unidadeId: String(data?.unidadeId || ""),
        blocoId: data?.blocoId ?? null,
        encomendaId,
      });
    } catch (e: any) {
      console.error("[encomendas/retirar] falha ao notificar:", e?.message || e);
    }

    // ENCOMENDAS.2D: os dois branches restantes (PIN pessoal do morador e
    // PIN da encomenda) só chegam aqui em sucesso — ambos são credenciais
    // tipo PIN validadas via hash; nenhum branch de "PORTEIRO sem
    // credencial" existe mais nesta rota.
    logEncomendaEvent({
      event: "PACKAGE_WITHDRAW_PIN_SUCCESS",
      timestamp: new Date().toISOString(),
      operation: "retirar",
      result: "success",
      condominioId,
      encomendaId,
      actorUid,
      actorRole,
      method: "PIN",
      correlationId,
    });

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    if (err instanceof Response) return err;
    const status = Number(err?.status || 0) || 500;
    logEncomendaEvent({
      event: "PACKAGE_PIN_FAILED",
      timestamp: new Date().toISOString(),
      operation: "retirar",
      result: "error",
      condominioId: null,
      encomendaId: null,
      actorUid: null,
      errorCode: String(status),
      errorMessage: err?.message || "Erro inesperado",
      correlationId,
    });
    return jsonError(err?.message || "Erro inesperado", status);
  }
}
