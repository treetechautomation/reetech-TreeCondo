import type { GuardRole } from "@/lib/apiGuard";

/**
 * ENCOMENDAS.2C — contrato de autorização e validação da rota de IA de
 * leitura de rótulo (/api/ai/ler-rotulo).
 *
 * Papéis operacionais de portaria/gestão do condomínio. MORADOR é
 * explicitamente excluído (não deve iniciar leitura de rótulo de outra
 * unidade). SUPER_ADMIN passa pelo bypass já existente em apiGuard.
 */
export const AI_LABEL_ALLOWED_ROLES: GuardRole[] = [
  "PORTEIRO",
  "ZELADOR",
  "ADMIN",
  "ADMIN_CONDOMINIO",
  "SINDICO",
];

/**
 * Teto de tamanho da imagem (bytes, decodificados de base64).
 *
 * Reaproveita o mesmo teto já estabelecido para anexos de imagem no
 * restante do app (ATTACHMENT_MAX_BYTES em src/lib/anuncios/attachment.ts
 * = 10MB), em vez de inventar um novo número. A captura do rótulo não
 * aplica nenhuma compressão client-side (FileReader.readAsDataURL puro),
 * então o teto precisa acomodar fotos de câmera não comprimidas.
 */
export const AI_LABEL_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const DATA_URL_RE = /^data:(image\/(?:jpeg|jpg|png|webp|heic|heif));base64,([A-Za-z0-9+/]+=?=?)$/i;

export type ImageValidationResult =
  | { ok: true; mimeType: string; byteLength: number }
  | { ok: false; error: string };

/**
 * Valida o payload de imagem recebido no body (`data:<mime>;base64,<...>`).
 * Não decodifica/persiste a imagem — apenas mede o tamanho decodificado
 * para aplicar o teto, e confirma o tipo declarado é um formato aceito.
 */
export function validateImagePayload(imageBase64: unknown): ImageValidationResult {
  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    return { ok: false, error: "Imagem é obrigatória" };
  }

  const match = DATA_URL_RE.exec(imageBase64);
  if (!match) {
    return { ok: false, error: "Formato de imagem inválido. Envie JPEG, PNG, WEBP ou HEIC." };
  }

  const [, mimeType, b64] = match;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const byteLength = Math.floor((b64.length * 3) / 4) - padding;

  if (byteLength <= 0) {
    return { ok: false, error: "Formato de imagem inválido. Envie JPEG, PNG, WEBP ou HEIC." };
  }

  if (byteLength > AI_LABEL_MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Imagem excede o tamanho máximo de ${Math.floor(AI_LABEL_MAX_IMAGE_BYTES / (1024 * 1024))}MB.`,
    };
  }

  return { ok: true, mimeType, byteLength };
}

export interface RotuloOutputSafe {
  unidadeId: string | null;
  blocoId: string | null;
  transportadora: string | null;
  nfNumero: string | null;
  destinatarioNome: string | null;
}

const ROTULO_FIELDS: (keyof RotuloOutputSafe)[] = [
  "unidadeId",
  "blocoId",
  "transportadora",
  "nfNumero",
  "destinatarioNome",
];

/**
 * Revalida a saída da IA contra a allowlist de campos conhecida,
 * descartando qualquer campo inesperado e normalizando valores que não
 * sejam string para null.
 */
export function sanitizeAiOutput(raw: unknown): RotuloOutputSafe {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = {} as RotuloOutputSafe;
  for (const field of ROTULO_FIELDS) {
    const v = src[field];
    out[field] = typeof v === "string" && v.trim().length > 0 ? v : null;
  }
  return out;
}
