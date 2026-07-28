import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { expirarOfertas } from "@/lib/reservasOfertaExpirada";

function upper(v: any) {
  return String(v || "").toUpperCase().trim();
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function isAdminRole(role: any) {
  const r = upper(role);
  return ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(r);
}

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const decoded = await aauth.verifyIdToken(token);

    const body = await req.json().catch(() => ({}));
    const condominioId = String(body?.condominioId || "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const actorUid = String(decoded.uid || "");
    let actorRole: string | null = null;
    let actorNome = String(decoded?.name || decoded?.email || "Usuário").trim();
    let membroStatus = "";

    try {
      const mref = db
        .collection("condominios")
        .doc(condominioId)
        .collection("membros")
        .doc(actorUid);
      const msnap = await mref.get();
      if (msnap.exists) {
        const md = msnap.data() || {};
        if (md?.nome) actorNome = String(md.nome).trim();
        if (md?.role) actorRole = String(md.role).trim();
      }
      membroStatus = upper((msnap.data() || {}).status || "");
    } catch (e: any) {
      console.warn(
        "[admin/processar-fila] Falha ao ler membro:",
        e?.message || String(e),
      );
    }

    const isSuper =
      (decoded as any)?.super_admin === true ||
      (decoded as any)?.superAdmin === true;

    if (!isAdminRole(actorRole) && !isSuper) {
      return jsonError("Sem permissão para processar a fila.", 403);
    }

    if (!isSuper && membroStatus !== "ATIVO") {
      return jsonError("Membro inativo.", 403);
    }

    if (!isSuper && membroStatus !== "ATIVO") {
      return jsonError("Membro inativo.", 403);
    }

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const executadoEm = new Date().toISOString();

    const resultado = await expirarOfertas(condominioId, new Date());

    console.log(
      "[admin/processar-fila] Processamento manual da fila executado",
      JSON.stringify({
        usuario: actorUid,
        nome: actorNome,
        perfil: actorRole || (isSuper ? "SUPER_ADMIN" : "unknown"),
        condominio: condominioId,
        horario: executadoEm,
        ip,
        expiradas: resultado.expiradas,
        promovidas: resultado.promovidas.length,
      }),
    );

    return NextResponse.json({
      success: true,
      condominioId,
      expiradas: resultado.expiradas,
      promovidas: resultado.promovidas,
      executadoEm,
    });
  } catch (err: any) {
    console.error("[API admin/processar-fila] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Método não permitido. Use POST." },
    { status: 405 },
  );
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: "Método não permitido. Use POST." },
    { status: 405 },
  );
}

export async function PATCH() {
  return NextResponse.json(
    { success: false, error: "Método não permitido. Use POST." },
    { status: 405 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: "Método não permitido. Use POST." },
    { status: 405 },
  );
}

export async function HEAD() {
  return NextResponse.json(
    { success: false, error: "Método não permitido. Use POST." },
    { status: 405 },
  );
}

export async function OPTIONS() {
  return NextResponse.json(
    { success: false, error: "Método não permitido. Use POST." },
    { status: 405 },
  );
}
