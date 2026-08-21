import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { condominioId, incidenteId, texto } = body;

    if (!condominioId || !incidenteId || !texto) {
      return jsonError("Dados incompletos", 400);
    }

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO", "PORTEIRO", "ZELADOR", "MORADOR"],
    });

    const db = adminDb();

    const incidenteRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("incidentes")
      .doc(incidenteId);
    const incidenteSnap = await incidenteRef.get();

    if (!incidenteSnap.exists) {
      return jsonError("Incidente não encontrado.", 404);
    }

    const incidenteData = incidenteSnap.data() || {};
    const isOwner = incidenteData.criadoPorUid === ctx.uid;

    const OPERATORS = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO", "PORTEIRO", "ZELADOR"];
    const isOperator = ctx.isSuperAdmin || (ctx.role && OPERATORS.includes(ctx.role));

    if (!isOwner && !isOperator) {
      return jsonError("Sem permissão para comentar neste incidente.", 403);
    }

    const membroData = ctx.membroData || {};

    const historicoRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("incidentes")
      .doc(incidenteId)
      .collection("historico")
      .doc();

    const batch = db.batch();

    batch.set(historicoRef, {
      tipo: "COMENTARIO",
      mensagem: texto,
      autorUid: ctx.uid,
      autorNome: membroData?.nome || ctx.decodedToken?.name || ctx.email,
      createdAt: FieldValue.serverTimestamp(),
    });

    batch.update(incidenteRef, {
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({ ok: true, historicoId: historicoRef.id });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error("Erro ao adicionar comentário:", error);
    return jsonError(error.message, 500);
  }
}
