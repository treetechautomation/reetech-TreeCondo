/**
 * ENCOMENDAS.2F — regra pura de autorização para o endpoint de auditoria
 * de uma encomenda. Não acessa Firestore/HTTP — recebe dados já
 * resolvidos pelo apiGuard/consulta do pacote e decide apenas.
 *
 * Papéis de gestão (mesmo contrato de allowedRoles já usado por
 * create/retirar/retirar-qr): acesso irrestrito ao próprio condomínio,
 * já garantido pelo apiGuard (condominioId + vínculo ATIVO). MORADOR só
 * enxerga pacotes da própria unidade/bloco. SUPER_ADMIN sempre passa
 * (bypass já existente em apiGuard).
 */

export const AUDIT_STAFF_ROLES = ["PORTEIRO", "ZELADOR", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO"] as const;

export type AuditAuthorizationResult =
  | { allowed: true }
  | { allowed: false; reason: "INACTIVE_MEMBERSHIP" | "UNRELATED_UNIT" | "ROLE_NOT_PERMITTED" };

export interface AuditMembroSnapshot {
  status?: string | null;
  unidadeIdNorm?: string | null;
  blocoIdNorm?: string | null;
}

export interface AuditEncomendaSnapshot {
  unidadeIdNorm?: string | null;
  blocoIdNorm?: string | null;
}

export function resolveEncomendaAuditAuthorization(params: {
  isSuperAdmin: boolean;
  role: string | null;
  membroData: AuditMembroSnapshot | null;
  encomenda: AuditEncomendaSnapshot;
}): AuditAuthorizationResult {
  if (params.isSuperAdmin) {
    return { allowed: true };
  }

  const role = String(params.role || "").toUpperCase();

  if ((AUDIT_STAFF_ROLES as readonly string[]).includes(role)) {
    // apiGuard já garantiu condominioId correto + vínculo ATIVO para
    // chegar até aqui — nenhuma verificação adicional de unidade é
    // necessária para papéis de gestão/portaria.
    return { allowed: true };
  }

  if (role === "MORADOR") {
    const membro = params.membroData;
    if (!membro || String(membro.status || "").toUpperCase() !== "ATIVO") {
      return { allowed: false, reason: "INACTIVE_MEMBERSHIP" };
    }

    const membroUnidade = String(membro.unidadeIdNorm || "").trim();
    const encomendaUnidade = String(params.encomenda.unidadeIdNorm || "").trim();
    const unidadeMatches = !!membroUnidade && membroUnidade === encomendaUnidade;

    const encomendaBloco = params.encomenda.blocoIdNorm ?? null;
    const membroBloco = membro.blocoIdNorm ?? null;
    const blocoMatches = encomendaBloco == null || String(membroBloco || "") === String(encomendaBloco || "");

    if (unidadeMatches && blocoMatches) {
      return { allowed: true };
    }
    return { allowed: false, reason: "UNRELATED_UNIT" };
  }

  return { allowed: false, reason: "ROLE_NOT_PERMITTED" };
}
