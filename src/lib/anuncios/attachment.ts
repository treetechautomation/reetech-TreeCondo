/**
 * FEATURE.ANUNCIOS.1 — Helpers de anexo de anúncio.
 *
 * Allowlist mínima e deliberada (não herdada de Documentos, que não impõe
 * nenhum limite server-side): anúncios são lidos por todos os moradores,
 * inclusive em dados móveis, então tipos leves + teto de tamanho protegem
 * o consumo de dados do morador. Imagens cobrem cartazes/fotos; PDF cobre
 * comunicados/documentos oficiais anexados.
 */

export const ATTACHMENT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10MB

export function isAllowedAttachmentType(contentType: string): boolean {
  return (ATTACHMENT_ALLOWED_TYPES as readonly string[]).includes(contentType);
}

/** Remove acentos/caracteres não seguros para path do Storage; preserva extensão. */
export function sanitizeFileName(name: string): string {
  const base = String(name || "arquivo")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
  return base || "arquivo";
}

/**
 * Path do Storage é sempre derivado no servidor a partir de condominioId +
 * anuncioId (autenticados/validados pelo apiGuard e pela existência do doc),
 * nunca fornecido pelo cliente. O segmento aleatório evita colidir com um
 * anexo anterior — permite "upload novo → persistência → delete antigo" sem
 * nunca sobrescrever o arquivo ativo antes de garantir o novo.
 */
export function buildAttachmentStoragePath(condominioId: string, anuncioId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  const unique = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `condominios/${condominioId}/anuncios/${anuncioId}/${unique}-${safeName}`;
}

export type AnuncioAttachment = {
  storagePath: string | null;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: unknown; // Firestore Timestamp
  removedAt: unknown | null; // Firestore Timestamp | null
};
