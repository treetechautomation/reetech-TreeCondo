export function normEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function maskForLog(v: string): string {
  if (v.length <= 4) return "***";
  return v.substring(0, 2) + "***" + v.slice(-1);
}

export function sanitizeOnboardingLog(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "email" || key === "emailNorm" || key === "nome" || key === "unidadeNumero") continue;
    if (key === "uid" || key === "claimedByUid" || key === "personId") {
      out[key] = typeof value === "string" ? maskForLog(value) : value;
    } else {
      out[key] = value;
    }
  }
  return out;
}
