import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function getActorInfo(db: any, params: { condominioId: string; uid: string; decoded: any }) {
  const { condominioId, uid, decoded } = params;
  const email = String(decoded?.email || "").toLowerCase();
  let nome = String(decoded?.name || decoded?.email || "Operador").trim();
  let role: string | null = null;

  try {
    const mref = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
    const msnap = await mref.get();
    if (msnap.exists) {
      const md = msnap.data() || {};
      if (md?.nome) nome = String(md.nome).trim();
      if (md?.role) role = String(md.role).trim();
    }
  } catch (e: any) {
    console.warn("[encomendas/validar-lote] getActorInfo falhou:", e?.message || String(e));
  }

  return { uid, email, nome, role };
}

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const decoded = await aauth.verifyIdToken(token);
    const body = (await req.json().catch(() => ({}))) as any;

    const condominioId = String(body?.condominioId || "").trim();
    const codigoInput = String(body?.codigo || "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!codigoInput) return jsonError("Código de retirada é obrigatório", 400);

    const actor = await getActorInfo(db, { condominioId, uid: decoded.uid, decoded });
    const isOperador =
      ["PORTEIRO", "ZELADOR", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(String(actor.role).toUpperCase()) ||
      decoded.superAdmin ||
      decoded.super_admin;
    
    if (!isOperador) {
      return jsonError("Apenas operadores autorizados podem validar retiradas.", 403);
    }

    // Se for retirada em LOTE
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

      // Verifica expiração
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

      // Busca as encomendas
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

    // Se for retirada INDIVIDUAL
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
    console.error("[API validar-lote] erro:", err);
    return jsonError(err?.message || "Erro inesperado no servidor", 500);
  }
}
