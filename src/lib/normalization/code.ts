/**
 * F.2.7 — Normalização de códigos TC (convite).
 *
 * Unifica as 4 implementações anteriores de normalizeCode para TC-XXXXXXXX.
 */
export function normalizeInviteCode(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\u200B-\u200D\uFEFF]/g, "")
    .replace(/[‐-‒–—−]/g, "-")
    .replace(/^TC[‐-‒–—−]/, "TC-");
}

export const TC_CODE_REGEX = /^TC-[A-Z0-9]{8}$/;

export function isValidInviteCode(v: string): boolean {
  return TC_CODE_REGEX.test(v);
}
