import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = adminDb();
    const snap = await db.collection("condominiosPublicos").orderBy("nome").get();

    const data = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    // Garante formato mínimo
    const normalized = data.map((x) => ({ id: x.id, nome: x.nome ?? x.name ?? "Condomínio" }));

    return NextResponse.json({ ok: true, data: normalized });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
