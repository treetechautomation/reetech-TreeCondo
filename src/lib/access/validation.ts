/**
 * ACCESS.3 — VALIDAÇÃO DE VisitorSnapshot.
 *
 * Sem Zod: o restante do domínio de Acesso (e a maior parte do projeto
 * fora de `src/modules/ficha`) não usa Zod como convenção — mantendo
 * consistência com `src/lib/anuncios`/`src/lib/encomendas`, que validam
 * com checagens explícitas. Introduzir Zod aqui criaria um padrão de
 * validação isolado dentro do próprio domínio de Acesso.
 */

import { VISITOR_SNAPSHOT_LIMITS, type VisitorSnapshot } from "./types";

export type VisitorSnapshotValidation =
  | { valid: true; snapshot: VisitorSnapshot }
  | { valid: false; reason: string };

/** Aceita um payload bruto (`unknown`) e retorna um `VisitorSnapshot` normalizado e dentro dos limites, ou o motivo da rejeição. Nunca lança. */
export function validateVisitorSnapshot(raw: unknown): VisitorSnapshotValidation {
  if (typeof raw !== "object" || raw === null) {
    return { valid: false, reason: "Payload inválido." };
  }
  const input = raw as Record<string, unknown>;

  const nome = typeof input.nome === "string" ? input.nome.trim() : "";
  if (!nome) return { valid: false, reason: "Nome é obrigatório." };
  if (nome.length > VISITOR_SNAPSHOT_LIMITS.nome) {
    return { valid: false, reason: `Nome excede o tamanho máximo de ${VISITOR_SNAPSHOT_LIMITS.nome} caracteres.` };
  }

  const optionalField = (key: "telefone" | "placa" | "observacao"): string | null | { error: string } => {
    const value = input[key];
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") return { error: `${key} inválido.` };
    const trimmed = value.trim();
    if (trimmed.length > VISITOR_SNAPSHOT_LIMITS[key]) {
      return { error: `${key} excede o tamanho máximo de ${VISITOR_SNAPSHOT_LIMITS[key]} caracteres.` };
    }
    return trimmed || null;
  };

  const telefone = optionalField("telefone");
  if (telefone && typeof telefone === "object") return { valid: false, reason: telefone.error };

  const placa = optionalField("placa");
  if (placa && typeof placa === "object") return { valid: false, reason: placa.error };

  const observacao = optionalField("observacao");
  if (observacao && typeof observacao === "object") return { valid: false, reason: observacao.error };

  return {
    valid: true,
    snapshot: {
      nome,
      telefone: telefone as string | null,
      placa: placa as string | null,
      observacao: observacao as string | null,
    },
  };
}
