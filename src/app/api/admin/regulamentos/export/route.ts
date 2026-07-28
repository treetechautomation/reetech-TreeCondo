/**
 * FASE D.10 — API ADMIN: EXPORTAR REGULAMENTO.
 *
 * GET → JSON portável com hash de integridade.
 * Autenticação via Bearer token (admin do condomínio).
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { createFirestoreRegulamentoRepository } from "@/lib/reservas/policy-engine/regulamento-firestore";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return jsonError("Token ausente.", 401);

  try {
    await adminAuth().verifyIdToken(token);
  } catch {
    return jsonError("Token inválido.", 401);
  }

  const url = new URL(req.url);
  const condominioId = url.searchParams.get("condominioId") || "";
  if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

  const db = adminDb();
  const repo = createFirestoreRegulamentoRepository(db);
  const data = await repo.buildExport(condominioId);
  if (!data) return jsonError("Nenhum regulamento publicado para exportar.", 404);

  return NextResponse.json({ ok: true, export: data });
}
