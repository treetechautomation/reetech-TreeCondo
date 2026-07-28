/**
 * FASE D.10 — API ADMIN: RASCUNHO DE REGULAMENTO.
 *
 * GET  → ler rascunho
 * POST → criar rascunho
 * PUT  → editar rascunho
 * DELETE → descartar rascunho
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { createFirestoreRegulamentoRepository } from "@/lib/reservas/policy-engine/regulamento-firestore";
import { createRegulamentoAdminService } from "@/lib/reservas/policy-engine/regulamento-admin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function verifyAdmin(req: Request): Promise<{ uid: string; isSuper: boolean; error: string | null; status?: number }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { uid: "", isSuper: false, error: "Token ausente.", status: 401 };
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const isSuper = (decoded as any)?.super_admin === true || (decoded as any)?.superAdmin === true;
    return { uid: String(decoded.uid), isSuper, error: null };
  } catch {
    return { uid: "", isSuper: false, error: "Token inválido.", status: 401 };
  }
}

async function verifyCondominioAccess(uid: string, condominioId: string, isSuper: boolean): Promise<{ allowed: boolean; error: string }> {
  if (isSuper) return { allowed: true, error: "" };
  const db = adminDb();
  const vincSnap = await db.collection("userCondominios").doc(uid).collection("vinculos").doc(condominioId).get();
  if (!vincSnap.exists) return { allowed: false, error: "Sem vínculo com o condomínio." };
  const role = String(vincSnap.data()?.role || "").toUpperCase();
  const isAdmin = ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(role);
  return { allowed: isAdmin, error: isAdmin ? "" : "Permissão insuficiente (requer ADMIN_CONDOMINIO)." };
}

export async function GET(req: Request) {
  const { uid, isSuper, error } = await verifyAdmin(req);
  if (error) return jsonError(error, 401);

  const url = new URL(req.url);
  const condominioId = url.searchParams.get("condominioId") || "";
  if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

  const access = await verifyCondominioAccess(uid, condominioId, isSuper);
  if (!access.allowed) return jsonError(access.error, 403);

  const db = adminDb();
  const repo = createFirestoreRegulamentoRepository(db);
  const svc = createRegulamentoAdminService(repo);
  const draft = await svc.getDraft(condominioId);
  if (!draft) return jsonError("Nenhum rascunho encontrado.", 404);

  return NextResponse.json({ ok: true, draft });
}

export async function POST(req: Request) {
  const { uid, isSuper, error } = await verifyAdmin(req);
  if (error) return jsonError(error, 401);

  const body = await req.json().catch(() => ({}));
  const condominioId = String(body?.condominioId || "").trim();
  if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

  const access = await verifyCondominioAccess(uid, condominioId, isSuper);
  if (!access.allowed) return jsonError(access.error, 403);

  const db = adminDb();
  const repo = createFirestoreRegulamentoRepository(db);
  const svc = createRegulamentoAdminService(repo);
  const resultado = await svc.createDraft(condominioId, body);
  return NextResponse.json({ ok: resultado.success, ...resultado });
}

export async function PUT(req: Request) {
  const { uid, isSuper, error } = await verifyAdmin(req);
  if (error) return jsonError(error, 401);

  const body = await req.json().catch(() => ({}));
  const condominioId = String(body?.condominioId || "").trim();
  if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

  const access = await verifyCondominioAccess(uid, condominioId, isSuper);
  if (!access.allowed) return jsonError(access.error, 403);

  const db = adminDb();
  const repo = createFirestoreRegulamentoRepository(db);
  const svc = createRegulamentoAdminService(repo);
  const resultado = await svc.updateDraft(condominioId, body);
  return NextResponse.json({ ok: resultado.success, ...resultado });
}

export async function DELETE(req: Request) {
  const { uid, isSuper, error } = await verifyAdmin(req);
  if (error) return jsonError(error, 401);

  const url = new URL(req.url);
  const condominioId = url.searchParams.get("condominioId") || "";
  if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

  const access = await verifyCondominioAccess(uid, condominioId, isSuper);
  if (!access.allowed) return jsonError(access.error, 403);

  const db = adminDb();
  const repo = createFirestoreRegulamentoRepository(db);
  const svc = createRegulamentoAdminService(repo);
  const resultado = await svc.discardDraft(condominioId);
  return NextResponse.json({ ok: resultado.success, ...resultado });
}
