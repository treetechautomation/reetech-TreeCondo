import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { initializeFirebase } from "@/firebase";

export type RoleKey = "SINDICO" | "ADMIN" | "ADMIN_CONDOMINIO" | "MORADOR" | "PORTEIRO" | "ZELADOR" | "SUPER_ADMIN";

export const VALID_ROLES: RoleKey[] = [
  "SINDICO",
  "ADMIN",
  "ADMIN_CONDOMINIO",
  "MORADOR",
  "PORTEIRO",
  "ZELADOR",
  "SUPER_ADMIN",
];

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export type MenuKey =
  | "dashboard"
  | "portaria"
  | "condominios"
  | "cadastros"
  | "blocos"
  | "unidades"
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
  | "administrador_global"
  | "treemidia"
  | "meus_dados"
  | "comunidade"
  | "financeiro"
  | "whatsapp_logs";

export type MenuPermissions = Partial<Record<RoleKey, Partial<Record<MenuKey, boolean>>>>;//__TC_MENU_PERMS_RECORD__

export const MENU_LABELS: Record<MenuKey, string> = {
  dashboard: "Dashboard",
  portaria: "Painel da Portaria",
  condominios: "Condomínios",
  cadastros: "Cadastros",
  blocos: "Blocos",
  unidades: "Unidades",
  acesso: "Acesso",
  anuncios: "Anúncios",
  reservas: "Reservas",
      reservas_gestao: "Gestão de Áreas e Reservas",
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
  treemidia: "TreeMídia",
  meus_dados: "Meus Dados",
  comunidade: "Comunidade",
  financeiro: "Financeiro",
  whatsapp_logs: "Notificações WhatsApp",
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
    blocos: true,
    unidades: true,
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
    treemidia: true,
    meus_dados: true,
    comunidade: true,
    financeiro: true,
    whatsapp_logs: true,
  },
  ADMIN: {
    dashboard: true,
    condominios: true,
    cadastros: true,
    blocos: true,
    unidades: true,
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
    treemidia: true,
    meus_dados: true,
    comunidade: true,
    financeiro: true,
    whatsapp_logs: true,
  },
  ADMIN_CONDOMINIO: {
    dashboard: true,
    condominios: false,
    cadastros: true,
    blocos: true,
    unidades: true,
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
    treemidia: true,
    meus_dados: true,
    comunidade: true,
    financeiro: true,
    whatsapp_logs: true,
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
    blocos: true,
    unidades: true,
    acesso: true,
    manutencao_preventiva: true,
    configuracoes: false,
    administrador_global: false,
    treemidia: false,
    meus_dados: true,
    comunidade: true,
    financeiro: false,
  },
  PORTEIRO: {
    dashboard: false,
    portaria: true,
    incidentes: true,
    encomendas: true,
    acesso: true,
    blocos: true,
    unidades: true,
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
    treemidia: false,
    meus_dados: true,
    comunidade: false,
    financeiro: false,
  },
      ZELADOR: {
    dashboard: true,
    portaria: false,
    incidentes: true,
    encomendas: true,
    acesso: true,
    blocos: true,
    unidades: true,
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
    treemidia: false,
    meus_dados: true,
    comunidade: true,
    financeiro: false,
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

  // Payload sanitizado: apenas RoleKey válidos e apenas valores booleanos.
  // Sem spread cego do objeto original (evita persistir campos corrompidos
  // como `source`). Preserva `false` e `true` explicitamente.
  const clean: MenuPermissions = {};
  for (const role of VALID_ROLES) {
    const roleMap = perms?.[role];
    if (!isPlainObject(roleMap)) continue;

    const out: Partial<Record<MenuKey, boolean>> = {};
    for (const [key, value] of Object.entries(roleMap)) {
      if (typeof value === "boolean") out[key as MenuKey] = value;
    }
    clean[role] = out;
  }

  await setDoc(
    ref,
    {
      ...clean,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
