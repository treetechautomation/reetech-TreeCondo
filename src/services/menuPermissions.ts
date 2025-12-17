"use client";

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { initializeFirebase } from "@/firebase";

export type MenuRoleKey = "sindico" | "morador" | "porteiro";

/**
 * Mapa: moduleId -> { sindico, morador, porteiro }
 * Ex: roles.painel.sindico === true
 */
export type MenuPermissionsMap = Record<string, Record<MenuRoleKey, boolean>>;

export type MenuPermissionsDoc = {
  roles: MenuPermissionsMap;
  updatedAt?: any;
};

/**
 * Normaliza qualquer coisa que venha da UI para um formato 100% compatível com Firestore:
 * - aceita Array (ex.: defaultModules da tela) ou Object (map)
 * - remove qualquer campo não-boolean
 * - nunca retorna undefined
 */
export function normalizeMenuPermissions(input: any): MenuPermissionsMap {
  const roleKeys: MenuRoleKey[] = ["sindico", "morador", "porteiro"];

  // Caso 1: a tela manda um array de módulos [{id, roles:{...}, icon, name...}]
  if (Array.isArray(input)) {
    const out: MenuPermissionsMap = {};
    for (const m of input) {
      const id = String(m?.id ?? "").trim();
      if (!id) continue;

      const rolesObj = m?.roles ?? {};
      out[id] = {
        sindico: roleKeys.includes("sindico") ? rolesObj?.sindico === true : false,
        morador: roleKeys.includes("morador") ? rolesObj?.morador === true : false,
        porteiro: roleKeys.includes("porteiro") ? rolesObj?.porteiro === true : false,
      };
    }
    return out;
  }

  // Caso 2: a tela manda um map { [moduleId]: { sindico, morador, porteiro } }
  if (input && typeof input === "object") {
    const out: MenuPermissionsMap = {};
    for (const [moduleId, rolesObj] of Object.entries(input)) {
      const id = String(moduleId ?? "").trim();
      if (!id) continue;

      const r: any = rolesObj ?? {};
      out[id] = {
        sindico: r?.sindico === true,
        morador: r?.morador === true,
        porteiro: r?.porteiro === true,
      };
    }
    return out;
  }

  // Fallback
  return {};
}

function getMenuPermissionsRef(condominioId: string) {
  const { firestore } = initializeFirebase();
  return doc(firestore, `condominios/${condominioId}/config/menuPermissions`);
}

export async function fetchMenuPermissions(condominioId: string): Promise<MenuPermissionsDoc | null> {
  const ref = getMenuPermissionsRef(condominioId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() as any;
  const roles = normalizeMenuPermissions(data?.roles);
  return { roles, updatedAt: data?.updatedAt };
}

/**
 * Salva permissões já normalizadas.
 * IMPORTANTE: passamos roles como MAP de booleans. Sem undefined, sem icon, sem funções.
 */
export async function saveMenuPermissions(params: {
  condominioId: string;
  roles: any; // vem da tela em qualquer formato (array ou map)
}) {
  const { condominioId, roles } = params;
  if (!condominioId) throw new Error("condominioId é obrigatório");

  const normalized = normalizeMenuPermissions(roles);

  // Garantia extra: Firestore não aceita undefined
  // (aqui já não deve ter, mas deixamos blindado)
  for (const [moduleId, roleMap] of Object.entries(normalized)) {
    normalized[moduleId] = {
      sindico: roleMap?.sindico === true,
      morador: roleMap?.morador === true,
      porteiro: roleMap?.porteiro === true,
    };
  }

  const ref = getMenuPermissionsRef(condominioId);
  await setDoc(
    ref,
    {
      roles: normalized,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true, roles: normalized };
}

/**
 * Helper para a UI: verifica se um perfil pode ver um módulo
 */
export function canSeeModule(roles: MenuPermissionsMap | null | undefined, moduleId: string, role: MenuRoleKey) {
  if (!roles) return false;
  return roles?.[moduleId]?.[role] === true;
}
