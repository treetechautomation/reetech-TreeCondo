import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth } from "@/lib/firebaseAdmin";
import { ai } from "@/ai/genkit";
import { z } from "zod";

const RotuloOutput = z.object({
  unidadeId: z.string().nullable(),
  blocoId: z.string().nullable(),
  transportadora: z.string().nullable(),
  nfNumero: z.string().nullable(),
  destinatarioNome: z.string().nullable(),
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }

    const decoded = await adminAuth().verifyIdToken(token);
    if (!decoded) {
      return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const imageBase64 = body?.image; // data URL: data:image/jpeg;base64,...

    if (!imageBase64) {
      return NextResponse.json({ ok: false, error: "Imagem é obrigatória" }, { status: 400 });
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
            url: imageBase64,
          },
        },
      ],
      output: { schema: RotuloOutput },
    });

    return NextResponse.json({ ok: true, data: output });
  } catch (e: any) {
    console.error("[ler-rotulo] Erro ao processar rótulo com IA:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Erro interno ao processar imagem." },
      { status: 500 }
    );
  }
}
