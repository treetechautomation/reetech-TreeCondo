/**
 * F.2.1 — CREATE PESSOA (server-side)
 *
 * POST /api/pessoas/create
 *
 * Cria uma Pessoa independente de Firebase Auth.
 * Requer membership ativo com role autorizada no condomínio.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import {
  buildPessoaDoc,
  validatePersonPayload,
  maskPersonId,
  sanitizeLogData,
} from "@/lib/pessoas/service";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

import type { GuardRole } from "@/lib/apiGuard";
const ALLOWED_ROLES: GuardRole[] = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const validationError = validatePersonPayload(body);
    if (validationError) return jsonError(validationError, 400);

    const condominioId = String(body.condominioId || "").trim();
    const nome = String(body.nome || "").trim();
    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    const telefone = body.telefone ? String(body.telefone).trim() : null;

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ALLOWED_ROLES,
    });

    const db = adminDb();
    const condoRef = db.collection("condominios").doc(condominioId);
    const condoSnap = await condoRef.get();
    if (!condoSnap.exists) {
      return jsonError("Condomínio não encontrado.", 404);
    }

    const personRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("pessoas")
      .doc();

    const personData = buildPessoaDoc({
      condominioId,
      nome,
      email,
      telefone,
      metadata: { origem: body.metadata?.origem || "CADASTRO_MANUAL" },
    });

    await personRef.set(personData);

    const safeLog = sanitizeLogData({
      operation: "PERSON_CREATED",
      condominioId,
      personId: maskPersonId(personRef.id),
      actorUid: ctx.uid,
    });
    console.log("[pessoas/create]", JSON.stringify(safeLog));

    return NextResponse.json({
      ok: true,
      personId: personRef.id,
      nome: personData.nome,
      status: personData.status,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("[pessoas/create] Erro:", maskPersonId(e?.message || ""));
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
