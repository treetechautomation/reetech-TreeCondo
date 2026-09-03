/**
 * ENCOMENDAS.2F — projeção segura de auditoria de uma encomenda.
 *
 * Lógica pura: recebe o documento canônico + eventos já lidos do
 * Firestore e devolve exatamente o subconjunto de campos permitido pela
 * Fase 16 do gate. Nunca inclui pinHash, qrTokenHash, pinAttempts,
 * pinLockedUntil, pinLast4, ou qualquer outro campo de credencial.
 */
import { SAFE_EVENT_METADATA_KEYS } from "./withdrawal";

export interface EncomendaAuditEventSafe {
  type: string;
  timestamp: string;
  actorUid: string | null;
  actorRole: string | null;
  actorName: string | null;
  metadata: Record<string, unknown>;
}

export interface EncomendaAuditProjection {
  encomendaId: string;
  condominioId: string;
  codigo: string | null;
  status: string | null;
  unidadeId: string | null;
  blocoId: string | null;
  criacao: {
    uid: string | null;
    nome: string | null;
    email: string | null;
    role: string | null;
    em: string | null;
  };
  retirada: {
    em: string | null;
    metodo: string | null;
    confirmadoPor: { uid: string | null; nome: string | null; email: string | null; role: string | null };
    recebedor: { nome: string | null; parentesco: string | null };
  } | null;
  eventos: EncomendaAuditEventSafe[];
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  const maybeTimestamp = value as { toDate?: () => Date };
  if (typeof maybeTimestamp.toDate === "function") {
    return maybeTimestamp.toDate().toISOString();
  }
  return null;
}

function sanitizeEventMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") return {};
  const src = metadata as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const key of SAFE_EVENT_METADATA_KEYS) {
    if (src[key] !== undefined) {
      safe[key] = src[key];
    }
  }
  return safe;
}

export function buildEncomendaAuditProjection(
  encomendaId: string,
  condominioId: string,
  data: Record<string, unknown>,
  events: Array<Record<string, unknown>>,
): EncomendaAuditProjection {
  const status = String(data?.status || "").toUpperCase() || null;

  return {
    encomendaId,
    condominioId,
    codigo: (data?.codigo as string) ?? null,
    status,
    unidadeId: (data?.unidadeId as string) ?? null,
    blocoId: (data?.blocoId as string) ?? null,
    criacao: {
      uid: (data?.registradoPorUid as string) ?? null,
      nome: (data?.registradoPorNome as string) ?? null,
      email: (data?.registradoPorEmail as string) ?? null,
      role: (data?.registradoPorRole as string) ?? null,
      em: toIso(data?.createdAt) ?? toIso(data?.chegouEm),
    },
    retirada:
      status === "RETIRADA"
        ? {
            em: toIso(data?.retiradaEm) ?? toIso(data?.retiradoEm),
            metodo: (data?.withdrawMethod as string) ?? null,
            confirmadoPor: {
              uid: (data?.retiradoPorUid as string) ?? null,
              nome: (data?.retiradoPorNome as string) ?? null,
              email: (data?.retiradoPorEmail as string) ?? null,
              role: (data?.retiradoPorRole as string) ?? null,
            },
            recebedor: {
              nome: (data?.retiradaRecebedorNome as string) ?? null,
              parentesco: (data?.retiradaRecebedorParentesco as string) ?? null,
            },
          }
        : null,
    eventos: events.map((e) => ({
      type: String(e?.type || ""),
      timestamp: String(e?.timestamp || ""),
      actorUid: (e?.actorUid as string) ?? null,
      actorRole: (e?.actorRole as string) ?? null,
      actorName: (e?.actorName as string) ?? null,
      metadata: sanitizeEventMetadata(e?.metadata),
    })),
  };
}
