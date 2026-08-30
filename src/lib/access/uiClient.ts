/**
 * ACCESS.5 — CLIENTE HTTP CENTRAL DAS ROTAS DE CONTROLE DE ACESSO.
 *
 * CRÍTICO (ACCESS.5 §44/§45): client-safe apenas. Nunca importar
 * `node:crypto`, Firebase Admin, ou qualquer módulo server-only de
 * `@/lib/access/*`. Usa somente `firebase/auth` (client SDK) + `fetch`,
 * mesmo padrão já usado em `src/app/acesso/page.tsx`.
 */
"use client";

import { getAuth } from "firebase/auth";
import type { AccessTypeUi } from "./uiLabels";

async function authedFetch(path: string, init?: RequestInit) {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");

  const resp = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data?.ok === false) {
    const err: any = new Error(String(data?.error || "Não foi possível completar a operação."));
    err.code = data?.code;
    err.status = resp.status;
    throw err;
  }
  return data;
}

export interface CreateAuthorizationInput {
  condominioId: string;
  accessType: AccessTypeUi;
  nome: string;
  visitDate: string;
  expectedEntryAt?: string | null;
  expectedExitAt?: string | null;
  telefone?: string | null;
  placa?: string | null;
  observacao?: string | null;
  unitId?: string | null;
}

export interface AuthorizationDto {
  id: string;
  unitId: string;
  blocoId: string | null;
  accessType: AccessTypeUi;
  visitorSnapshot: { nome: string; telefone?: string | null; placa?: string | null; observacao?: string | null };
  visitDate: string;
  expectedEntryAt: string | null;
  expectedExitAt: string | null;
  newEntryValidFrom: string;
  newEntryValidUntil: string;
  usagePolicy: "SINGLE_USE" | "MULTI_USE";
  effectiveStatus: "AUTORIZADO" | "REVOGADO" | "EXPIRADO";
  createdAt: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
}

export interface CreateAuthorizationResult {
  authorization: AuthorizationDto;
  credential: { qrToken?: string; pin?: string };
}

export async function createAuthorization(input: CreateAuthorizationInput): Promise<CreateAuthorizationResult> {
  const { condominioId, ...rest } = input;
  const data = await authedFetch("/api/acesso-controle/autorizacoes", {
    method: "POST",
    body: JSON.stringify({ condominioId, ...rest }),
  });
  return { authorization: data.authorization, credential: data.credential };
}

export async function listAuthorizations(
  condominioId: string,
  scope?: "active" | "upcoming" | "history",
): Promise<AuthorizationDto[]> {
  const params = new URLSearchParams({ condominioId });
  if (scope) params.set("scope", scope);
  const data = await authedFetch(`/api/acesso-controle/autorizacoes?${params.toString()}`);
  return data.items || [];
}

export async function getAuthorization(condominioId: string, authorizationId: string): Promise<AuthorizationDto> {
  const params = new URLSearchParams({ condominioId });
  const data = await authedFetch(`/api/acesso-controle/autorizacoes/${authorizationId}?${params.toString()}`);
  return data.authorization;
}

export async function revokeAuthorization(
  condominioId: string,
  authorizationId: string,
  reason?: string,
): Promise<{ alreadyRevoked: boolean }> {
  const data = await authedFetch(`/api/acesso-controle/autorizacoes/${authorizationId}/revogar`, {
    method: "POST",
    body: JSON.stringify({ condominioId, ...(reason ? { reason } : {}) }),
  });
  return { alreadyRevoked: !!data.alreadyRevoked };
}

// ─────────────────────────── ACCESS.5B — eligible units context ───────────────────────────

export interface EligibleUnitUi {
  unitId: string;
  blocoId: string | null;
  label: string;
}

export interface AccessContext {
  units: EligibleUnitUi[];
  selectionRequired: boolean;
}

export async function getAccessContext(condominioId: string): Promise<AccessContext> {
  const params = new URLSearchParams({ condominioId });
  const data = await authedFetch(`/api/acesso-controle/contexto?${params.toString()}`);
  return { units: data.units || [], selectionRequired: !!data.selectionRequired };
}
