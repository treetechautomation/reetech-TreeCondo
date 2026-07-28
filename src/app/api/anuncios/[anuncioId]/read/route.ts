/**
 * AN.4 — API DE LEITURA DE ANÚNCIO
 *
 * POST /api/anuncios/[anuncioId]/read
 * Registra leitura do anúncio pelo usuário autenticado.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(
  req: Request,
  ctx: { params: { anuncioId: string } }
) {
  try {
    const { anuncioId } = ctx.params;
    const body = await req.json().catch(() => ({})) as any;
    const condominioId = String(body.condominioId || "").trim();
    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    // Auth
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente.", 401);
    let decoded: any;
    try { decoded = await adminAuth().verifyIdToken(token); }
    catch { return jsonError("Token inválido.", 401); }
    const uid = decoded.uid;

    const db = adminDb();

    // Check Membership
    const membroSnap = await db.collection("condominios").doc(condominioId)
      .collection("membros").doc(uid).get();
    if (!membroSnap.exists) return jsonError("Não é membro.", 403);
    const md = membroSnap.data() || {};
    if (String(md.status || "").toUpperCase() !== "ATIVO") return jsonError("Membership inativo.", 403);

    // Get anuncio
    const anuncioRef = db.collection("condominios").doc(condominioId)
      .collection("anuncios").doc(anuncioId);
    const anuncioSnap = await anuncioRef.get();
    if (!anuncioSnap.exists) return jsonError("Anúncio não encontrado.", 404);

    const anuncio = anuncioSnap.data() || {};
    const status = anuncio.status || "PUBLICADO";

    // Only PUBLICADO announcements can be read by non-managers
    const role = String(md.role || "").toUpperCase();
    const isManager = (decoded as any)?.super_admin || ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(role);

    if (!isManager && status !== "PUBLICADO") return jsonError("Anúncio não disponível.", 403);

    // Check expiration
    if (anuncio.expiresAt && !isManager) {
      try {
        const exp = anuncio.expiresAt.toDate ? anuncio.expiresAt.toDate() : new Date(anuncio.expiresAt._seconds * 1000);
        if (exp <= new Date()) return jsonError("Anúncio expirado.", 403);
      } catch { /* ignore */ }
    }

    // Check segmentation (BLOCO scope)
    const scope = String(anuncio.targetScope || "CONDOMINIO").toUpperCase();
    if (scope === "BLOCO" && anuncio.targetBlocoId && !isManager) {
      const pessoaId = String(md.pessoaId || "");
      let allowed = false;

      // Try VinculoUnidade
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

      // Legacy fallback
      if (!allowed && String(md.blocoId || "") === anuncio.targetBlocoId) allowed = true;

      if (!allowed) return jsonError("Anúncio não disponível para o seu bloco.", 403);
    }

    // Register read (idempotent: docId = uid)
    const leituraRef = db.collection("condominios").doc(condominioId)
      .collection("anuncios").doc(anuncioId)
      .collection("leituras").doc(uid);

    await leituraRef.set({
      uid,
      pessoaId: md.pessoaId || null,
      readAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true, anuncioId, read: true });
  } catch (e: any) {
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
