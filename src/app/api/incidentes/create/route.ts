
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
    const { condominioId, titulo, descricao, tipo } = body;

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
    });

    batch.set(historicoRef, {
      tipo: "SISTEMA",
      mensagem: "Chamado aberto.",
      autorUid: uid,
      autorNome: "Sistema",
      createdAt: now,
    });

    await batch.commit();

    return NextResponse.json({ ok: true, incidenteId: novoIncidenteRef.id });
  } catch (error: any) {
    console.error("Erro ao criar incidente:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
