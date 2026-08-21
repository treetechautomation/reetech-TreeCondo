import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { condominioId, incidenteId, status } = body;

    const validStatus = ["ABERTO", "EM_ANDAMENTO", "RESOLVIDO", "FINALIZADO"];
    if (!condominioId || !incidenteId || !status || !validStatus.includes(status)) {
      return jsonError("Dados incompletos ou status inválido.", 400);
    }

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO", "PORTEIRO", "ZELADOR"],
    });

    const db = adminDb();
    const membroData = ctx.membroData || {};

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
      autorUid: ctx.uid,
      autorNome: membroData?.nome || "Sistema",
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error("Erro ao alterar status do incidente:", error);
    return jsonError(error.message, 500);
  }
}
