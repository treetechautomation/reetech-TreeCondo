/**
 * UI.CADASTROS.SEARCH — Busca client-side na tela "Pessoas cadastradas".
 *
 * Filtra o array de membros já carregado (via onSnapshot) por um termo de
 * busca livre, combinando com o filtro de papel/role (chips) já existente.
 * Reaproveita o normalizador compartilhado normNFD (lowercase + remoção de
 * acentos via NFD) em vez de criar um novo helper.
 */
import { normNFD } from "@/lib/normalization/text";

export type PessoaSearchable = {
  nome?: string | null;
  email?: string | null;
  role?: string | null;
  tipo?: string | null;
  funcionarioTipo?: string | null;
  blocoId?: string | null;
  unidadeId?: string | null;
  status?: string | null;
};

/**
 * Retorna true se `pessoa` corresponde ao termo de busca `termo`.
 * Termo vazio (após trim) sempre corresponde (comportamento "sem busca").
 * Comparação é: case-insensitive, accent-insensitive, partial match (substring).
 */
export function matchesSearch(pessoa: PessoaSearchable, termo: string): boolean {
  const q = normNFD(termo);
  if (!q) return true;

  const campos: Array<string | null | undefined> = [
    pessoa.nome,
    pessoa.email,
    pessoa.blocoId,
    pessoa.unidadeId,
    pessoa.role,
    pessoa.tipo,
    pessoa.funcionarioTipo,
    pessoa.status,
  ];

  return campos.some((campo) => campo != null && normNFD(String(campo)).includes(q));
}

/**
 * Aplica busca sobre uma lista já filtrada por papel/role (chips).
 * Não faz nada além de filtrar — a ordenação/origem dos dados é responsabilidade do caller.
 */
export function filterPessoasPorBusca<T extends PessoaSearchable>(
  pessoas: T[],
  termo: string
): T[] {
  if (!normNFD(termo)) return pessoas;
  return pessoas.filter((p) => matchesSearch(p, termo));
}
