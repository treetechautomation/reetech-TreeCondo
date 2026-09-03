import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { createWithdrawEvent } from "@/lib/encomendas/withdrawal";
import { logEncomendaEvent, extractCorrelationId } from "@/lib/encomendas/logger";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { normUnidade, normBloco } from "@/lib/normalization/location";
import { notifyUnidade } from "@/lib/notifications/notifyUnidade";

export async function POST(req: Request) {
  const db = adminDb();
  const correlationId = extractCorrelationId(req);

  try {
    const body = (await req.json().catch(() => ({}))) as any;

    const condominioId = String(body?.condominioId || "").trim();
    const tokenLote = body?.token ? String(body.token).trim() : null;
    const recebedorNome = body?.recebedorNome ? String(body.recebedorNome).trim() : "Próprio morador";

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);

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

    if (tokenLote && tokenLote.startsWith("LOTE-")) {
      const loteRef = db
        .collection("condominios").doc(condominioId)
        .collection("retiradas_lote").doc(tokenLote);

      const notifData: Array<{ encomendaId: string; unidadeId: string; blocoId: string | null; transportadora: string }> = [];

      await db.runTransaction(async (tx: any) => {
        const loteSnap = await tx.get(loteRef);
        if (!loteSnap.exists) {
          throw Object.assign(new Error("Código de lote não encontrado."), { status: 404 });
        }
        const lote = loteSnap.data() || {};

        if (String(lote.status || "").toUpperCase() === "UTILIZADO") {
          throw Object.assign(new Error("Este QR Code de lote já foi utilizado."), { status: 409 });
        }

        const expiraEm = lote.expiraEm?.toDate
          ? lote.expiraEm.toDate()
          : (lote.expiraEm ? new Date(lote.expiraEm) : null);
        if (String(lote.status || "").toUpperCase() === "EXPIRADO" || (expiraEm && expiraEm.getTime() < Date.now())) {
          throw Object.assign(new Error("Este QR Code de lote expirou."), { status: 403 });
        }

        const moradorUid = String(lote.moradorUid || "").trim();
        if (!moradorUid) {
          throw Object.assign(new Error("Lote sem morador associado."), { status: 400 });
        }

        const membroRef = db
          .collection("condominios").doc(condominioId)
          .collection("membros").doc(moradorUid);
        const membroSnap = await tx.get(membroRef);
        if (!membroSnap.exists) {
          throw Object.assign(new Error("Morador do lote não encontrado neste condomínio."), { status: 403 });
        }
        const membro = membroSnap.data() || {};
        if (String(membro.status || "").toUpperCase() !== "ATIVO") {
          throw Object.assign(new Error("O vínculo do morador não está ativo."), { status: 403 });
        }

        const membroUnNorm = String(
          membro.unidadeIdNorm || normUnidade(membro.unidadeId || membro.apartamento) || ""
        ).trim();
        const membroBlNorm =
          membro.blocoIdNorm != null && String(membro.blocoIdNorm).trim() !== ""
            ? String(membro.blocoIdNorm).trim()
            : (membro.blocoId || membro.bloco ? normBloco(membro.blocoId || membro.bloco) : "");

        if (!membroUnNorm) {
          throw Object.assign(new Error("Unidade do morador não cadastrada."), { status: 403 });
        }

        const encomendaIds: string[] = Array.isArray(lote.encomendaIds)
          ? lote.encomendaIds.map((x: any) => String(x)).filter(Boolean)
          : [];
        if (encomendaIds.length === 0) {
          throw Object.assign(new Error("Nenhuma encomenda vinculada a este lote."), { status: 404 });
        }

        const encRefs = encomendaIds.map((id) =>
          db.collection("condominios").doc(condominioId).collection("encomendas").doc(id)
        );
        const encSnaps = await tx.getAll(...encRefs);

        for (let i = 0; i < encSnaps.length; i++) {
          const s = encSnaps[i];
          if (!s.exists) {
            throw Object.assign(new Error("Uma encomenda do lote não existe mais."), { status: 409 });
          }
          const e = s.data() || {};

          if (e.condominioId && String(e.condominioId) !== condominioId) {
            throw Object.assign(new Error("Encomenda pertence a outro condomínio."), { status: 403 });
          }

          const eUn = String(e.unidadeIdNorm || normUnidade(e.unidadeId) || "").trim();
          const eBl =
            e.blocoIdNorm != null && String(e.blocoIdNorm).trim() !== ""
              ? String(e.blocoIdNorm).trim()
              : "";
          if (eUn !== membroUnNorm) {
            throw Object.assign(new Error("Encomenda pertence a outra unidade."), { status: 403 });
          }
          if (eBl !== membroBlNorm) {
            throw Object.assign(new Error("Encomenda pertence a outro bloco."), { status: 403 });
          }

          if (String(e.status || "").toUpperCase() !== "AGUARDANDO") {
            throw Object.assign(new Error("Uma encomenda deste lote já foi retirada."), { status: 409 });
          }
        }

        for (let i = 0; i < encRefs.length; i++) {
          const e = encSnaps[i].data() || {};
          // ENCOMENDAS.2F: registradoPor* é identidade de criação imutável
          // — nunca reescrita na retirada (retiradoPor* já é o campo do
          // ator que confirma).
          tx.update(encRefs[i], {
            status: "RETIRADA",
            retiradaEm: FieldValue.serverTimestamp(),
            retiradoEm: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            retiradoPorUid: actorUid,
            retiradoPorNome: actorNome,
            retiradoPorEmail: actorEmail,
            retiradoPorRole: actorRole,
            retiradaRecebedorNome: recebedorNome,
            withdrawMethod: "QR_CODE",
          });
          const eventRef = encRefs[i].collection("events").doc();
          tx.set(eventRef, createWithdrawEvent(
            "WITHDRAWN",
            actorUid,
            actorRole,
            actorNome,
            { method: "QR_CODE", encomendaId: encomendaIds[i], condominioId, lote: tokenLote },
          ));
          notifData.push({
            encomendaId: encomendaIds[i],
            unidadeId: String(e.unidadeId || ""),
            blocoId: e.blocoId ?? null,
            transportadora: String(e.transportadora || "transportadora"),
          });
        }

        tx.update(loteRef, {
          status: "UTILIZADO",
          utilizadoEm: FieldValue.serverTimestamp(),
          utilizadoPorUid: actorUid,
          utilizadoPorNome: actorNome,
        });
      });

      for (const nd of notifData) {
        try {
          await notifyUnidade(db, {
            condominioId,
            unidadeId: nd.unidadeId,
            blocoId: nd.blocoId,
            encomendaId: nd.encomendaId,
          });
        } catch (e: any) {
          console.error(`[API retirar-lote] falha ao notificar encomenda ${nd.encomendaId}:`, e?.message || e);
        }
      }

      return NextResponse.json({ ok: true, quantidadeRetirada: notifData.length });
    }

    const encomendaIdsIndividuaisRaw = Array.isArray(body?.encomendaIds)
      ? body.encomendaIds.map((x: any) => String(x).trim()).filter(Boolean)
      : [];
    if (encomendaIdsIndividuaisRaw.length === 0) {
      return jsonError("Nenhuma encomenda selecionada para retirada.", 400);
    }

    const notifIndiv: Array<{ encomendaId: string; unidadeId: string; blocoId: string | null; transportadora: string }> = [];

    await db.runTransaction(async (tx: any) => {
      const refs = encomendaIdsIndividuaisRaw.map((id: string) =>
        db.collection("condominios").doc(condominioId).collection("encomendas").doc(id)
      );
      const snaps = await tx.getAll(...refs);

      for (let i = 0; i < snaps.length; i++) {
        const s = snaps[i];
        if (!s.exists) {
          throw Object.assign(new Error("Encomenda não encontrada."), { status: 404 });
        }
        const e = s.data() || {};
        if (e.condominioId && String(e.condominioId) !== condominioId) {
          throw Object.assign(new Error("Encomenda pertence a outro condomínio."), { status: 403 });
        }
        if (String(e.status || "").toUpperCase() !== "AGUARDANDO") {
          throw Object.assign(new Error("Uma encomenda já foi retirada."), { status: 409 });
        }
      }

      for (let i = 0; i < refs.length; i++) {
        const e = snaps[i].data() || {};
        // ENCOMENDAS.2F: registradoPor* preservado — ver comentário
        // equivalente acima.
        tx.update(refs[i], {
          status: "RETIRADA",
          retiradaEm: FieldValue.serverTimestamp(),
          retiradoEm: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          retiradoPorUid: actorUid,
          retiradoPorNome: actorNome,
          retiradoPorEmail: actorEmail,
          retiradoPorRole: actorRole,
          retiradaRecebedorNome: recebedorNome,
          withdrawMethod: "PORTEIRO",
        });
        const eventRef2 = refs[i].collection("events").doc();
        tx.set(eventRef2, createWithdrawEvent(
          "WITHDRAWN",
          actorUid,
          actorRole,
          actorNome,
          { method: "PORTEIRO", encomendaId: encomendaIdsIndividuaisRaw[i], condominioId },
        ));
        notifIndiv.push({
          encomendaId: encomendaIdsIndividuaisRaw[i],
          unidadeId: String(e.unidadeId || ""),
          blocoId: e.blocoId ?? null,
          transportadora: String(e.transportadora || "transportadora"),
        });
      }
    });

    for (const nd of notifIndiv) {
      try {
        await notifyUnidade(db, {
          condominioId,
          unidadeId: nd.unidadeId,
          blocoId: nd.blocoId,
          encomendaId: nd.encomendaId,
        });
      } catch (e: any) {
        console.error(`[API retirar-lote] falha ao notificar encomenda ${nd.encomendaId}:`, e?.message || e);
      }
    }

    return NextResponse.json({ ok: true, quantidadeRetirada: notifIndiv.length });

  } catch (err: any) {
    if (err instanceof Response) return err;
    const status = Number(err?.status || 0) || 500;
    logEncomendaEvent({
      event: "PACKAGE_PIN_FAILED",
      timestamp: new Date().toISOString(),
      operation: "retirar-lote",
      result: "error",
      condominioId: null,
      actorUid: null,
      errorCode: String(status),
      errorMessage: err?.message || "Erro inesperado no servidor",
      correlationId,
    });
    return jsonError(String(err?.message || "Erro inesperado no servidor"), status);
  }
}
