/**
 * ADMIN_CONDOMINIO.1C — CANONICAL IDENTITY RESOLVER (pure logic)
 *
 * Extraído de /api/auth/resolve-identity para permitir testes unitários
 * sem depender do Admin SDK/Firestore. A rota da API é responsável apenas
 * por buscar os dados (vínculos, convites) e delegar a decisão para esta
 * função — evitando duplicar a lógica de estado em LoginClient e AppLayout
 * (ver ADMIN_CONDOMINIO.1B seção 7).
 */

export type IdentityState =
  | "SUPER_ADMIN"
  | "ACTIVE_LINKED_USER"
  | "PENDING_INVITED_USER"
  | "NO_PENDING_INVITE";

export type IdentityResolution = {
  state: IdentityState;
  conviteId?: string;
};

const PENDING_CONVITE_STATUSES = new Set(["PENDENTE", "PROCESSADO"]);

export function isPendingConviteStatus(status: string | undefined | null): boolean {
  return PENDING_CONVITE_STATUSES.has(String(status || "").toUpperCase());
}

export function resolveIdentityState(input: {
  isSuper: boolean;
  vinculos: Array<{ status?: string | null }>;
  /** Convites já filtrados por uidGerado == uid do usuário autenticado.
   *  NUNCA filtrar por email fornecido pelo client — ver ADMIN_CONDOMINIO.1B
   *  seção 9 (segurança multi-tenant). */
  convites: Array<{ id: string; status?: string | null }>;
}): IdentityResolution {
  if (input.isSuper) {
    return { state: "SUPER_ADMIN" };
  }

  const hasActiveVinculo = input.vinculos.some(
    (v) => String(v.status || "").toUpperCase() === "ATIVO"
  );
  if (hasActiveVinculo) {
    return { state: "ACTIVE_LINKED_USER" };
  }

  const pending = input.convites.find((c) => isPendingConviteStatus(c.status));
  if (pending) {
    return { state: "PENDING_INVITED_USER", conviteId: pending.id };
  }

  return { state: "NO_PENDING_INVITE" };
}
