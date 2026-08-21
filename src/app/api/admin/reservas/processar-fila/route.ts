import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { expirarOfertas } from "@/lib/reservasOfertaExpirada";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

import type { GuardRole } from "@/lib/apiGuard";
const ADMIN_ROLES: GuardRole[] = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const condominioId = String(body?.condominioId || "").trim();

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ADMIN_ROLES,
    });

    const db = adminDb();
    const actorNome = ctx.membroData?.nome || ctx.email || "Usuário";

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const executadoEm = new Date().toISOString();

    const resultado = await expirarOfertas(condominioId, new Date());

    console.log(
      "[admin/processar-fila] Processamento manual da fila executado",
      JSON.stringify({
        usuario: ctx.uid,
        nome: actorNome,
        perfil: ctx.role || "SUPER_ADMIN",
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
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("[API admin/processar-fila] erro:", e);
    return jsonError(e?.message || "Erro inesperado", 500);
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
