import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { createWithdrawEvent } from "@/lib/encomendas/withdrawal";
import { logEncomendaEvent, extractCorrelationId } from "@/lib/encomendas/logger";
import { normUnidade, normBloco } from "@/lib/normalization/location";
import { notifyUnidade } from "@/lib/notifications/notifyUnidade";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}



async function getActorInfo(db: any, params: { condominioId: string; uid: string; decoded: any }) {
  const { condominioId, uid, decoded } = params;
  const email = String(decoded?.email || "").toLowerCase();
  let nome = String(decoded?.name || decoded?.email || "Operador").trim();
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
    console.warn("[encomendas/retirar-lote] getActorInfo falhou:", e?.message || String(e));
  }

  return { uid, email, nome, role, status };
}

// [UN.6F] notifyUnidade movido para lib/notifications/notifyUnidade.ts

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();
  const correlationId = extractCorrelationId(req);

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const decoded = await aauth.verifyIdToken(token);
    const body = (await req.json().catch(() => ({}))) as any;

    const condominioId = String(body?.condominioId || "").trim();
    const tokenLote = body?.token ? String(body.token).trim() : null;
    const recebedorNome = body?.recebedorNome ? String(body.recebedorNome).trim() : "Próprio morador";
    // SEGURANÇA: body.encomendaIds é IGNORADO por completo. Os IDs vêm sempre do Firestore.

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);

    const actor = await getActorInfo(db, { condominioId, uid: decoded.uid, decoded });
    const actorRoleUpper = String(actor.role || "").toUpperCase();
    const isSuperAdmin =
      (decoded as any)?.super_admin === true ||
      (decoded as any)?.superAdmin === true ||
      actorRoleUpper === "SUPER_ADMIN";

    // ACL: a retirada física é confirmada EXCLUSIVAMENTE por operador ATIVO da portaria.
    // O MORADOR pode gerar/apresentar o QR, mas NUNCA concluir a retirada pela API.
    const PAPEIS_OPERADOR = ["PORTEIRO", "ZELADOR", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO"];

    if (actorRoleUpper === "MORADOR") {
      return jsonError("A retirada deve ser confirmada por um operador da portaria.", 403);
    }
    if (!isSuperAdmin) {
      // Fonte da verdade: condominios/{condominioId}/membros/{uid}
      if (String(actor.status || "").toUpperCase() !== "ATIVO") {
        return jsonError("Seu vínculo com o condomínio não está ativo.", 403);
      }
      if (!PAPEIS_OPERADOR.includes(actorRoleUpper)) {
        return jsonError("Apenas operadores autorizados podem registrar retiradas.", 403);
      }
    }

    // =====================================================================
    // FLUXO LOTE — fonte da verdade EXCLUSIVA: retiradas_lote/{token}
    // Ignora qualquer encomendaIds/unidade/bloco/moradorUid vindo do cliente.
    // Tudo dentro de UMA transação (all-or-nothing).
    // =====================================================================
    if (tokenLote && tokenLote.startsWith("LOTE-")) {
      const loteRef = db
        .collection("condominios").doc(condominioId)
        .collection("retiradas_lote").doc(tokenLote);

      const notifData: Array<{ encomendaId: string; unidadeId: string; blocoId: string | null; transportadora: string }> = [];

      await db.runTransaction(async (tx: any) => {
        // (1) Token válido
        const loteSnap = await tx.get(loteRef);
        if (!loteSnap.exists) {
          throw Object.assign(new Error("Código de lote não encontrado."), { status: 404 });
        }
        const lote = loteSnap.data() || {};

        // (3) Token não utilizado
        if (String(lote.status || "").toUpperCase() === "UTILIZADO") {
          throw Object.assign(new Error("Este QR Code de lote já foi utilizado."), { status: 409 });
        }

        // (2) Token não expirado
        const expiraEm = lote.expiraEm?.toDate
          ? lote.expiraEm.toDate()
          : (lote.expiraEm ? new Date(lote.expiraEm) : null);
        if (String(lote.status || "").toUpperCase() === "EXPIRADO" || (expiraEm && expiraEm.getTime() < Date.now())) {
          throw Object.assign(new Error("Este QR Code de lote expirou."), { status: 403 });
        }

        // Morador dono do lote (do documento, nunca do cliente)
        const moradorUid = String(lote.moradorUid || "").trim();
        if (!moradorUid) {
          throw Object.assign(new Error("Lote sem morador associado."), { status: 400 });
        }

        // (5) Morador do lote precisa estar ATIVO e ter unidade cadastrada
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

        // IDs vêm EXCLUSIVAMENTE do documento do lote
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

        // Validações (4/6/7/8/9): condomínio, unidade e bloco iguais aos do morador; AGUARDANDO.
        // Qualquer encomenda inválida cancela TODA a operação.
        for (let i = 0; i < encSnaps.length; i++) {
          const s = encSnaps[i];
          if (!s.exists) {
            throw Object.assign(new Error("Uma encomenda do lote não existe mais."), { status: 409 });
          }
          const e = s.data() || {};

          // (4) mesmo condomínio
          if (e.condominioId && String(e.condominioId) !== condominioId) {
            throw Object.assign(new Error("Encomenda pertence a outro condomínio."), { status: 403 });
          }

          // (6/7/8/9) unidade e bloco EXATAMENTE iguais aos do morador do lote
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

          // Proteção contra retirada parcial/replay
          if (String(e.status || "").toUpperCase() !== "AGUARDANDO") {
            throw Object.assign(new Error("Uma encomenda deste lote já foi retirada."), { status: 409 });
          }
        }

        // Tudo validado -> grava RETIRADA + auditoria em todas, e marca o lote UTILIZADO.
        for (let i = 0; i < encRefs.length; i++) {
          const e = encSnaps[i].data() || {};
          tx.update(encRefs[i], {
            status: "RETIRADA",
            retiradaEm: FieldValue.serverTimestamp(),
            retiradoEm: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            registradoPorUid: decoded.uid,
            registradoPorNome: (decoded.name || decoded.email || "Operador").toString(),
            retiradoPorUid: actor.uid,
            retiradoPorNome: actor.nome,
            retiradoPorEmail: actor.email,
            retiradoPorRole: actor.role,
            retiradaRecebedorNome: recebedorNome,
            withdrawMethod: "QR_CODE",
          });
          // E.3.3: Registrar evento WITHDRAWN na subcoleção events
          const eventRef = encRefs[i].collection("events").doc();
          tx.set(eventRef, createWithdrawEvent(
            "WITHDRAWN",
            actor.uid,
            actor.role,
            actor.nome,
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
          utilizadoPorUid: actor.uid,
          utilizadoPorNome: actor.nome,
        });
      });

      // Notificações (fora da transação — comportamento inalterado)
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

    // =====================================================================
    // FLUXO INDIVIDUAL (sem token de lote) — somente OPERADOR.
    // =====================================================================
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
        tx.update(refs[i], {
          status: "RETIRADA",
          retiradaEm: FieldValue.serverTimestamp(),
          retiradoEm: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          registradoPorUid: decoded.uid,
          registradoPorNome: (decoded.name || decoded.email || "Operador").toString(),
          retiradoPorUid: actor.uid,
          retiradoPorNome: actor.nome,
          retiradoPorEmail: actor.email,
          retiradoPorRole: actor.role,
          retiradaRecebedorNome: recebedorNome,
          withdrawMethod: "PORTEIRO",
        });
        // E.3.3: Registrar evento WITHDRAWN na subcoleção events
        const eventRef2 = refs[i].collection("events").doc();
        tx.set(eventRef2, createWithdrawEvent(
          "WITHDRAWN",
          actor.uid,
          actor.role,
          actor.nome,
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
