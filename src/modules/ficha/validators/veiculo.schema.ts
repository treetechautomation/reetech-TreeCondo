import { z } from "zod";

export const VeiculoSchema = z.object({
  marca: z.string().trim().min(1, "Marca obrigatória"),
  modelo: z.string().trim().min(1, "Modelo obrigatório"),
  cor: z.string().trim().min(1, "Cor obrigatória"),
  ano: z.coerce.number().int().min(1900, "Ano inválido").max(2100, "Ano inválido"),
  placa: z.string().trim().min(1, "Placa obrigatória"),
  tagNumero: z
    .string()
    .trim()
    .min(1, "TAG obrigatória")
    .transform((v) => v.trim().toUpperCase()),
});

export type VeiculoInput = z.infer<typeof VeiculoSchema>;
