/**
 * F.2.7 — Normalização de texto (NFD accent stripping).
 *
 * Unifica as 5 implementações anteriores de norm / normalizeKey / normalizeText.
 */
export function normNFD(v: unknown): string {
  return (String(v ?? ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
