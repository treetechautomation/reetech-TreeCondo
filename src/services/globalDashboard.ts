import { initializeFirebase } from "@/firebase";

export type GlobalDashboardData = {
  totalCondominios: number;
  totalUsuarios: number;
  totalMembros: number;
  totalAnunciosAtivos: number;
  totalIncidentesAbertos: number;
  totalEncomendasPendentes: number;
};

export async function fetchGlobalDashboard(): Promise<GlobalDashboardData> {
  const { auth } = initializeFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error("Sem usuário autenticado.");

  const token = await user.getIdToken();
  const res = await fetch("/api/global/dashboard", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Falha ao carregar dados do dashboard global.");
  }

  return json.data as GlobalDashboardData;
}
