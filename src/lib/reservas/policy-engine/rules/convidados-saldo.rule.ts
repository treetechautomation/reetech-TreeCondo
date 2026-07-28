/** FASE 16.18 / R6 — REGRA: SALDO_CONVIDADOS_EXCEDIDO (BLOCKER). */
import type { RuleEvaluator } from "../types";
import { fail, pass, skip } from "./_shared";

const CODE = "SALDO_CONVIDADOS_EXCEDIDO" as const;
const PRIORITY = "BLOCKER" as const;

export const saldoConvidadosRule: RuleEvaluator = (_policy, ctx) => {
  const c = _policy.policy.convidados;
  if (!c.habilitado) return skip(CODE, PRIORITY, "Sistema de convidados não habilitado.", null);
  if (!c.saldoMensalPorUnidade || c.saldoMensalPorUnidade <= 0) return skip(CODE, PRIORITY, "Saldo mensal não configurado.", null);
  return pass(CODE, PRIORITY, "Regra de saldo delegada ao helper transacional.", c.saldoMensalPorUnidade);
};
