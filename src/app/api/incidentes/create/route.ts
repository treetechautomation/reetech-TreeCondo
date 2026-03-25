
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Token ausente" }, { status: 401 });
    }

    const decodedToken = await adminAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

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

    batch.set(novoIncidenteRef, {
      titulo,
      descricao,
      tipo,
      status: "ABERTO",
      criadoPorUid: uid,
      criadoPorNome: membroData?.nome || decodedToken.name || decodedToken.email,
      criadoPorEmail: decodedToken.email,
      criadoPorUnidadeId: membroData?.unidadeId || null,
      criadoPorBlocoId: membroData?.blocoId || null,
      createdAt: now,
      updatedAt: now,
      avaliacao: null,
        fotos: Array.isArray(fotos) ? fotos : [],
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
