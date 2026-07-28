/**
 * AN.2 — API DE ANÚNCIOS (server-side)
 *
 * GET  /api/anuncios?condominioId=... → listar
 * POST /api/anuncios → criar
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function getAuth(req: Request, condominioId: string) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok: false, error: "Token ausente.", status: 401 };
  let decoded: any;
  try { decoded = await adminAuth().verifyIdToken(token); }
  catch { return { ok: false, error: "Token inválido.", status: 401 }; }
  const uid = decoded.uid;
  const isSuper = decoded.super_admin === true || (decoded as any).superAdmin === true;
  if (isSuper) return { ok: true, uid, isSuper: true, role: "SUPER_ADMIN" as string, pessoaId: null as string | null };

  const db = adminDb();
  const membroSnap = await db.collection("condominios").doc(condominioId).collection("membros").doc(uid).get();
  if (!membroSnap.exists) return { ok: false, error: "Usuário não é membro.", status: 403 };
  const md = membroSnap.data() || {};
  if (String(md.status || "").toUpperCase() !== "ATIVO") return { ok: false, error: "Membership inativo.", status: 403 };
  const role = String(md.role || "").toUpperCase();
  const pessoaId = String(md.pessoaId || "");
  return { ok: true, uid, isSuper: false, role, pessoaId: pessoaId || null };
}

const MANAGERS = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    const auth = await getAuth(req, condominioId);
    if (!auth.ok) return jsonError(auth.error || "Acesso negado", auth.status || 403);

    const db = adminDb();
    const isManager = auth.isSuper || MANAGERS.includes(auth.role || "");

    const snap = await db.collection("condominios").doc(condominioId)
      .collection("anuncios").orderBy("createdAt", "desc").get();

    let anuncios = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));

    // For managers: return all
    if (isManager) {
      return NextResponse.json({ ok: true, anuncios, isManager: true, role: auth.role });
    }

    // For residents: filter by scope and status
    const now = new Date();

    // Resolve resident's blocos via VinculoUnidade
    const residentBlocos = new Set<string>();
    if (auth.pessoaId) {
      try {
        const vincSnap = await db.collection("condominios").doc(condominioId)
          .collection("vinculosUnidades")
          .where("pessoaId", "==", auth.pessoaId)
          .where("status", "==", "ATIVO")
          .where("resideNaUnidade", "==", true)
          .get();
        vincSnap.docs.forEach(d => {
          const v = d.data() || {};
          if (v.blocoId) residentBlocos.add(String(v.blocoId));
        });
      } catch { /* ignore */ }
    }

    // Legacy fallback: if no VinculoUnidade, try membro.blocoId
    if (residentBlocos.size === 0 && !auth.isSuper) {
      try {
        const membroSnap = await db.collection("condominios").doc(condominioId)
          .collection("membros").doc(auth.uid).get();
        if (membroSnap.exists) {
          const md = membroSnap.data() || {};
          if (md.blocoId) residentBlocos.add(String(md.blocoId));
        }
      } catch { /* ignore */ }
    }

    anuncios = anuncios.filter((a: any) => {
      const status = a.status || "PUBLICADO"; // legacy fallback
      if (status !== "PUBLICADO") return false;

      // Expiration check
      if (a.expiresAt) {
        try {
          const exp = a.expiresAt.toDate ? a.expiresAt.toDate() : new Date(a.expiresAt._seconds * 1000);
          if (exp <= now) return false;
        } catch { /* ignore */ }
      }

      // Publish check
      if (a.publishAt) {
        try {
          const pub = a.publishAt.toDate ? a.publishAt.toDate() : new Date(a.publishAt._seconds * 1000);
          if (pub > now) return false;
        } catch { /* ignore */ }
      }

      const scope = String(a.targetScope || "CONDOMINIO").toUpperCase();
      if (scope !== "BLOCO") return true; // CONDOMINIO shows to all

      const blocoId = String(a.targetBlocoId || "");
      return blocoId ? residentBlocos.has(blocoId) : true;
    });

    return NextResponse.json({ ok: true, anuncios, isManager: false, role: auth.role });
  } catch (e: any) {
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as any;
    const condominioId = String(body.condominioId || "").trim();
    const titulo = String(body.titulo || "").trim();
    const mensagem = String(body.mensagem || "").trim();
    const targetScope = String(body.targetScope || "CONDOMINIO").toUpperCase();
    const targetBlocoId = targetScope === "BLOCO" ? String(body.targetBlocoId || "").trim() : null;
    const status = String(body.status || "RASCUNHO").toUpperCase();
    const publishAt = body.publishAt || null;
    const expiresAt = body.expiresAt || null;

    if (!condominioId) return jsonError("condominioId obrigatório", 400);
    if (!titulo) return jsonError("titulo obrigatório", 400);
    if (!mensagem) return jsonError("mensagem obrigatória", 400);
    if (!["CONDOMINIO", "BLOCO"].includes(targetScope)) return jsonError("targetScope inválido", 400);
    if (!["RASCUNHO", "AGENDADO", "PUBLICADO"].includes(status)) return jsonError("status inválido", 400);
    if (targetScope === "BLOCO" && !targetBlocoId) return jsonError("targetBlocoId obrigatório para BLOCO", 400);
    if (expiresAt && publishAt && new Date(expiresAt) <= new Date(publishAt)) return jsonError("expiresAt deve ser posterior a publishAt", 400);
    if (status === "AGENDADO" && !publishAt) return jsonError("publishAt obrigatório para AGENDADO", 400);

    const auth = await getAuth(req, condominioId);
    if (!auth.ok) return jsonError(auth.error || "Acesso negado", auth.status || 403);
    if (!auth.isSuper && !MANAGERS.includes(auth.role || "")) return jsonError("Sem permissão para criar anúncios.", 403);

    const db = adminDb();

    // Validate bloco if BLOCO scope
    let targetBlocoNome: string | null = null;
    if (targetScope === "BLOCO" && targetBlocoId) {
      const blocoSnap = await db.collection("condominios").doc(condominioId)
        .collection("blocos").doc(targetBlocoId).get();
      if (!blocoSnap.exists) return jsonError("Bloco não encontrado.", 404);
      const bd = blocoSnap.data() || {};
      if (bd.ativo === false) return jsonError("Bloco inativo.", 400);
      targetBlocoNome = String(bd.nome || bd.blocoNome || targetBlocoId);
    }

    const publishedAt = status === "PUBLICADO" ? FieldValue.serverTimestamp() : null;

    const ref = db.collection("condominios").doc(condominioId).collection("anuncios").doc();
    const data: Record<string, any> = {
      titulo, mensagem,
      targetScope, targetBlocoId: targetBlocoId || null, targetBlocoNome,
      status, publishAt: publishAt || null, publishedAt,
      expiresAt: expiresAt || null,
      archivedAt: null,
      createdByUid: auth.uid,
      updatedByUid: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await ref.set(data);

    // AN.3: Send notifications if published now
    let notified = 0;
    let audienceCount = 0;
    if (status === "PUBLICADO") {
      try {
        const { sendAnnouncementNotifications, resolveAnnouncementRecipients } = await import("@/lib/notifications/anuncios");
        audienceCount = (await resolveAnnouncementRecipients(condominioId, targetScope, targetBlocoId)).length;
        const result = await sendAnnouncementNotifications(condominioId, ref.id, titulo, targetScope, targetBlocoId);
        notified = result.notified;
        await ref.update({ audienceCount, notificationSentAt: FieldValue.serverTimestamp() });
      } catch (e: any) {
        console.error("[AN.3] Falha ao notificar:", e?.message || e);
      }
    }

    return NextResponse.json({ ok: true, anuncioId: ref.id, status, titulo, notified, audienceCount });
  } catch (e: any) {
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
