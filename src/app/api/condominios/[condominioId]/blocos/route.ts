import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ condominioId: string }> }
) {
  try {
    const { condominioId } = await ctx.params;
    if (!condominioId) {
      return NextResponse.json({ ok: false, error: "condominioId ausente" }, { status: 400 });
    }

    const db = adminDb();
    const snap = await db
      .collection("condominios")
      .doc(condominioId)
      .collection("blocos")
      .orderBy("nome")
      .get();

    const blocos = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    return NextResponse.json({ ok: true, blocos });
  } catch (e: any) {
    console.error("[GET blocos] erro:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro" }, { status: 500 });
  }
}
