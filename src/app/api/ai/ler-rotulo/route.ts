import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { ai } from "@/ai/genkit";
import { z } from "zod";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import {
  AI_LABEL_ALLOWED_ROLES,
  validateImagePayload,
  sanitizeAiOutput,
} from "@/lib/encomendas/aiLabelIntake";
import { logEncomendaEvent, extractCorrelationId } from "@/lib/encomendas/logger";

const RotuloOutput = z.object({
  unidadeId: z.string().nullable(),
  blocoId: z.string().nullable(),
  transportadora: z.string().nullable(),
  nfNumero: z.string().nullable(),
  destinatarioNome: z.string().nullable(),
});

export async function POST(req: Request) {
  const correlationId = extractCorrelationId(req);
  const startedAt = Date.now();
  let condominioId: string | null = null;
  let actorUid: string | null = null;
  let actorRole: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    condominioId = typeof body?.condominioId === "string" ? body.condominioId.trim() : "";

    if (!condominioId) {
      return jsonError("condominioId é obrigatório", 400);
    }

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: AI_LABEL_ALLOWED_ROLES,
      rateLimit: { limit: 10, windowSec: 60 },
    });
    actorUid = ctx.uid;
    actorRole = ctx.role;

    const imageValidation = validateImagePayload(body?.image);
    if (!imageValidation.ok) {
      return jsonError(imageValidation.error, 400);
    }

    const { output } = await ai.generate({
      model: "googleai/gemini-2.5-flash",
      prompt: [
        {
          text: `Você é um assistente de portaria inteligente de condomínio. Analise a foto do rótulo da encomenda abaixo e extraia com precisão:
1. unidadeId: Número do apartamento/unidade/lote (ex: "101", "205", "12"). Apenas o número limpo.
2. blocoId: Identificação do bloco/torre se houver (ex: "A", "B", "Torre 1").
3. transportadora: Empresa que está entregando (ex: "Mercado Livre", "Correios", "Amazon", "FedEx", "DHL", "Loggi", "Total Express").
4. nfNumero: Número da nota fiscal ou Danfe se estiver visível (apenas números).
5. destinatarioNome: Nome completo do morador/destinatário conforme impresso na etiqueta.

Retorne null para os campos não identificados com clareza.`,
        },
        {
          media: {
            url: body.image,
          },
        },
      ],
      output: { schema: RotuloOutput },
    });

    const safeOutput = sanitizeAiOutput(output);

    logEncomendaEvent({
      event: "PACKAGE_OCR_SUCCESS",
      timestamp: new Date().toISOString(),
      operation: "ai_ler_rotulo",
      result: "success",
      condominioId,
      actorUid,
      actorRole,
      correlationId,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: true, data: safeOutput });
  } catch (e: any) {
    if (e instanceof Response) return e;

    logEncomendaEvent({
      event: "PACKAGE_OCR_FAILED",
      timestamp: new Date().toISOString(),
      operation: "ai_ler_rotulo",
      result: "error",
      condominioId,
      actorUid,
      actorRole,
      correlationId,
      durationMs: Date.now() - startedAt,
      errorCode: "OCR_EXCEPTION",
      errorMessage: e?.message ? String(e.message).slice(0, 300) : "unknown",
    });

    console.error("[ler-rotulo] Erro ao processar rótulo com IA:", e);
    return jsonError(e?.message || "Erro interno ao processar imagem.", 500);
  }
}
