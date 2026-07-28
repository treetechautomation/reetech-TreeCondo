/**
 * F.2.6 — AUTHORIZATION UTILITY COMPARTILHADA
 *
 * Substitui o boilerplate de autorização repetido em 3+ APIs.
 * Retorna contexto validado, não apenas true/false.
 */

import { type NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import type { VinculoRole } from "./types";

export interface AdminAuthorizationContext {
  uid: string;
  condominioId: string;
  role: VinculoRole;
  isSuperAdmin: boolean;
}

export interface CheckAdminAuthParams {
  /** Objeto Request da API route */
  request: Request;
  /** CondominioId a ser validado */
  condominioId: string;
  /** Roles autorizadas para esta operação */
  allowedRoles: VinculoRole[];
}

export interface AuthCheckResult {
  ok: boolean;
  error?: string;
  status?: number;
  context?: AdminAuthorizationContext;
}

export async function checkAdminAuth(params: CheckAdminAuthParams): Promise<AuthCheckResult> {
  const { request, condominioId, allowedRoles } = params;

  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return { ok: false, error: "Token ausente.", status: 401 };

    let decoded: any;
    try {
      decoded = await adminAuth().verifyIdToken(token);
    } catch {
      return { ok: false, error: "Token inválido ou expirado.", status: 401 };
    }

    const uid = decoded.uid as string;
    const isSuperAdmin =
      decoded.super_admin === true ||
      (decoded as any).superAdmin === true ||
      String((decoded as any).role || "").toUpperCase() === "SUPER_ADMIN";

    if (isSuperAdmin) {
      return {
        ok: true,
        context: { uid, condominioId, role: "MORADOR" as VinculoRole, isSuperAdmin: true },
      };
    }

    const db = adminDb();
    const vincRef = db
      .collection("userCondominios")
      .doc(uid)
      .collection("vinculos")
      .doc(condominioId);

    const vincSnap = await vincRef.get();
    if (!vincSnap.exists) {
      return { ok: false, error: "Você não possui vínculo com este condomínio.", status: 403 };
    }

    const vincData = vincSnap.data() || {};
    const role = String(vincData.role || "").toUpperCase() as VinculoRole;
    const status = String(vincData.status || "").toUpperCase();

    if (status !== "ATIVO") {
      return { ok: false, error: "Seu vínculo neste condomínio não está ativo.", status: 403 };
    }

    if (!allowedRoles.includes(role)) {
      return { ok: false, error: "Seu perfil não tem permissão para esta operação.", status: 403 };
    }

    return {
      ok: true,
      context: { uid, condominioId, role, isSuperAdmin: false },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Erro de autorização.", status: 500 };
  }
}
