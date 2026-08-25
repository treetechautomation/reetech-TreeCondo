/**
 * Funções canônicas de normalização de localização.
 *
 * Centraliza normUnidade e normBloco (anteriormente duplicados em 11+ arquivos).
 *
 * IMPLEMENTAÇÃO HOMOLOGADA — compatível com as versões anteriores.
 * NÃO ALTERE o algoritmo sem revisão dos consumidores.
 *
 * Sprint F.2.2 — UNIDADES CANÔNICAS
 */

export function normUnidade(v: unknown): string {
  const raw = String(v ?? "");
  if (raw.trim() === "") return "";
  const base = raw
    .toLowerCase()
    .replace(/\b(apto|apt|apartamento|unidade)\b/gi, "")
    .replace(/[^0-9a-z]/gi, "")
    .trim();
  return base.replace(/^0+/, "") || "0";
}

export function normBloco(v: unknown): string {
  return String(v ?? "").toLowerCase().trim();
}
