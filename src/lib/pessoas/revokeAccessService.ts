/**
 * REV.1 — SERVICE LAYER: REVOGAÇÃO DE ACESSO TENANT-SCOPED
 *
 * Funções puras (sem I/O) usadas por POST /api/admin/membros/revoke.
 * Mantidas separadas do route handler para permitir testes unitários
 * diretos, seguindo a mesma convenção de src/lib/pessoas/service.ts.
 *
 * Esta operação NUNCA:
 *  - toca Firebase Auth (sem updateUser/deleteUser/disabled/token revoke)
 *  - toca o documento Pessoa
 *  - apaga documentos (soft-delete apenas)
 *  - reverte accessStatus/claimedByUid/claimedAt do accessLink
 */

const MAX_REASON_LENGTH = 500;

export interface RevokeAccessPayload {
  condominioId?: unknown;
  targetUid?: unknown;
  reason?: unknown;
}

export interface RevokeAccessValidated {
  condominioId: string;
  targetUid: string;
  reason: string;
}

/**
 * Valida o payload bruto do POST /api/admin/membros/revoke.
 * Retorna a mensagem de erro (para 400) ou null se válido.
 */
export function validateRevokePayload(payload: RevokeAccessPayload): string | null {
  const condominioId = typeof payload.condominioId === "string" ? payload.condominioId.trim() : "";
  const targetUid = typeof payload.targetUid === "string" ? payload.targetUid.trim() : "";
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";

  if (!condominioId) return "condominioId é obrigatório.";
  if (!targetUid) return "targetUid é obrigatório.";
  if (!reason) return "reason é obrigatório.";
  if (reason.length > MAX_REASON_LENGTH) return `reason excede o tamanho máximo de ${MAX_REASON_LENGTH} caracteres.`;

  return null;
}

/**
 * Normaliza o payload já validado (trim em todos os campos string).
 */
export function normalizeRevokePayload(payload: RevokeAccessPayload): RevokeAccessValidated {
  return {
    condominioId: typeof payload.condominioId === "string" ? payload.condominioId.trim() : "",
    targetUid: typeof payload.targetUid === "string" ? payload.targetUid.trim() : "",
    reason: typeof payload.reason === "string" ? payload.reason.trim() : "",
  };
}

export interface MinimalMembroDoc {
  status?: string;
}

export interface MinimalVinculoDoc {
  status?: string;
  ativo?: boolean;
}

/**
 * Verifica se o alvo já está revogado (membro E vinculo já INATIVO/ativo:false).
 * Usado para garantir idempotência real: nenhuma escrita ocorre se já revogado.
 */
export function isAlreadyRevoked(membro: MinimalMembroDoc | null, vinculo: MinimalVinculoDoc | null): boolean {
  if (!membro || !vinculo) return false;
  const membroInativo = String(membro.status || "").toUpperCase() === "INATIVO";
  const vinculoInativo = String(vinculo.status || "").toUpperCase() === "INATIVO" && vinculo.ativo === false;
  return membroInativo && vinculoInativo;
}

/**
 * Valida se a operação de revogação pode prosseguir dado o ator e o alvo.
 * Retorna { ok: false, status, error } em caso de bloqueio; { ok: true } caso contrário.
 *
 * Regras:
 *  - self-revocation (targetUid === actorUid) é sempre bloqueada.
 *  - alvo SUPER_ADMIN só pode ser revogado por um ator também SUPER_ADMIN.
 */
export function checkRevokeGuardrails(params: {
  actorUid: string;
  targetUid: string;
  actorIsSuperAdmin: boolean;
  targetIsSuperAdmin: boolean;
}): { ok: true } | { ok: false; status: number; error: string } {
  const { actorUid, targetUid, actorIsSuperAdmin, targetIsSuperAdmin } = params;

  if (actorUid === targetUid) {
    return { ok: false, status: 400, error: "Auto-revogação não é permitida via este endpoint." };
  }

  if (targetIsSuperAdmin && !actorIsSuperAdmin) {
    return { ok: false, status: 403, error: "Apenas um SUPER_ADMIN pode revogar o acesso de outro SUPER_ADMIN." };
  }

  return { ok: true };
}

export interface MatchedAccessLinkCheck<T> {
  matches: T[];
}

/**
 * Aplica a política "fail closed" para o accessLink relacionado ao claim:
 * zero ou mais de um resultado é sempre um erro — nunca adivinha.
 */
export function resolveUniqueAccessLink<T>(check: MatchedAccessLinkCheck<T>): { ok: true; link: T } | { ok: false; status: number; error: string } {
  if (check.matches.length === 0) {
    return { ok: false, status: 400, error: "Nenhum accessLink VINCULADO encontrado para este membro neste condomínio." };
  }
  if (check.matches.length > 1) {
    return {
      ok: false,
      status: 409,
      error: "Mais de um accessLink VINCULADO encontrado para este membro. Ambíguo — revogação abortada por segurança.",
    };
  }
  return { ok: true, link: check.matches[0] };
}

export interface AccessLinkRevocationDoc {
  revokedAt?: unknown;
  revokedByUid?: string | null;
  revocationReason?: string | null;
  [key: string]: unknown;
}

/**
 * Constrói o patch a ser aplicado ao accessLink, preservando accessStatus/
 * claimedByUid/claimedAt. Não sobrescreve revokedAt se já setado (T12).
 */
export function buildAccessLinkRevocationPatch(
  current: AccessLinkRevocationDoc,
  actorUid: string,
  reason: string,
  serverTimestamp: unknown,
): AccessLinkRevocationDoc & { updatedAt: unknown } | null {
  if (current.revokedAt) {
    // Já revogado anteriormente — não sobrescreve (T12).
    return null;
  }
  return {
    revokedAt: serverTimestamp,
    revokedByUid: actorUid,
    revocationReason: reason,
    updatedAt: serverTimestamp,
  };
}

export function buildMembroRevocationPatch(serverTimestamp: unknown) {
  return {
    status: "INATIVO" as const,
    updatedAt: serverTimestamp,
  };
}

export function buildVinculoRevocationPatch(serverTimestamp: unknown) {
  return {
    status: "INATIVO" as const,
    ativo: false,
    updatedAt: serverTimestamp,
  };
}
