/**
 * Mapeamento LEGADO → PartialPolicy (compartilhado pelos adapters admin/web).
 *
 * PARIDADE COM O SERVIDOR HOMOLOGADO (decisão registrada na D.2/D.3):
 *  - `autoAprovarAposHoras` e `exigirAprovacaoQuandoMenosQueHoras` SÃO mapeados
 *    (o servidor os lê em criar/route.ts:161-162);
 *  - `bloquearDomingo` NÃO é mapeado: o servidor SEMPRE bloqueia domingo
 *    (criar/route.ts:105 ignora a config) — "defeito oficial" preservado na v0;
 *  - `cancelamentoMinHoras` NÃO é mapeado: o servidor usa 48 fixo
 *    (cancelar/route.ts:185 ignora a config) — idem.
 *  Ambos passarão a ser honrados via política publicada (versão > 0) na D.6.
 *
 * Área/Opção: campos ad-hoc existentes (escopoReserva, blocosPermitidos,
 * capacidadeMax, preço) são lidos como fonte de política de área/opção durante
 * a transição (D.2 §9.6) — inclusive os criados pela migração C.1 congelada.
 */

import type { PartialPolicy } from "../types";
import { normBloco } from "@/lib/normalization/location";

function finite(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}


export function mapLegacyCondominioConfig(data: Record<string, unknown> | null): PartialPolicy | null {
  if (!data) return null;
  const booking: Record<string, number> = {};
  const auto = finite(data.autoAprovarAposHoras);
  const exigir = finite(data.exigirAprovacaoQuandoMenosQueHoras);
  if (auto !== undefined) booking.autoApproveAfterHours = auto;
  if (exigir !== undefined) booking.requireApprovalUnderHours = exigir;
  if (Object.keys(booking).length === 0) return null;
  return { booking } as PartialPolicy;
}

export function mapLegacyArea(area: Record<string, unknown> | null): PartialPolicy | null {
  if (!area) return null;
  const partial: Record<string, unknown> = {};

  // Política explícita futura (D.6) embutida no doc da área.
  const explicit = area.policy;
  if (explicit && typeof explicit === "object" && !Array.isArray(explicit)) {
    Object.assign(partial, explicit as Record<string, unknown>);
  }

  if (
    area.escopoReserva === "BLOCO" &&
    Array.isArray(area.blocosPermitidos) &&
    area.blocosPermitidos.length > 0
  ) {
    partial.eligibility = {
      ...(partial.eligibility as Record<string, unknown> | undefined),
      scope: "BLOCO",
      allowedBlocks: (area.blocosPermitidos as unknown[]).map(normBloco).filter(Boolean),
    };
  }

  const capacidade = finite(area.capacidadeMax);
  if (capacidade !== undefined) {
    partial.capacity = {
      ...(partial.capacity as Record<string, unknown> | undefined),
      maxPeople: capacidade,
    };
  }

  const preco = finite(area.precoCentavos ?? area.preco);
  if (preco !== undefined) {
    partial.financial = {
      ...(partial.financial as Record<string, unknown> | undefined),
      feeCentavos: preco,
    };
  }

  if (typeof area.diaInteiro === "boolean") {
    partial.schedule = {
      ...(partial.schedule as Record<string, unknown> | undefined),
      allDay: area.diaInteiro,
    };
  }

  return Object.keys(partial).length > 0 ? (partial as PartialPolicy) : null;
}

export function mapLegacyOpcao(
  area: Record<string, unknown> | null,
  opcaoId: string
): PartialPolicy | null {
  if (!opcaoId || opcaoId === "base") return null;
  const opcoes = Array.isArray(area?.opcoes) ? (area?.opcoes as Array<Record<string, unknown>>) : [];
  const opcao = opcoes.find((o) => String(o?.id ?? "") === opcaoId);
  if (!opcao) return null;

  const partial: Record<string, unknown> = {};

  const explicit = opcao.policy;
  if (explicit && typeof explicit === "object" && !Array.isArray(explicit)) {
    Object.assign(partial, explicit as Record<string, unknown>);
  }

  const preco = finite(opcao.precoCentavos ?? opcao.preco);
  if (preco !== undefined) {
    partial.financial = {
      ...(partial.financial as Record<string, unknown> | undefined),
      feeCentavos: preco,
    };
  }

  return Object.keys(partial).length > 0 ? (partial as PartialPolicy) : null;
}

export function mapMemberBlocoNorm(md: Record<string, unknown>): string | null {
  const norm = String(md.blocoIdNorm ?? "").trim() || normBloco(md.blocoId ?? md.bloco);
  return norm || null;
}

/** D.11.7: normaliza unidadeId para identidade canônica. */
export function mapMemberUnidadeNorm(md: Record<string, unknown>): string | null {
  const norm = String(md.unidadeIdNorm ?? "").trim() || String(md.unidadeId ?? md.unidade ?? "").trim();
  return norm || null;
}
