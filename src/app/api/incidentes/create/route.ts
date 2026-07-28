
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rateLimiter";
import { triarIncidente } from "@/ai/triagemIncidente";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Token ausente" }, { status: 401 });
    }

    const decodedToken = await adminAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Rate limiting: máx 10 incidentes por minuto por usuário
    const rl = checkRateLimit({
      key: rateLimitKey(uid, null, "incidentes:create"),
      limit: 10,
      windowSec: 60,
    });
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json();
    const { condominioId, titulo, descricao, tipo, fotos = [] } = body;

    if (!condominioId || !titulo || !descricao || !tipo) {
      return NextResponse.json({ ok: false, error: "Dados incompletos" }, { status: 400 });
    }

    const db = adminDb();

    // Buscar dados do morador para enriquecer o incidente
    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
    const membroSnap = await membroRef.get();
    if (!membroSnap.exists) {
      return NextResponse.json({ ok: false, error: "Usuário não é membro deste condomínio." }, { status: 403 });
    }
    const membroData = membroSnap.data();

    const incidentesRef = db.collection("condominios").doc(condominioId).collection("incidentes");
    const novoIncidenteRef = incidentesRef.doc();
    const historicoRef = novoIncidenteRef.collection("historico").doc();

    const batch = db.batch();

    const now = FieldValue.serverTimestamp();

    // UN.6D.1: Resolve canonical unit from VinculoUnidade
    const pessoaId = String(membroData?.pessoaId || "");
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
            // Build snapshot from catalog
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
        // Find the bloco that contains this unit
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

    batch.set(novoIncidenteRef, {
      titulo,
      descricao,
      tipo,
      status: "ABERTO",
      criadoPorUid: uid,
      criadoPorNome: membroData?.nome || decodedToken.name || decodedToken.email,
      criadoPorEmail: decodedToken.email,
      // UN.6D.1: Canonical fields
      criadoPorPessoaId: pessoaId || null,
      criadoPorUnitDocId: criadoPorUnitDocId || null,
      criadoPorUnidadeSnapshot: criadoPorUnidadeSnapshot || null,
      localUnitDocId: localUnitDocId || null,
      localTipo: localTipo || null,
      localUnidadeSnapshot: localUnidadeSnapshot || null,
      // Legacy fields (derived from canonical or membro fallback)
      criadoPorUnidadeId: criadoPorUnidadeSnapshot?.unidadeNumero || membroData?.unidadeId || null,
      criadoPorBlocoId: criadoPorUnidadeSnapshot?.blocoId || membroData?.blocoId || null,
      createdAt: now,
      updatedAt: now,
      avaliacao: null,
      fotos: Array.isArray(fotos) ? fotos : [],
      // IA Triagem
      ia_categoria: triagem?.categoria || null,
      ia_urgencia: triagem?.urgencia || null,
      ia_encaminhamento: triagem?.encaminhamento || null,
      ia_resumo: triagem?.resumo || null,
      ia_tags: triagem?.tags || [],
    });

    batch.set(historicoRef, {
      tipo: "SISTEMA",
      mensagem: "Chamado aberto.",
      autorUid: uid,
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
    console.error("Erro ao criar incidente:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
