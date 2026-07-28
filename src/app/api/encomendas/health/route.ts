/**
 * FASE E.3.3 — HEALTH CHECK DO MÓDULO DE ENCOMENDAS.
 *
 * GET /api/encomendas/health
 * Valida: Firestore acessível, auth config carregada.
 * Não expõe dados sensíveis.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

export async function GET() {
  const checks: Record<string, { ok: boolean; error?: string }> = {};

  try {
    const db = adminDb();
    await db.collection("_health_").doc("_ping_").get();
    checks.firestore = { ok: true };
  } catch (e: any) {
    checks.firestore = { ok: false, error: e?.message || "Firestore unreachable" };
  }

  try {
    const auth = adminAuth();
    checks.auth = { ok: !!auth };
  } catch (e: any) {
    checks.auth = { ok: false, error: e?.message };
  }

  const allOk = Object.values(checks).every(c => c.ok);
  return NextResponse.json({
    module: "encomendas",
    status: allOk ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  }, { status: allOk ? 200 : 503 });
}
