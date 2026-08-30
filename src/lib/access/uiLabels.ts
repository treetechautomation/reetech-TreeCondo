/**
 * ACCESS.5 — MAPEAMENTOS DE UI (CLIENT-SAFE).
 *
 * CRÍTICO (ACCESS.5 §45): este arquivo NUNCA deve importar de
 * `@/lib/access/credential`, `@/lib/access/hmacKey`,
 * `@/lib/access/authorizationService`, `@/lib/access/pinIssuance`, nem
 * de qualquer outro módulo que toque `node:crypto` ou o Firebase Admin
 * SDK. Os enums abaixo são cópias locais deliberadas dos valores em
 * `@/lib/access/types` — não um `import type` daquele arquivo — para
 * eliminar completamente o risco de um import futuro nesse arquivo
 * arrastar uma dependência server-only para o bundle do cliente.
 */

export type AccessTypeUi = "VISITOR" | "SERVICE_PROVIDER" | "DELIVERY" | "FAMILY";

export const ACCESS_TYPE_LABELS: Record<AccessTypeUi, string> = {
  VISITOR: "Visitante",
  SERVICE_PROVIDER: "Prestador de serviço",
  DELIVERY: "Entrega",
  FAMILY: "Familiar",
};

export const ACCESS_TYPE_OPTIONS: { value: AccessTypeUi; label: string }[] = (
  Object.keys(ACCESS_TYPE_LABELS) as AccessTypeUi[]
).map((value) => ({ value, label: ACCESS_TYPE_LABELS[value] }));

export type EffectiveStatusUi = "AUTORIZADO" | "REVOGADO" | "EXPIRADO";

export const STATUS_LABELS: Record<EffectiveStatusUi, string> = {
  AUTORIZADO: "Autorizado",
  REVOGADO: "Revogado",
  EXPIRADO: "Expirado",
};

/** Tons já usados por `StatusBadge` no projeto (`success | warning | danger | info | neutral | accent`). */
export const STATUS_TONE: Record<EffectiveStatusUi, "success" | "danger" | "neutral"> = {
  AUTORIZADO: "success",
  REVOGADO: "danger",
  EXPIRADO: "neutral",
};
