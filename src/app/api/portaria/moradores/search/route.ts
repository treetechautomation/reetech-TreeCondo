import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

const PORTARIA_ROLES = new Set(["PORTEIRO", "SUPER_ADMIN", "ADMIN", "ADMIN_CONDOMINIO", "SINDICO", "ZELADOR"]);

export async function GET(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente.", 401);

    const decoded = await aauth.verifyIdToken(token);
    const uid = decoded.uid;

    const isSuper = decoded.super_admin === true || (decoded as any).superAdmin === true ||
      String((decoded as any).role || "").toUpperCase() === "SUPER_ADMIN";

    const { searchParams } = new URL(req.url);
    const condominioId = searchParams.get("condominioId") || "";
    const q = (searchParams.get("q") || "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);
    if (!q || q.length < 2) return jsonError("Busca precisa de pelo menos 2 caracteres.", 400);

    let role = "";
    let membroStatus = "";

    if (isSuper) {
      role = "SUPER_ADMIN";
      membroStatus = "ATIVO";
    } else {
      const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
      const membroSnap = await membroRef.get();
      if (membroSnap.exists) {
        const membroData = membroSnap.data() || {};
        role = String(membroData.role || "").toUpperCase();
        membroStatus = String(membroData.status || "");
      }

      if (!role) {
        const vinculoRef = db.collection("userCondominios").doc(uid).collection("vinculos").doc(condominioId);
        const vinculoSnap = await vinculoRef.get();
        if (vinculoSnap.exists) {
          const vdata = vinculoSnap.data() || {};
          role = String(vdata.role || "").toUpperCase();
          membroStatus = String(vdata.status || "");
        }
      }
    }

    if (!role) return jsonError("Usuário não pertence a este condomínio.", 403);

    if (!PORTARIA_ROLES.has(role)) return jsonError("Acesso restrito.", 403);

    if (membroStatus !== "ATIVO") return jsonError("Usuário inativo.", 403);

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
    console.error("[portaria/moradores/search] erro:", e?.message || String(e));
    return jsonError("Erro ao buscar moradores.", 500);
  }
}
