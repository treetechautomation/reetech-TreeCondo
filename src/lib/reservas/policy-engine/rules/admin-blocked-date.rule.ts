/**
 * D.11.5 — REGRA: DATA_BLOQUEADA_ADMIN (BLOCKER).
 *
 * Art. 36: datas bloqueadas pelo administrador (blackouts custom).
 * SKIPa se a lista custom estiver vazia — retrocompatível.
 * Já suportado pelo compilador via holidays.custom; esta regra expõe
 * o bloqueio como RuleCode dedicado para explain() e auditoria.
 */

import type { RuleEvaluator } from "../types";
import { fail, monthDayOf, pass, skip } from "./_shared";

const CODE = "DATA_BLOQUEADA_ADMIN" as const;
const PRIORITY = "BLOCKER" as const;

export const adminBlockedDateRule: RuleEvaluator = (_policy, ctx) => {
  const custom = _policy.policy.holidays.custom;
  if (!custom || custom.length === 0) {
    return skip(CODE, PRIORITY, "Nenhuma data administrativa bloqueada.", null);
  }

  const mmdd = monthDayOf(ctx.dateStr);
  const full = ctx.dateStr;
  const blocked = custom.find(
    (c) => c.mode === "BLOCK" && (c.date === full || c.date === mmdd),
  );

  if (blocked) {
    return fail(CODE, PRIORITY, `Data bloqueada pela administração: ${blocked.label || blocked.date}.`, blocked.date, {
      label: blocked.label,
      mode: blocked.mode,
    });
  }
  return pass(CODE, PRIORITY, "Data não está na lista de bloqueios administrativos.", null);
};
