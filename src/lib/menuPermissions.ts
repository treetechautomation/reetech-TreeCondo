import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { initializeFirebase } from "@/firebase";

export type RoleKey = "SINDICO" | "ADMIN" | "ADMIN_CONDOMINIO" | "MORADOR" | "PORTEIRO" | "ZELADOR" | "SUPER_ADMIN";

export type MenuKey =
  | "dashboard"
  | "condominios"
  | "cadastros"
  | "acesso"
  | "anuncios"
  | "reservas"
      | "reservas_gestao"
      | "reservas_agenda"
    | "reservas_checkin"
    | "reservas_solicitacoes"
  | "incidentes"
  | "encomendas"
  | "documentos"
  | "enquetes"
  | "reunioes"
  | "manutencao_preventiva"
  | "configuracoes"
  | "administrador_global";

export type MenuPermissions = Partial<Record<RoleKey, Partial<Record<MenuKey, boolean>>>>;//__TC_MENU_PERMS_RECORD__

export const MENU_LABELS: Record<MenuKey, string> = {
  dashboard: "Dashboard",
  condominios: "Condomínios",
  cadastros: "Cadastros",
  acesso: "Acesso",
  anuncios: "Anúncios",
  reservas: "Reservas",
      reservas_gestao: "Gestão de Reservas",
    reservas_agenda: "Agenda de Reservas",
    reservas_checkin: "Check-in de Reserva",
    reservas_solicitacoes: "Solicitações de Reservas",
  incidentes: "Incidentes",
  encomendas: "Encomendas",
  documentos: "Documentos",
  enquetes: "Enquetes",
  reunioes: "Reuniões",
  manutencao_preventiva: "Manutenção Preventiva",
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
      reservas_checkin: true,
      reservas_solicitacoes: true,
      reservas_agenda: true,
    incidentes: true,
    encomendas: true,
    documentos: true,
    enquetes: true,
    reunioes: true,
    manutencao_preventiva: true,
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
      reservas_checkin: true,
      reservas_solicitacoes: true,
      reservas_agenda: true,
    incidentes: true,
    encomendas: true,
    documentos: true,
    enquetes: true,
    reunioes: true,
    manutencao_preventiva: true,
    configuracoes: true,
    administrador_global: false,
  },
  ADMIN_CONDOMINIO: {
    dashboard: true,
    condominios: false,
    cadastros: true,
    acesso: true,
    anuncios: true,
    reservas: true,
      reservas_checkin: true,
      reservas_solicitacoes: true,
      reservas_agenda: true,
    incidentes: true,
    encomendas: true,
    documentos: true,
    enquetes: true,
    reunioes: true,
    manutencao_preventiva: true,
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
    manutencao_preventiva: true,
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
      reservas_checkin: true,
      reservas_agenda: true,
    documentos: false,
    enquetes: false,
    reunioes: false,
    condominios: false,
    cadastros: false,
    manutencao_preventiva: true,
    configuracoes: false,
    administrador_global: false,
  },
      ZELADOR: {
    dashboard: true,
    incidentes: true,
    encomendas: true,
    acesso: true,
    anuncios: true,
    reservas: true,
      reservas_checkin: true,
      reservas_agenda: true,
      reservas_solicitacoes: true,
    documentos: false,
    enquetes: false,
    reunioes: false,
    condominios: false,
    cadastros: false,
    manutencao_preventiva: true,
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
