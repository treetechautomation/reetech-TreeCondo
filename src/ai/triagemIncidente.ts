/**
 * Genkit Flow — Triagem de Incidentes com IA
 * Analisa título + descrição e retorna: categoria, urgência e encaminhamento sugerido.
 */
import { ai } from "@/ai/genkit";
import { z } from "zod";

const TriagemInput = z.object({
  titulo: z.string(),
  descricao: z.string(),
});

const TriagemOutput = z.object({
  categoria: z.enum([
    "INFRAESTRUTURA",
    "SEGURANCA",
    "LIMPEZA",
    "BARULHO",
    "EQUIPAMENTO",
    "ANIMAL",
    "CONVIVENCIA",
    "OUTRO",
  ]),
  urgencia: z.enum(["BAIXA", "MEDIA", "ALTA", "CRITICA"]),
  encaminhamento: z.string(),
  resumo: z.string(),
  tags: z.array(z.string()),
});

export type TriagemIncidente = z.infer<typeof TriagemOutput>;

export const triagemIncidenteFlow = ai.defineFlow(
  {
    name: "triagemIncidente",
    inputSchema: TriagemInput,
    outputSchema: TriagemOutput,
  },
  async (input) => {
    const { output } = await ai.generate({
      model: "googleai/gemini-2.0-flash",
      prompt: `Você é um assistente de gestão de condomínios. Analise o incidente abaixo e retorne uma triagem estruturada.

Título: ${input.titulo}
Descrição: ${input.descricao}

Retorne um JSON com:
- categoria: uma de [INFRAESTRUTURA, SEGURANCA, LIMPEZA, BARULHO, EQUIPAMENTO, ANIMAL, CONVIVENCIA, OUTRO]
- urgencia: uma de [BAIXA, MEDIA, ALTA, CRITICA]
  - CRITICA: risco imediato à vida ou segurança (vazamento de gás, incêndio, invasão)
  - ALTA: afeta moradores imediatamente (elevador quebrado, sem água, enchente)
  - MEDIA: problema importante mas sem risco imediato
  - BAIXA: reclamação ou sugestão de melhoria
- encaminhamento: quem deve resolver (ex: "Equipe de manutenção", "Síndico", "Portaria", "Zelador")
- resumo: resumo de 1 frase do problema em linguagem técnica
- tags: array de até 3 palavras-chave relevantes

Responda APENAS com o JSON válido, sem markdown.`,
      output: { schema: TriagemOutput },
    });

    return output!;
  }
);

/**
 * Função auxiliar para uso nas API routes (server-side).
 * Retorna null em caso de falha para não interromper o fluxo principal.
 */
export async function triarIncidente(params: {
  titulo: string;
  descricao: string;
}): Promise<TriagemIncidente | null> {
  try {
    const result = await triagemIncidenteFlow(params);
    return result;
  } catch (e) {
    console.warn("[AI] Triagem de incidente falhou (não crítico):", String(e));
    return null;
  }
}
