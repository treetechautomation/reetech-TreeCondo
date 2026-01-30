
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

async function checkPermissions(
  db: FirebaseFirestore.Firestore,
  condominioId: string,
  uid: string
) {
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
    "SINDICO",
    "PORTEIRO",
    "ZELADOR",
  ].includes(role);

  if (!isOperator) {
    throw new Error("Sem permissão para alterar o status do incidente.");
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
    const { condominioId, incidenteId, status } = body;

    const validStatus = ["ABERTO", "EM_ANDAMENTO", "RESOLVIDO", "FINALIZADO"];
    if (!condominioId || !incidenteId || !status || !validStatus.includes(status)) {
      return NextResponse.json({ ok: false, error: "Dados incompletos ou status inválido." }, { status: 400 });
    }

    const db = adminDb();
    const { membroData } = await checkPermissions(db, condominioId, uid);

    const incidenteRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("incidentes")
      .doc(incidenteId);

    const historicoRef = incidenteRef.collection("historico").doc();
    const batch = db.batch();

    batch.update(incidenteRef, {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.set(historicoRef, {
      tipo: "SISTEMA",
      mensagem: `Status alterado para ${status}.`,
      autorUid: uid,
      autorNome: membroData?.nome || "Sistema",
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Erro ao alterar status do incidente:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
