/**
 * F.2.1 — SERVICE LAYER DA ENTIDADE PESSOA
 *
 * Opera server-side via Firebase Admin SDK.
 * Toda escrita é validada: autenticação, autorização e tenant isolation.
 */

import {
  type PersonData,
  type PersonCreatePayload,
  type PersonUpdatePayload,
  type LinkMembershipPayload,
  type LinkMembershipResult,
} from "./types";

export function buildPessoaDoc(payload: PersonCreatePayload): Omit<PersonData, "id"> {
  const now = new Date().toISOString();
  const emailVal = payload.email?.trim().toLowerCase() || null;
  return {
    condominioId: payload.condominioId,
    nome: payload.nome.trim(),
    email: emailVal,
    emailNorm: emailVal,
    telefone: payload.telefone?.trim() || null,
    status: "ATIVO",
    createdAt: now,
    updatedAt: now,
    metadata: {
      origem: payload.metadata?.origem || "CADASTRO_MANUAL",
    },
  };
}

export function validatePersonPayload(payload: PersonCreatePayload): string | null {
  if (!payload.condominioId?.trim()) return "condominioId é obrigatório.";
  if (!payload.nome?.trim()) return "nome é obrigatório.";
  if (payload.telefone && payload.telefone.length > 30) return "telefone inválido (máximo 30 caracteres).";
  return null;
}

export function validateLinkMembershipPayload(payload: LinkMembershipPayload): string | null {
  if (!payload.condominioId?.trim()) return "condominioId é obrigatório.";
  if (!payload.personId?.trim()) return "personId é obrigatório.";
  if (!payload.uid?.trim()) return "uid é obrigatório.";
  return null;
}

export function buildLinkResult(
  personId: string,
  uid: string,
  condominioId: string,
  alreadyLinked: boolean,
): LinkMembershipResult {
  return {
    ok: true,
    personId,
    uid,
    condominioId,
    alreadyLinked,
  };
}

export function maskPersonId(personId: string): string {
  if (personId.length <= 8) return personId.substring(0, 2) + "***";
  return personId.substring(0, 4) + "***";
}

export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "nome" || key === "email" || key === "telefone") continue;
    out[key] = value;
  }
  return out;
}
