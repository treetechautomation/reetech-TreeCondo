/** FASE 16.18.2 / R6 — GET /api/portaria/unificada */
import { NextResponse } from "next/server"; export const runtime = "nodejs";
import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const condominioId = url.searchParams.get("condominioId") ?? "";
  const dateStr = url.searchParams.get("dateStr") ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (!condominioId) return jsonError("condominioId required", 400);

  const db = adminDb();

  try {
    await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["SUPER_ADMIN", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "PORTEIRO", "SEGURANCA"],
    });

    // Buscar usosCampo ATIVOS do dia
    const usosSnap = await db.collection("condominios").doc(condominioId)
      .collection("usoCampo").where("dateStr", "==", dateStr).where("status", "==", "ATIVO").get();

    const convidadosPendentes: any[] = [];
    for (const uDoc of usosSnap.docs) {
      const uso = uDoc.data();
      const convSnap = await uDoc.ref.collection("convidados").where("status", "==", "RESERVADO").get();
      for (const cDoc of convSnap.docs) {
        const c = cDoc.data();
        convidadosPendentes.push({
          origemTipo: "USO_CAMPO", origemId: uDoc.id, convidadoId: cDoc.id,
          area: "Campo / Quadra", dateStr: uso.dateStr, horaInicio: uso.horaInicio, horaFim: uso.horaFim,
          bloco: uso.blocoNome ?? uso.blocoIdNorm ?? "", unidade: uso.unidadeNumero ?? uso.unidadeIdNorm ?? "",
          nome: c.nome, status: "RESERVADO",
        });
      }
    }

    return NextResponse.json({ ok: true, convidadosUsoComum: convidadosPendentes });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError("Erro na consulta unificada.", 500);
  }
}
