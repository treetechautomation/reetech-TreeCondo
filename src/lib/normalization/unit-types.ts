/**
 * Tipos canônicos de Unidade e Bloco.
 *
 * Sprint UN.3 — CADASTRO DE BLOCOS E UNIDADES
 * Baseado nos contratos UN.2 / UN.2.1 / UN.2.2
 */

export type UnidadeTipo = "APARTAMENTO" | "CASA" | "SALA" | "LOJA" | "LOTE" | "CONJUNTO" | "OUTRO";

export type BlocoTipo = "BLOCO" | "TORRE" | "QUADRA" | "SETOR" | "ALAMEDA" | "OUTRO";

export type OcupacaoStatus = "VAGO" | "OCUPADO" | "EM_REFORMA" | "INTERDITADO";

export type UnitDocId = string;

export interface UnidadeCanonica {
  id: string;
  blocoId: string;
  numero: string;
  numeroNorm: string;
  tipo: UnidadeTipo;
  tipoCustom?: string | null;
  status: "ATIVO" | "INATIVO";
  andar?: number | null;
  ocupacao: OcupacaoStatus;
  proprietarioUid?: string | null;
  inquilinoUid?: string | null;
  ativo: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface BlocoCanonico {
  id: string;
  nome: string;
  nomeNorm: string;
  tipo: BlocoTipo;
  tipoCustom?: string | null;
  isSistema: boolean;
  ordem?: number;
  ativo: boolean;
  condominioId: string;
  createdAt?: any;
  updatedAt?: any;
}

export function buildUnitDocPath(condominioId: string, blocoId: string, unitDocId: string): string {
  return `condominios/${condominioId}/blocos/${blocoId}/unidades/${unitDocId}`;
}

export function parseUnitDocPath(path: string): {
  condominioId: string;
  blocoId: string;
  unitDocId: string;
} | null {
  const match = path.match(
    /^condominios\/([^/]+)\/blocos\/([^/]+)\/unidades\/([^/]+)$/
  );
  if (!match) return null;
  return {
    condominioId: match[1],
    blocoId: match[2],
    unitDocId: match[3],
  };
}
