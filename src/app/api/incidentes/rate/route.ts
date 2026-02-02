
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

async function checkPermissions(
  db: FirebaseFirestore.Firestore,
  condominioId: string,
  incidenteId: string,
  uid: string
) {
  const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
  const membroSnap = await membroRef.get();
  if (!membroSnap.exists) {
    throw new Error("Usuário não é membro deste condomínio.");
  }
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

  if (isOperator) {
    throw new Error("Operadores não podem avaliar chamados.");
  }

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
  if (incidenteData?.criadoPorUid !== uid) {
    throw new Error("Você não pode avaliar um incidente que não abriu.");
  }
  
  if (incidenteData?.status !== 'FINALIZADO') {
    throw new Error("Você só pode avaliar incidentes finalizados.");
  }
  
  if (incidenteData?.avaliacao) {
    throw new Error("Este chamado já foi avaliado.");
  }


  return { incidenteRef };
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
    const { condominioId, incidenteId, avaliacao } = body;

    if (!condominioId || !incidenteId || !avaliacao || typeof avaliacao !== 'number' || avaliacao < 1 || avaliacao > 5) {
      return NextResponse.json({ ok: false, error: "Dados incompletos ou avaliação inválida (deve ser de 1 a 5)." }, { status: 400 });
    }

    const db = adminDb();
    const { incidenteRef } = await checkPermissions(db, condominioId, incidenteId, uid);
    
    const historicoRef = incidenteRef.collection("historico").doc();
    const batch = db.batch();

    batch.update(incidenteRef, {
      avaliacao,
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.set(historicoRef, {
      tipo: "SISTEMA",
      mensagem: `Morador avaliou com ${avaliacao} estrela(s).`,
      autorUid: uid,
      autorNome: "Sistema",
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Erro ao avaliar incidente:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
