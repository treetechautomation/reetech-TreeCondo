import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { initializeFirebase } from "@/firebase";

export type RoleKey = "SINDICO" | "ADMIN" | "MORADOR" | "PORTEIRO" | "SUPER_ADMIN";

export type MenuKey =
  | "dashboard"
  | "condominios"
  | "cadastros"
  | "acesso"
  | "anuncios"
  | "reservas"
  | "incidentes"
  | "encomendas"
  | "documentos"
  | "enquetes"
  | "reunioes"
  | "configuracoes"
  | "administrador_global";

export type MenuPermissions = {
  SINDICO?: Partial<Record<MenuKey, boolean>>;
  ADMIN?: Partial<Record<MenuKey, boolean>>;
  MORADOR?: Partial<Record<MenuKey, boolean>>;
  PORTEIRO?: Partial<Record<MenuKey, boolean>>;
  SUPER_ADMIN?: Partial<Record<MenuKey, boolean>>;
};

export const MENU_LABELS: Record<MenuKey, string> = {
  dashboard: "Dashboard",
  condominios: "Condomínios",
  cadastros: "Cadastros",
  acesso: "Acesso",
  anuncios: "Anúncios",
  reservas: "Reservas",
  incidentes: "Incidentes",
  encomendas: "Encomendas",
  documentos: "Documentos",
  enquetes: "Enquetes",
  reunioes: "Reuniões",
  configuracoes: "Configurações",
  administrador_global: "Administrador Global",
};

/**
 * Defaults seguros (caso não exista doc ainda).
 * ADMIN normalmente é parecido com SINDICO (ajuste como quiser).
 */
export const DEFAULT_PERMS: MenuPermissions = {
  SINDICO: {
    dashboard: true,
    condominios: true,
    cadastros: true,
    acesso: true,
    anuncios: true,
    reservas: true,
    incidentes: true,
    encomendas: true,
    documentos: true,
    enquetes: true,
    reunioes: true,
    configuracoes: true,
    administrador_global: false,
  },
  ADMIN: {
    dashboard: true,
    condominios: true,
    cadastros: true,
    acesso: true,
    anuncios: true,
    reservas: true,
    incidentes: true,
    encomendas: true,
    documentos: true,
    enquetes: true,
    reunioes: true,
    configuracoes: true,
    administrador_global: false,
  },
  MORADOR: {
    dashboard: true,
    anuncios: true,
    reservas: true,
    incidentes: true,
    documentos: true,
    enquetes: true,
    reunioes: true,
    encomendas: false,
    condominios: false,
    cadastros: false,
    acesso: false,
    configuracoes: false,
    administrador_global: false,
  },
  PORTEIRO: {
    dashboard: true,
    incidentes: true,
    encomendas: true,
    acesso: true,
    anuncios: false,
    reservas: false,
    documentos: false,
    enquetes: false,
    reunioes: false,
    condominios: false,
    cadastros: false,
    configuracoes: false,
    administrador_global: false,
  },
};

export function menuPermissionsRef(condominioId: string) {
  const { firestore } = initializeFirebase();
  return doc(firestore, "condominios", condominioId, "config", "menuPermissions");
}

export async function fetchMenuPermissions(condominioId: string): Promise<MenuPermissions | null> {
  const ref = menuPermissionsRef(condominioId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return (snap.data() as MenuPermissions) ?? null;
}

export async function saveMenuPermissions(condominioId: string, perms: MenuPermissions) {
  const ref = menuPermissionsRef(condominioId);
  await setDoc(
    ref,
    {
      ...perms,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
