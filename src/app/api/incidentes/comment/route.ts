
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

async function checkPermissions(
  db: FirebaseFirestore.Firestore,
  condominioId: string,
  incidenteId: string,
  uid: string
) {
  const incidenteRef = db
    .collection("condominios")
    .doc(condominioId)
    .collection("incidentes")
    .doc(incidenteId);
  const incidenteSnap = await incidenteRef.get();

  if (!incidenteSnap.exists) {
    throw new Error("Incidente não encontrado.");
  }

  const incidenteData = incidenteSnap.data();
  const isOwner = incidenteData?.criadoPorUid === uid;

  const membroRef = db
    .collection("condominios")
    .doc(condominioId)
    .collection("membros")
    .doc(uid);
  const membroSnap = await membroRef.get();
  const membroData = membroSnap.data();
  const role = membroData?.role;

  const isOperator = [
    "SUPER_ADMIN",
    "ADMIN_CONDOMINIO",
    "ADMIN",
    "SINDICO",
    "PORTEIRO",
    "ZELADOR",
  ].includes(role);

  if (!isOwner && !isOperator) {
    throw new Error("Sem permissão para comentar neste incidente.");
  }
  return { membroData };
}

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
    const { condominioId, incidenteId, texto } = body;

    if (!condominioId || !incidenteId || !texto) {
      return NextResponse.json({ ok: false, error: "Dados incompletos" }, { status: 400 });
    }

    const db = adminDb();
    const { membroData } = await checkPermissions(db, condominioId, incidenteId, uid);

    const historicoRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("incidentes")
      .doc(incidenteId)
      .collection("historico")
      .doc();
    
    const incidenteRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("incidentes")
      .doc(incidenteId);

    const batch = db.batch();

    batch.set(historicoRef, {
      tipo: "COMENTARIO",
      mensagem: texto,
      autorUid: uid,
      autorNome: membroData?.nome || decodedToken.name || decodedToken.email,
      createdAt: FieldValue.serverTimestamp(),
    });

    batch.update(incidenteRef, {
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({ ok: true, historicoId: historicoRef.id });
  } catch (error: any) {
    console.error("Erro ao adicionar comentário:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
