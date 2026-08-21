import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function GET(
  req: Request,
  ctx: { params: { condominioId: string } }
) {
  try {
    const { condominioId } = ctx.params;
    if (!condominioId) {
      return jsonError("condominioId ausente", 400);
    }

    // SECURITY.P0.11: canonical had zero auth on this route (confirmed
    // read-only in P0.10) — porting apiGuard here is a genuine fix.
    await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"],
    });

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
    if (e instanceof Response) return e;
    console.error("[GET blocos] erro:", e);
    return jsonError(e?.message || "Erro", 500);
  }
}
