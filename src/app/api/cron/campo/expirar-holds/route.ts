/**
 * FASE 16.10 / R2 — POST /api/cron/campo/expirar-holds
 *
 * Reconciliation-only: expires HOLDs that are past their expiresAt.
 * Runtime enforcement is done in transactions — this cron only cleans up.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const cronSecret = process.env.CRON_RESERVAS_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ success: false, error: "Serviço não configurado." }, { status: 503 });
    }

    const headerSecret = req.headers.get("x-cron-secret") || "";
    if (headerSecret !== cronSecret) {
      return jsonError("Não autorizado.", 401);
    }

    const db = adminDb();
    const now = new Date();
    const nowTs = FieldValue.serverTimestamp();

    const condSnap = await db.collection("condominiosPublicos").orderBy("nome").get();
    let expirados = 0;
    const falhas: string[] = [];

    for (const cond of condSnap.docs) {
      try {
        const agendaSnap = await db
          .collection("condominios")
          .doc(cond.id)
          .collection("campoAgenda")
          .where("exclusividade.status", "==", "HOLD")
          .where("exclusividade.expiresAt", "<=", now)
          .get();

        for (const doc of agendaSnap.docs) {
          await doc.ref.update({
            "exclusividade.status": "EXPIRADA",
            version: FieldValue.increment(1),
            updatedAt: nowTs,
          });
          expirados++;
        }
      } catch (e: any) {
        falhas.push(`${cond.id}: ${e?.message || "erro"}`);
      }
    }

    return NextResponse.json({
      success: true,
      expirados,
      falhas: falhas.length > 0 ? falhas.slice(0, 10) : undefined,
      executadoEm: now.toISOString(),
    });
  } catch (err: any) {
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}

export async function GET() {
  return NextResponse.json({ success: false, error: "Use POST." }, { status: 405 });
}
