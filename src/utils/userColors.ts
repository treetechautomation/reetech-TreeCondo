/**
 * TreeCondo — cores consistentes por usuário
 * nunca quebra, nunca gera cor inválida
 */

export const USER_COLORS = [
  "#C8BFE7",
  "#7092BE",
  "#99D9EA",
  "#B5E61D",
  "#EFE4B0",
  "#FFC90E",
  "#FFAEC9",
  "#B97A57",
  "#F5A173",
  "#FF7F27",
  "#00A2E8",
  "#C3C3C3",
];

/**
 * hash estável baseado no nome
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * retorna cor consistente
 */
export function getUserColor(name?: string): string {
  if (!name) return "#C3C3C3";
  const idx = hashString(name) % USER_COLORS.length;
  return USER_COLORS[idx];
}

/**
 * retorna iniciais
 */
export function getUserInitials(name?: string): string {
  if (!name) return "?";

  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}
