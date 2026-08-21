import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function POST(req: Request) {
  const db = adminDb();

  try {
    const body = (await req.json().catch(() => ({}))) as any;

    const condominioId = String(body?.condominioId || "").trim();
    const codigoInput = String(body?.codigo || "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!codigoInput) return jsonError("Código de retirada é obrigatório", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["PORTEIRO", "ZELADOR", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO"],
    });

    if (codigoInput.startsWith("LOTE-")) {
      const loteRef = db.collection("condominios").doc(condominioId).collection("retiradas_lote").doc(codigoInput);
      const loteSnap = await loteRef.get();

      if (!loteSnap.exists) {
        return jsonError("Código de retirada em lote não encontrado.", 404);
      }

      const loteData = loteSnap.data() as any;

      if (loteData.status === "UTILIZADO") {
        return jsonError("Este QR Code de lote já foi utilizado para retirada.", 400);
      }

      const expiraEm = loteData.expiraEm?.toDate() || new Date(0);
      if (loteData.status === "EXPIRADO" || expiraEm < new Date()) {
        if (loteData.status !== "EXPIRADO") {
          await loteRef.update({ status: "EXPIRADO" });
        }
        return jsonError("Este QR Code de lote expirou.", 400);
      }

      const encomendaIds = loteData.encomendaIds || [];
      if (encomendaIds.length === 0) {
        return jsonError("Nenhuma encomenda vinculada a este lote.", 404);
      }

      const encomendas: any[] = [];
      for (const encId of encomendaIds) {
        const encRef = db.collection("condominios").doc(condominioId).collection("encomendas").doc(encId);
        const encSnap = await encRef.get();
        if (encSnap.exists) {
          const encData = encSnap.data();
          if (encData?.status === "AGUARDANDO") {
            encomendas.push({
              id: encSnap.id,
              transportadora: encData.transportadora || "-",
              nfNumero: encData.nfNumero || "-",
              fotoUrl: encData.fotoUrl || null,
              chegouEm: encData.chegouEm ? encData.chegouEm.toDate().toISOString() : null,
              unidadeId: encData.unidadeId || "",
              blocoId: encData.blocoId || null,
            });
          }
        }
      }

      if (encomendas.length === 0) {
        return jsonError("Todas as encomendas deste lote já foram retiradas.", 400);
      }

      return NextResponse.json({
        ok: true,
        tipo: "LOTE",
        token: codigoInput,
        unidadeId: loteData.unidadeId || "",
        blocoId: loteData.blocoId || null,
        encomendas,
      });

    } else {
      const encomendasRef = db.collection("condominios").doc(condominioId).collection("encomendas");
      const q = encomendasRef.where("codigo", "==", codigoInput);
      const snap = await q.get();

      if (snap.empty) {
        return jsonError("Encomenda não encontrada com este código.", 404);
      }

      const encDoc = snap.docs[0];
      const encData = encDoc.data();

      if (encData.status === "RETIRADA") {
        return jsonError("Esta encomenda já foi retirada.", 400);
      }

      return NextResponse.json({
        ok: true,
        tipo: "INDIVIDUAL",
        token: codigoInput,
        unidadeId: encData.unidadeId || "",
        blocoId: encData.blocoId || null,
        encomendas: [{
          id: encDoc.id,
          transportadora: encData.transportadora || "-",
          nfNumero: encData.nfNumero || "-",
          fotoUrl: encData.fotoUrl || null,
          chegouEm: encData.chegouEm ? encData.chegouEm.toDate().toISOString() : null,
          unidadeId: encData.unidadeId || "",
          blocoId: encData.blocoId || null,
        }],
      });
    }

  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("[API validar-lote] erro:", err);
    return jsonError(err?.message || "Erro inesperado no servidor", 500);
  }
}
