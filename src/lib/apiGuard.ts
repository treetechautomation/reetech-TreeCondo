import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { checkRateLimit, checkRateLimitV2, type RateLimitResult } from "@/lib/rateLimiter";
import { jsonError } from "@/lib/jsonError";

export type GuardRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "ADMIN_CONDOMINIO"
  | "SINDICO"
  | "PORTEIRO"
  | "SEGURANCA"
  | "ZELADOR"
  | "MORADOR";

export interface ApiGuardConfig {
  request: Request;
  condominioId?: string;
  allowedRoles?: GuardRole[];
  requireAuth?: boolean;
  requireEmailVerified?: boolean;
  /**
   * Operações verdadeiramente globais (Painel Global Treetech), sem tenant.
   * Não deve ser combinado com condominioId artificial. Exige isSuperAdmin
   * independentemente de vínculo com condomínio.
   */
  requireSuperAdmin?: boolean;
  rateLimit?: {
    limit: number;
    windowSec: number;
  };
}

export interface ApiGuardContext {
  uid: string;
  email: string;
  emailVerified: boolean;
  decodedToken: Record<string, any>;
  condominioId: string | null;
  tenantId: string | null;
  role: GuardRole | null;
  isSuperAdmin: boolean;
  membroData: Record<string, any> | null;
  rateLimitInfo: RateLimitResult | null;
}

const ALL_GUARD_ROLES: GuardRole[] = [
  "SUPER_ADMIN", "ADMIN", "ADMIN_CONDOMINIO", "SINDICO",
  "PORTEIRO", "SEGURANCA", "ZELADOR", "MORADOR",
];

function upper(v: any): string {
  return String(v || "").toUpperCase().trim();
}

function isSuperAdminToken(decoded: Record<string, any>): boolean {
  return (
    decoded.super_admin === true ||
    decoded.superAdmin === true ||
    upper(decoded.role) === "SUPER_ADMIN"
  );
}

function normalizeRole(raw: string | null | undefined): GuardRole | null {
  const r = upper(raw);
  return ALL_GUARD_ROLES.includes(r as GuardRole) ? (r as GuardRole) : null;
}

export async function apiGuard(config: ApiGuardConfig): Promise<ApiGuardContext> {
  const {
    request,
    condominioId = null,
    allowedRoles,
    requireAuth = true,
    requireEmailVerified = false,
    requireSuperAdmin = false,
    rateLimit,
  } = config;

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    if (requireAuth) throw jsonError("Token ausente (Authorization: Bearer ...)", 401);

    if (rateLimit) {
      const ip = request.headers.get("x-forwarded-for") || "unknown";
      const rlKey = `${ip}:public`;
      const rl = checkRateLimit({ key: rlKey, limit: rateLimit.limit, windowSec: rateLimit.windowSec });
      if (!rl.allowed) {
        const { NextResponse } = require("next/server");
        throw NextResponse.json(
          { ok: false, error: "Muitas requisições. Tente novamente em instantes." },
          {
            status: 429,
            headers: {
              "X-RateLimit-Remaining": String(rl.remaining),
              "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            },
          }
        );
      }
      return {
        uid: "anon", email: "", emailVerified: false,
        decodedToken: {}, condominioId: null, tenantId: null,
        role: null, isSuperAdmin: false, membroData: null,
        rateLimitInfo: rl,
      };
    }

    return {
      uid: "anon", email: "", emailVerified: false,
      decodedToken: {}, condominioId: null, tenantId: null,
      role: null, isSuperAdmin: false, membroData: null,
      rateLimitInfo: null,
    };
  }

  let decoded: Record<string, any>;
  try {
    decoded = await adminAuth().verifyIdToken(token);
  } catch {
    throw jsonError("Token inválido ou expirado.", 401);
  }

  const uid = String(decoded.uid || "");
  const email = String(decoded.email || "").toLowerCase();
  const emailVerified = decoded.email_verified === true;
  const isSuperAdmin = isSuperAdminToken(decoded);

  if (requireEmailVerified) {
    if (!emailVerified) {
      const authUser = await adminAuth().getUser(uid).catch(() => null);
      if (!authUser?.emailVerified) {
        throw jsonError("EMAIL_NOT_VERIFIED. Verifique seu e-mail antes de continuar.", 403);
      }
    }
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    throw jsonError("Acesso restrito a SUPER_ADMIN.", 403);
  }

  let role: GuardRole | null = null;
  let membroData: Record<string, any> | null = null;
  let rateLimitInfo: RateLimitResult | null = null;
  const db = adminDb();

  if (condominioId) {
    const membroRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("membros")
      .doc(uid);
    const membroSnap = await membroRef.get();

    if (membroSnap.exists) {
      membroData = (membroSnap.data() || {}) as Record<string, any>;
      role = normalizeRole(membroData.role);
      const status = upper(membroData.status);
      if (!isSuperAdmin && status !== "ATIVO") {
        throw jsonError("Seu vínculo neste condomínio não está ativo.", 403);
      }
    } else {
      const vincRef = db
        .collection("userCondominios")
        .doc(uid)
        .collection("vinculos")
        .doc(condominioId);
      const vincSnap = await vincRef.get();
      if (vincSnap.exists) {
        membroData = (vincSnap.data() || {}) as Record<string, any>;
        role = normalizeRole(membroData.role);
        const status = upper(membroData.status);
        if (!isSuperAdmin && status !== "ATIVO") {
          throw jsonError("Seu vínculo neste condomínio não está ativo.", 403);
        }
      } else {
        throw jsonError("Você não possui vínculo com este condomínio.", 403);
      }
    }
  }

  if (rateLimit) {
    rateLimitInfo = checkRateLimit({
      key: `${uid}:rl`,
      limit: rateLimit.limit,
      windowSec: rateLimit.windowSec,
    });
    if (!rateLimitInfo.allowed) {
      const { NextResponse } = require("next/server");
      throw NextResponse.json(
        { ok: false, error: "Muitas requisições. Tente novamente em instantes." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": String(rateLimitInfo.remaining),
            "Retry-After": String(Math.ceil((rateLimitInfo.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }
  } else if (condominioId) {
    const tierRole = isSuperAdmin ? "SUPER_ADMIN" : (role || "MORADOR");
    rateLimitInfo = checkRateLimitV2({
      uid,
      ip: request.headers.get("x-forwarded-for") || null,
      endpoint: extractEndpoint(request.url),
      tenantId: condominioId,
      role: tierRole,
    });
  }

  if (condominioId && allowedRoles && allowedRoles.length > 0 && !isSuperAdmin) {
    if (!role || !allowedRoles.includes(role)) {
      throw jsonError("Seu perfil não tem permissão para esta operação.", 403);
    }
  }

  return {
    uid,
    email,
    emailVerified,
    decodedToken: decoded,
    condominioId,
    tenantId: condominioId,
    role: isSuperAdmin ? "SUPER_ADMIN" : role,
    isSuperAdmin,
    membroData,
    rateLimitInfo,
  };
}

function extractEndpoint(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\/api\//, "").replace(/\//g, ":");
  } catch {
    return "unknown";
  }
}
