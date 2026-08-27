/**
 * P1.0 — PessoaRules — Camada de Domínio do módulo Pessoas.
 *
 * Padrão Oficial de Camada de Domínio do TreeCondo (homologado antes desta
 * fase de implementação). Esta camada decide FATOS de negócio sobre uma
 * Pessoa — nunca decide AUTORIZAÇÃO.
 *
 * Princípios obrigatórios (homologados, não negociáveis nesta ou em
 * qualquer fase futura):
 *   - Pura: sem Firestore, sem firebase-admin, sem React, sem apiGuard.
 *   - Síncrona: nenhuma função retorna Promise.
 *   - Determinística: nenhuma chamada a Date.now()/new Date()/Math.random()
 *     internamente — tempo, quando necessário, é sempre parâmetro de entrada.
 *   - Sem HTTP, sem IO, sem logs, sem exceções.
 *   - Recebe dados (PessoaVinculoSnapshot). Retorna decisões (boolean).
 *
 * O que NUNCA pertence a este arquivo (fica em apiGuard/Firestore Rules):
 *   - RBAC, ACL, verificação de token, allowedRoles, tenant isolation.
 *   - Qualquer decisão de "quem PODE fazer X" — só "o que É verdade sobre X".
 *   - Por isso, nenhuma função aqui usa prefixo `can*`: nomes desse tipo
 *     convidam a misturar autorização dentro do domínio (ex.: um hipotético
 *     `canCreateInvite()` tentaria decidir também quem tem permissão de
 *     convidar, que é responsabilidade de `ALLOWED_TARGET_ROLES` em
 *     `/api/convites/create`, não desta camada).
 *
 * `role` continua sendo a ÚNICA fonte de autorização (RBAC) — nunca lido
 * aqui como sinônimo de categoria ou moradia. `categoriaPessoa` e
 * `moraNoCondominio` são informação de domínio, nunca autorização.
 *
 * P1.0 — Etapa 2: `categoriaPessoa` é importado como type-only de
 * `pessoas/types.ts` (fonte única de tipo, sem duplicação) — import de tipo
 * é erased em tempo de compilação, portanto não introduz I/O nem quebra a
 * pureza desta camada.
 */

import type { CategoriaPessoa } from "../types";

export type { CategoriaPessoa };

/**
 * Dados mínimos sobre uma Pessoa/Vínculo necessários para as decisões desta
 * camada. Nunca inclui token, uid do solicitante, condominioId de contexto
 * de autorização ou qualquer campo de segurança — apenas fatos sobre a
 * própria pessoa avaliada.
 */
export type PessoaVinculoSnapshot = {
  /** RBAC — nunca usado aqui para decidir categoria/moradia, apenas lido como fato para a regra homologada de compatibilidade com MORADOR. */
  role: string | null;
  categoriaPessoa: CategoriaPessoa | null;
  moraNoCondominio: boolean | null;
  blocoId: string | null;
  unidadeId: string | null;
};

/**
 * A pessoa reside fisicamente no condomínio?
 * Fato de domínio puro — não é autorização.
 */
export function isResident(pessoa: PessoaVinculoSnapshot): boolean {
  return pessoa.moraNoCondominio === true;
}

/**
 * A pessoa já possui bloco e unidade preenchidos?
 * Não decide se DEVERIA ter — apenas constata o estado atual dos dados.
 */
export function hasResidentialLink(pessoa: PessoaVinculoSnapshot): boolean {
  return Boolean(pessoa.blocoId) && Boolean(pessoa.unidadeId);
}

/**
 * Bloco e unidade são obrigatórios para esta pessoa?
 *
 * Regra homologada na auditoria de segurança (P0): esta condição é uma
 * EXTENSÃO por OR da regra já vigente em produção (`role === "MORADOR"`),
 * nunca uma substituição. Isso garante, por construção, que nenhum
 * morador (role === "MORADOR") deixa de ser exigido a ter bloco/unidade,
 * independentemente do valor ou ausência de `moraNoCondominio` no payload
 * — preservando 100% o comportamento hoje vigente para moradores.
 */
export function requiresResidentialUnit(pessoa: PessoaVinculoSnapshot): boolean {
  return pessoa.role === "MORADOR" || pessoa.moraNoCondominio === true;
}

/** A pessoa é um síndico profissional (não morador)? */
export function isProfessionalSyndic(pessoa: PessoaVinculoSnapshot): boolean {
  return pessoa.categoriaPessoa === "SINDICO_PROFISSIONAL";
}

/** A pessoa representa uma administradora terceirizada? */
export function isAdministrator(pessoa: PessoaVinculoSnapshot): boolean {
  return pessoa.categoriaPessoa === "ADMINISTRADORA";
}

/** A pessoa é funcionária do condomínio (zelador, porteiro, segurança etc.)? */
export function isEmployee(pessoa: PessoaVinculoSnapshot): boolean {
  return pessoa.categoriaPessoa === "FUNCIONARIO";
}
