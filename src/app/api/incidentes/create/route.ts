import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { triarIncidente } from "@/ai/triagemIncidente";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { condominioId, titulo, descricao, tipo, fotos = [] } = body;

    if (!condominioId || !titulo || !descricao || !tipo) {
      return jsonError("Dados incompletos", 400);
    }

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO", "PORTEIRO", "ZELADOR", "MORADOR"],
    });

    const db = adminDb();
    const membroData = ctx.membroData || {};

    // UN.6D.1: Resolve canonical unit from VinculoUnidade
    const pessoaId = String(membroData.pessoaId || "");
    let criadoPorUnitDocId: string | null = null;
    let criadoPorUnidadeSnapshot: any = null;

    if (pessoaId) {
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
          const cBlocoId = String(vinc.blocoId || "");
          const cUnitDocId = String(vinc.unitDocId || "");

          if (cBlocoId && cUnitDocId) {
            criadoPorUnitDocId = cUnitDocId;
            let blocoNome = cBlocoId;
            let unidadeNumero = "";
            try {
              const blocoSnap = await db.collection("condominios").doc(condominioId)
                .collection("blocos").doc(cBlocoId).get();
              if (blocoSnap.exists) blocoNome = String((blocoSnap.data() || {}).nome || cBlocoId);
              const unidadeSnap = await db.collection("condominios").doc(condominioId)
                .collection("blocos").doc(cBlocoId).collection("unidades").doc(cUnitDocId).get();
              if (unidadeSnap.exists) unidadeNumero = String((unidadeSnap.data() || {}).numero || "");
            } catch { /* ignore */ }
            criadoPorUnidadeSnapshot = { unitDocId: cUnitDocId, blocoId: cBlocoId, blocoNome, unidadeNumero };
          }
        }
      } catch { /* ignore */ }
    }

    // UN.6D.1: Local do incidente from request body
    const localUnitDocId = body.localUnitDocId ? String(body.localUnitDocId).trim() : null;
    const localTipo = body.localTipo === "AREA_COMUM" ? "AREA_COMUM" : (localUnitDocId ? "UNIDADE" : null);
    let localUnidadeSnapshot: any = null;

    if (localUnitDocId) {
      try {
        const blocosSnap = await db.collection("condominios").doc(condominioId)
          .collection("blocos").where("ativo", "==", true).get();
        for (const bDoc of blocosSnap.docs) {
          const unidadeSnap = await db.collection("condominios").doc(condominioId)
            .collection("blocos").doc(bDoc.id).collection("unidades").doc(localUnitDocId).get();
          if (unidadeSnap.exists) {
            const ud = unidadeSnap.data() || {};
            const bd = bDoc.data() || {};
            localUnidadeSnapshot = {
              unitDocId: localUnitDocId,
              blocoId: bDoc.id,
              blocoNome: String(bd.nome || bDoc.id),
              unidadeNumero: String(ud.numero || ""),
            };
            break;
          }
        }
      } catch { /* ignore */ }
    }

    // Triagem por IA (não bloqueia em caso de falha)
    const triagem = await triarIncidente({ titulo, descricao });

    const incidentesRef = db.collection("condominios").doc(condominioId).collection("incidentes");
    const novoIncidenteRef = incidentesRef.doc();
    const historicoRef = novoIncidenteRef.collection("historico").doc();

    const batch = db.batch();

    const now = FieldValue.serverTimestamp();

    batch.set(novoIncidenteRef, {
      titulo,
      descricao,
      tipo,
      status: "ABERTO",
      criadoPorUid: ctx.uid,
      criadoPorNome: membroData?.nome || ctx.decodedToken?.name || ctx.email,
      criadoPorEmail: ctx.email,
      criadoPorPessoaId: pessoaId || null,
      criadoPorUnitDocId: criadoPorUnitDocId || null,
      criadoPorUnidadeSnapshot: criadoPorUnidadeSnapshot || null,
      localUnitDocId: localUnitDocId || null,
      localTipo: localTipo || null,
      localUnidadeSnapshot: localUnidadeSnapshot || null,
      criadoPorUnidadeId: criadoPorUnidadeSnapshot?.unidadeNumero || membroData?.unidadeId || null,
      criadoPorBlocoId: criadoPorUnidadeSnapshot?.blocoId || membroData?.blocoId || null,
      createdAt: now,
      updatedAt: now,
      avaliacao: null,
      fotos: Array.isArray(fotos) ? fotos : [],
      ia_categoria: triagem?.categoria || null,
      ia_urgencia: triagem?.urgencia || null,
      ia_encaminhamento: triagem?.encaminhamento || null,
      ia_resumo: triagem?.resumo || null,
      ia_tags: triagem?.tags || [],
    });

    batch.set(historicoRef, {
      tipo: "SISTEMA",
      mensagem: "Chamado aberto.",
      autorUid: ctx.uid,
      autorNome: "Sistema",
      createdAt: now,
    });

    await batch.commit();

    // ===== ALERTA_SINDICO_INCIDENTE =====
    try {
      const membrosRef = db.collection("condominios").doc(condominioId).collection("membros");
      const snap = await membrosRef.where("status", "in", ["ATIVO", "PENDENTE"]).get();

      const operadores = snap.docs
        .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
        .filter((m: any) => {
          const role = String(m.role || "").toUpperCase().trim();
          return ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(role);
        });

      if (operadores.length) {
        const notifBatch = db.batch();
        const uids = [];

        for (const op of operadores) {
          const uidOp = op.id;
          uids.push(uidOp);

          const ref = db
            .collection("condominios")
            .doc(condominioId)
            .collection("notificacoes")
            .doc();

          notifBatch.set(ref, {
            tipo: "INCIDENTE_NOVO",
            title: "Novo incidente aberto",
            message: titulo,
            titulo: "Novo incidente aberto",
            mensagem: titulo,
            targetUid: uidOp,
            condominioId,
            incidenteId: novoIncidenteRef.id,
            lida: false,
            arquivada: false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        await notifBatch.commit();

        // PUSH
        try {
          const { sendPushToUids } = require("@/lib/serverPush");

          await sendPushToUids({
            db,
            uids,
            title: "Novo incidente",
            body: titulo,
            link: "/incidentes",
            data: {
              tipo: "INCIDENTE_NOVO",
              incidenteId: String(novoIncidenteRef.id),
            },
          });
        } catch (e: any) {
          console.warn("Push incidente falhou:", e?.message || String(e));
        }
      }
    } catch (e: any) {
      console.warn("Notificação incidente falhou:", e?.message || String(e));
    }
    // ===== /ALERTA_SINDICO_INCIDENTE =====

    return NextResponse.json({ ok: true, incidenteId: novoIncidenteRef.id });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error("Erro ao criar incidente:", error);
    return jsonError(error.message, 500);
  }
}
