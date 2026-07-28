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

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import {
  buildPessoaDoc,
  validatePersonPayload,
  maskPersonId,
  sanitizeLogData,
} from "@/lib/pessoas/service";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function jsonOk(data: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...data });
}

const ROLES_AUTORIZADAS = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente.", 401);

    let decoded: any;
    try {
      decoded = await aauth.verifyIdToken(token);
    } catch {
      return jsonError("Token inválido ou expirado.", 401);
    }

    const requesterUid = decoded.uid as string;
    const isSuper =
      decoded.super_admin === true ||
      (decoded as any).superAdmin === true ||
      String((decoded as any).role || "").toUpperCase() === "SUPER_ADMIN";

    const body = (await req.json().catch(() => ({}))) as any;
    const validationError = validatePersonPayload(body);
    if (validationError) return jsonError(validationError, 400);

    const condominioId = String(body.condominioId || "").trim();
    const nome = String(body.nome || "").trim();
    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    const telefone = body.telefone ? String(body.telefone).trim() : null;

    if (!isSuper) {
      const vincRef = db
        .collection("userCondominios")
        .doc(requesterUid)
        .collection("vinculos")
        .doc(condominioId);
      const vincSnap = await vincRef.get();

      if (!vincSnap.exists) {
        return jsonError("Você não possui vínculo com este condomínio.", 403);
      }

      const vincData = vincSnap.data() || {};
      const role = String(vincData.role || "").toUpperCase();
      const status = String(vincData.status || "").toUpperCase();

      if (status !== "ATIVO") {
        return jsonError("Seu vínculo neste condomínio não está ativo.", 403);
      }

      if (!ROLES_AUTORIZADAS.includes(role)) {
        return jsonError("Seu perfil não tem permissão para cadastrar pessoas.", 403);
      }
    }

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
      actorUid: requesterUid,
    });
    console.log("[pessoas/create]", JSON.stringify(safeLog));

    return jsonOk({
      personId: personRef.id,
      nome: personData.nome,
      status: personData.status,
    });
  } catch (err: any) {
    console.error("[pessoas/create] Erro:", maskPersonId(err?.message || ""));
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
