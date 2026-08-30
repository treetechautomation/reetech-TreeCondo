/**
 * ACCESS.5B §17 — mapeamento de códigos de erro da API para copy amigável.
 * Nunca expor códigos técnicos ao usuário final.
 */

export function mapCreateError(err: { code?: string; message?: string } | null | undefined): { title: string; description: string } {
  if (err?.code === "NO_ACTIVE_UNIT") {
    return { title: "Nenhuma unidade vinculada", description: "Não encontramos uma unidade vinculada ao seu acesso." };
  }
  if (err?.code === "INVALID_UNIT") {
    return { title: "Unidade indisponível", description: "Sua unidade selecionada não está mais disponível. Atualize e tente novamente." };
  }
  return { title: "Não foi possível autorizar o acesso", description: String(err?.message || "Tente novamente.") };
}
