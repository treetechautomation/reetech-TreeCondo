/**
 * ENCOMENDAS.2E — política de validação do QR opaco por encomenda.
 *
 * Lógica pura — zero dependência de Firestore/Next.js. O chamador
 * (retirar/qr/route.ts) já localiza o documento por qrTokenHash via query
 * ANTES de chegar aqui — um hash que não bate simplesmente não retorna
 * nenhum documento (falha fechada por construção, sem necessidade de
 * contagem de tentativas: o token é opaque/alta entropia, não um PIN
 * curto sujeito a força bruta).
 *
 * Extraído de retirar/qr/route.ts sem alterar comportamento, apenas para
 * torná-lo testável contra o emulador sem duplicar a decisão de negócio
 * (mesmo padrão adotado em packagePinPolicy.ts no ENCOMENDAS.2D).
 */
export type PackageQrOutcome =
  | { code: "SUCCESS" }
  | { code: "STATUS_INVALID" }
  | { code: "PACKAGE_ALREADY_WITHDRAWN" }
  | { code: "QR_EXPIRED" }
  | { code: "QR_ALREADY_USED" };

export interface PackageQrSnapshot {
  status?: string | null;
  qrExpiresAt?: string | null;
  qrUsed?: boolean | null;
}

const VALID_PENDING_STATUSES = new Set(["AGUARDANDO_RETIRADA", "AGUARDANDO", "PENDENTE"]);

/**
 * Avalia um documento JÁ localizado por qrTokenHash (match exato). Não
 * decide "hash inválido" — isso é responsabilidade da query do chamador.
 */
export function evaluatePackageQrAttempt(
  data: PackageQrSnapshot,
  now: Date = new Date(),
): PackageQrOutcome {
  const status = String(data.status || "").toUpperCase();

  if (status === "RETIRADA") {
    return { code: "PACKAGE_ALREADY_WITHDRAWN" };
  }
  if (!VALID_PENDING_STATUSES.has(status)) {
    return { code: "STATUS_INVALID" };
  }

  // Comparação feita contra o `now` injetado (não Date.now() interno) —
  // preserva o comportamento legado (ausência de qrExpiresAt não expira),
  // mas mantém a função pura/testável com um relógio determinístico.
  const expiresAt = data.qrExpiresAt ? String(data.qrExpiresAt) : null;
  if (expiresAt && new Date(expiresAt) < now) {
    return { code: "QR_EXPIRED" };
  }

  if (data.qrUsed === true) {
    return { code: "QR_ALREADY_USED" };
  }

  return { code: "SUCCESS" };
}
