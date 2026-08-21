import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function GET(req: Request) {
  const db = adminDb();

  try {
    const { searchParams } = new URL(req.url);
    const condominioId = searchParams.get("condominioId") || "";
    const q = (searchParams.get("q") || "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);
    if (!q || q.length < 2) return jsonError("Busca precisa de pelo menos 2 caracteres.", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["PORTEIRO", "SUPER_ADMIN", "ADMIN", "ADMIN_CONDOMINIO", "SINDICO", "ZELADOR"],
    });

    const qLower = q.toLowerCase();

    // Collect all matching pessoas from vinculosUnidades
    const vinculosSnap = await db.collection("condominios").doc(condominioId)
      .collection("vinculosUnidades")
      .where("status", "==", "ATIVO")
      .limit(50)
      .get();

    const results: any[] = [];
    const seen = new Set<string>();

    for (const doc of vinculosSnap.docs) {
      const vdata = doc.data();
      const unidadeNumero = String(vdata.unidadeNumero || "").toLowerCase();
      const blocoNome = String(vdata.blocoNome || "").toLowerCase();
      const pessoaId = vdata.pessoaId;

      if (!pessoaId || seen.has(pessoaId)) continue;

      // Fetch pessoa doc
      let pessoaNome = "";
      try {
        const pessoaSnap = await db.collection("condominios").doc(condominioId)
          .collection("pessoas").doc(pessoaId).get();
        if (pessoaSnap.exists) {
          const pdata = pessoaSnap.data() || {};
          pessoaNome = String(pdata.nome || "").toLowerCase();
        }
      } catch (e) { /* skip */ }

      if (!pessoaNome) continue;

      const matchesNome = pessoaNome.includes(qLower);
      const matchesUnidade = unidadeNumero.includes(qLower);
      const matchesBloco = blocoNome.includes(qLower);

      if (matchesNome || matchesUnidade || matchesBloco) {
        seen.add(pessoaId);
        results.push({
          pessoaId,
          nome: vdata.pessoaNome || pessoaNome,
          blocoNome: vdata.blocoNome || "",
          unidadeNumero: vdata.unidadeNumero || "",
          tipoVinculo: vdata.tipoVinculo || "MORADOR",
          reside: vdata.resideNaUnidade ?? true,
        });
      }

      if (results.length >= 10) break;
    }

    return NextResponse.json({ ok: true, results, total: results.length });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("[portaria/moradores/search] erro:", e?.message || String(e));
    return jsonError("Erro ao buscar moradores.", 500);
  }
}
