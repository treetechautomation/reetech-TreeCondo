/**
 * FASE 16.4 / 16.5.2 — REGRA: CAMPO_FORA_HORARIO (VALIDATION).
 *
 * Domínio: USO_CAMPO (não RESERVA_PRIVATIVA).
 * Fonte: policy.campo (nunca policy.schedule).
 *
 * Aplica-se exclusivamente à ação CAMPO_REGISTRAR.
 *
 * O PolicyContext deve conter campoInicioMin e campoFimMin
 * (minutos desde meia-noite, 0–1440) representando o intervalo
 * solicitado pelo morador.
 *
 * Semântica:
 *   1. Se horaInicio e horaFim são null → SKIP (sem restrição configurada).
 *   2. Se policy configurada mas campoInicioMin/campoFimMin ausentes → FAIL (inválido).
 *   3. Se campoInicioMin >= campoFimMin → FAIL (intervalo inválido).
 *   4. Converte policy (horas) para minutos e determina horaFimEfetiva.
 *   5. Se campoInicioMin < inicioPermitidoMin → FAIL (antes da abertura).
 *   6. Se campoFimMin > fimPermitidoMin → FAIL (após o fechamento).
 *      NOTA: campoFimMin == fimPermitidoMin é PERMITIDO (ex: 22:00 é fim válido).
 *   7. Senão → PASS.
 */

import type { RuleEvaluator } from "../types";
import { fail, pass, skip } from "./_shared";

const CODE = "CAMPO_FORA_HORARIO" as const;
const PRIORITY = "VALIDATION" as const;

export const campoForaHorarioRule: RuleEvaluator = (_policy, ctx) => {
  const c = _policy.policy.campo;

  // Sem restrição de horário configurada → não aplicar
  if (c.horaInicio == null && c.horaFim == null) {
    return skip(CODE, PRIORITY, "Campo sem restrição de horário configurada.", null);
  }

  // Policy configurada — intervalo solicitado é obrigatório
  if (ctx.campoInicioMin == null || ctx.campoFimMin == null) {
    return fail(CODE, PRIORITY, "Intervalo solicitado ausente para validação de horário do Campo.", c, {
      campoInicioMin: ctx.campoInicioMin ?? null,
      campoFimMin: ctx.campoFimMin ?? null,
    });
  }

  // Intervalo inválido (início >= fim ou mesma hora)
  if (ctx.campoInicioMin >= ctx.campoFimMin) {
    return fail(CODE, PRIORITY, "Horário de início deve ser anterior ao horário de fim.", c, {
      campoInicioMin: ctx.campoInicioMin,
      campoFimMin: ctx.campoFimMin,
    });
  }

  const horaFimEfetiva =
    (c.excecaoHorarioEstendido.habilitada && c.excecaoHorarioEstendido.horaFim != null)
      ? c.excecaoHorarioEstendido.horaFim
      : c.horaFim;

  // Converter policy (horas) para minutos
  const inicioPermitidoMin = (c.horaInicio as number) * 60;
  const fimPermitidoMin = (horaFimEfetiva as number) * 60;

  if (ctx.campoInicioMin < inicioPermitidoMin) {
    return fail(CODE, PRIORITY, `Campo indisponível antes das ${c.horaInicio}h.`, c, {
      campoInicioMin: ctx.campoInicioMin,
      inicioPermitidoMin,
      campoFimMin: ctx.campoFimMin,
      fimPermitidoMin,
      excecaoAtiva: c.excecaoHorarioEstendido.habilitada,
    });
  }

  if (ctx.campoFimMin > fimPermitidoMin) {
    return fail(CODE, PRIORITY, `Campo indisponível após as ${horaFimEfetiva}h.`, c, {
      campoInicioMin: ctx.campoInicioMin,
      inicioPermitidoMin,
      campoFimMin: ctx.campoFimMin,
      fimPermitidoMin,
      excecaoAtiva: c.excecaoHorarioEstendido.habilitada,
    });
  }

  return pass(CODE, PRIORITY, "Dentro do horário de funcionamento do Campo.", c);
};
