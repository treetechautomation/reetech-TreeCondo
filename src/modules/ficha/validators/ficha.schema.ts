import { z } from "zod";

const isoDateNullable = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD")
  .nullable()
  .optional();

const textNullable = z.string().min(1).max(120).nullable().optional();
const phoneNullable = z.string().min(6).max(20).nullable().optional();

export const DependenteSchema = z.object({
  nome: z.string().min(2).max(120),
  nascimento: isoDateNullable,
});

export const MoradorFixoSchema = z.object({
  nome: z.string().min(2).max(120),
  nascimento: isoDateNullable,
});

export const MoradorTemporarioSchema = z.object({
  nome: z.string().min(2).max(120),
  rgOuCpf: z.string().min(3).max(30).nullable().optional(),
  dataInicio: isoDateNullable,
  dataFim: isoDateNullable,
  qrCodeToken: z.string().nullable().optional(),
});

export const EmpregadoSchema = z.object({
  nome: z.string().min(2).max(120),
  funcao: z.string().min(1).max(80).nullable().optional(),
  rg: z.string().min(3).max(30).nullable().optional(),
});

export const FichaMoradorSchema = z.object({
  perfil: z.object({
    nome: z.string().min(2).max(120),
    nascimento: isoDateNullable,
    telefones: z.object({
      fixo: phoneNullable,
      celular1: phoneNullable,
      celular2: phoneNullable,
    }),
    email: z.string().email().nullable().optional(),
    tipoMoradia: z.enum(["CONDOMINO", "INQUILINO"]),
    bloco: textNullable,
    unidade: textNullable,
  }),

  filiacao: z.object({
    pai: textNullable,
    mae: textNullable,
  }),

  conjuge: z.object({
    nome: textNullable,
    nascimento: isoDateNullable,
    pai: textNullable,
    mae: textNullable,
  }),

  dependentes: z.array(DependenteSchema).default([]),
  moradoresFixos: z.array(MoradorFixoSchema).default([]),
  moradoresTemporarios: z.array(MoradorTemporarioSchema).default([]),
  empregados: z.array(EmpregadoSchema).default([]),

  animais: z.object({
    possui: z.boolean().default(false),
    descricao: z.string().max(200).nullable().optional(),
  }),

  documentosEntregues: z.object({
    entregueEm: isoDateNullable,
    entreguePor: z.string().max(120).nullable().optional(),
  }),
});

export type FichaMorador = z.infer<typeof FichaMoradorSchema>;

export const emptyFicha = (): FichaMorador => ({
  perfil: {
    nome: "",
    nascimento: null,
    telefones: { fixo: null, celular1: null, celular2: null },
    email: null,
    tipoMoradia: "CONDOMINO",
    bloco: null,
    unidade: null,
  },
  filiacao: { pai: null, mae: null },
  conjuge: { nome: null, nascimento: null, pai: null, mae: null },
  dependentes: [],
  moradoresFixos: [],
  moradoresTemporarios: [],
  empregados: [],
  animais: { possui: false, descricao: null },
  documentosEntregues: { entregueEm: null, entreguePor: null },
});
