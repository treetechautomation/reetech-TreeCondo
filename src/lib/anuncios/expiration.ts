/**
 * FEATURE.ANUNCIOS.1 — Helpers de expiração de anúncio.
 *
 * `expiresAt`/`publishAt` no schema atual de anúncios são gravados de forma
 * inconsistente historicamente (string ISO crua do cliente em alguns
 * caminhos, Firestore Timestamp esperado em outros — ver GATE
 * FEATURE.ANUNCIOS.1). `readDateFlexible` tolera ambas as formas na leitura;
 * a escrita feita por este gate sempre grava Timestamp (ver route.ts).
 */

const REQUIRES_EXPIRATION_STATUSES = new Set(["PUBLICADO", "AGENDADO"]);

export function requiresExpiresAt(status: string): boolean {
  return REQUIRES_EXPIRATION_STATUSES.has(String(status || "").toUpperCase());
}

/** Aceita Firestore Timestamp, `{_seconds}` (JSON serializado), Date ou string ISO. */
export function readDateFlexible(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const anyV = v as any;
  if (typeof anyV?.toDate === "function") {
    try { return anyV.toDate(); } catch { return null; }
  }
  if (typeof anyV?._seconds === "number") {
    return new Date(anyV._seconds * 1000);
  }
  const d = new Date(anyV);
  return isNaN(d.getTime()) ? null : d;
}
