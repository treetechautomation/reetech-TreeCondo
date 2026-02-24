import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: { condominioId: string } }
) {
  try {
    const { condominioId } = ctx.params;
    if (!condominioId) {
      return NextResponse.json({ ok: false, error: "condominioId ausente" }, { status: 400 });
    }

    const db = adminDb();
    const snap = await db
        .collection("condominios")
        .doc(condominioId)
        .collection("blocos")
        .get();

    const blocos = snap.docs
        .map((d) => {
          const data = (d.data() || {});
          const nome = (data.nome ?? d.id);
          return {
            id: d.id,
            nome,
            ...data,
          };
        })
        .sort((a, b) =>
          String(a.nome).localeCompare(String(b.nome), "pt", { sensitivity: "base" })
        );

    return NextResponse.json({ ok: true, blocos });
  } catch (e: any) {
    console.error("[GET blocos] erro:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro" }, { status: 500 });
  }
}
