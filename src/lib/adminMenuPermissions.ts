"use client";

import { fetchMenuPermissions, saveMenuPermissions, MenuPermissions } from "@/lib/menuPermissions";

export type { MenuPermissions };

export async function getMenuPermissions(condominioId: string): Promise<MenuPermissions | null> {
  return fetchMenuPermissions(condominioId);
}

export async function persistMenuPermissions(condominioId: string, permissions: MenuPermissions) {
  return saveMenuPermissions(condominioId, permissions);
}
