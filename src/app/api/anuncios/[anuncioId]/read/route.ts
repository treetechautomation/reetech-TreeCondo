/**
 * AN.4 — API DE LEITURA DE ANÚNCIO
 *
 * POST /api/anuncios/[anuncioId]/read
 * Registra leitura do anúncio pelo usuário autenticado.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function POST(
  req: Request,
  ctx: { params: { anuncioId: string } }
) {
  try {
    const { anuncioId } = ctx.params;
    const body = await req.json().catch(() => ({})) as any;
    const condominioId = String(body.condominioId || "").trim();
    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    const authCtx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO", "PORTEIRO", "ZELADOR", "MORADOR"],
    });

    const db = adminDb();
    const md = authCtx.membroData || {};

    const anuncioRef = db.collection("condominios").doc(condominioId)
      .collection("anuncios").doc(anuncioId);
    const anuncioSnap = await anuncioRef.get();
    if (!anuncioSnap.exists) return jsonError("Anúncio não encontrado.", 404);

    const anuncio = anuncioSnap.data() || {};
    const status = anuncio.status || "PUBLICADO";

    const MANAGERS = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];
    const isManager = authCtx.isSuperAdmin || MANAGERS.includes(authCtx.role || "");

    if (!isManager && status !== "PUBLICADO") return jsonError("Anúncio não disponível.", 403);

    if (anuncio.expiresAt && !isManager) {
      try {
        const exp = anuncio.expiresAt.toDate ? anuncio.expiresAt.toDate() : new Date(anuncio.expiresAt._seconds * 1000);
        if (exp <= new Date()) return jsonError("Anúncio expirado.", 403);
      } catch { /* ignore */ }
    }

    const scope = String(anuncio.targetScope || "CONDOMINIO").toUpperCase();
    if (scope === "BLOCO" && anuncio.targetBlocoId && !isManager) {
      const pessoaId = String(md.pessoaId || "");
      let allowed = false;

      if (pessoaId) {
        try {
          const vincSnap = await db.collection("condominios").doc(condominioId)
            .collection("vinculosUnidades")
            .where("pessoaId", "==", pessoaId)
            .where("blocoId", "==", anuncio.targetBlocoId)
            .where("status", "==", "ATIVO")
            .where("resideNaUnidade", "==", true)
            .limit(1).get();
          if (!vincSnap.empty) allowed = true;
        } catch { /* ignore */ }
      }

      if (!allowed && String(md.blocoId || "") === anuncio.targetBlocoId) allowed = true;

      if (!allowed) return jsonError("Anúncio não disponível para o seu bloco.", 403);
    }

    const leituraRef = db.collection("condominios").doc(condominioId)
      .collection("anuncios").doc(anuncioId)
      .collection("leituras").doc(authCtx.uid);

    await leituraRef.set({
      uid: authCtx.uid,
      pessoaId: md.pessoaId || null,
      readAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true, anuncioId, read: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
