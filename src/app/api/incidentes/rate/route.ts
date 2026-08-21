import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { condominioId, incidenteId, avaliacao } = body;

    if (!condominioId || !incidenteId || !avaliacao || typeof avaliacao !== 'number' || avaliacao < 1 || avaliacao > 5) {
      return jsonError("Dados incompletos ou avaliação inválida (deve ser de 1 a 5).", 400);
    }

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["MORADOR"],
    });

    // Operadores (inclusive SUPER_ADMIN) não podem avaliar
    const OPERATORS = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO", "PORTEIRO", "ZELADOR"];
    if (ctx.isSuperAdmin || (ctx.role && OPERATORS.includes(ctx.role))) {
      return jsonError("Operadores não podem avaliar chamados.", 403);
    }

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
    if (incidenteData.criadoPorUid !== ctx.uid) {
      return jsonError("Você não pode avaliar um incidente que não abriu.", 403);
    }

    if (incidenteData.status !== 'FINALIZADO') {
      return jsonError("Você só pode avaliar incidentes finalizados.", 403);
    }

    if (incidenteData.avaliacao) {
      return jsonError("Este chamado já foi avaliado.", 403);
    }

    const historicoRef = incidenteRef.collection("historico").doc();
    const batch = db.batch();

    batch.update(incidenteRef, {
      avaliacao,
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.set(historicoRef, {
      tipo: "SISTEMA",
      mensagem: `Morador avaliou com ${avaliacao} estrela(s).`,
      autorUid: ctx.uid,
      autorNome: "Sistema",
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error("Erro ao avaliar incidente:", error);
    return jsonError(error.message, 500);
  }
}
