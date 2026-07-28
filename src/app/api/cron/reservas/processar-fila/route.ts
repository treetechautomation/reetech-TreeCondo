import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { expirarOfertas } from "@/lib/reservasOfertaExpirada";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const cronSecret = process.env.CRON_RESERVAS_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { success: false, error: "Serviço não configurado." },
        { status: 503 },
      );
    }

    const headerSecret = req.headers.get("x-cron-secret") || "";
    if (headerSecret !== cronSecret) {
      return jsonError("Não autorizado.", 401);
    }

    const db = adminDb();
    const executadoEm = new Date().toISOString();

    const condSnap = await db
      .collection("condominiosPublicos")
      .orderBy("nome")
      .get();

    const condominios = condSnap.docs.map((d) => ({
      id: d.id,
      nome: String((d.data() || {}).nome || d.id),
    }));

    let totalExpiradas = 0;
    const todasPromovidas: string[] = [];
    const falhas: string[] = [];

    for (const cond of condominios) {
      try {
        const resultado = await expirarOfertas(cond.id, new Date());
        totalExpiradas += resultado.expiradas;
        todasPromovidas.push(...resultado.promovidas);
      } catch (e: any) {
        falhas.push(`${cond.id} (${cond.nome}): ${e?.message || "erro"}`);
      }
    }

    console.log(
      `[cron/processar-fila] Processamento automático executado — condominios=${condominios.length} | expiradas=${totalExpiradas} | promovidas=${todasPromovidas.length} | falhas=${falhas.length}`,
      JSON.stringify({ executadoEm, falhas: falhas.slice(0, 10) }),
    );

    return NextResponse.json({
      success: true,
      condominiosProcessados: condominios.length,
      expiradas: totalExpiradas,
      promovidas: todasPromovidas,
      falhas: falhas.length > 0 ? falhas.slice(0, 20) : undefined,
      executadoEm,
    });
  } catch (err: any) {
    console.error("[API cron/processar-fila] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Método não permitido. Use POST." },
    { status: 405 },
  );
}
