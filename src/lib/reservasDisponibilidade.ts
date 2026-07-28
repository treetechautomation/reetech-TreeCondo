import { collection, getDocs, query, Timestamp, where, type Firestore } from "firebase/firestore";

/**
 * Regras de bloqueio:
 * - Só "APROVADA" bloqueia o dia/área.
 * - "PENDENTE", "RECUSADA", "CANCELADA", etc. NÃO bloqueiam.
 */
const STATUS_BLOQUEIA = new Set<string>(["APROVADA"]);

export function startOfDayUTC(dateStrYYYYMMDD: string) {
  // cria Date em UTC 00:00:00 do dia informado (YYYY-MM-DD)
  const [y, m, d] = dateStrYYYYMMDD.split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0));
}

export function endOfDayUTC(dateStrYYYYMMDD: string) {
  // início do próximo dia em UTC (limite exclusivo)
  const ini = startOfDayUTC(dateStrYYYYMMDD);
  return new Date(ini.getTime() + 24 * 60 * 60 * 1000);
}

export async function isDiaDisponivelPorArea(
  firestore: Firestore,
  condominioId: string,
  areaId: string,
  dateStrYYYYMMDD: string
): Promise<{ disponivel: boolean; totalNoDia: number; bloqueando: number }> {
  const ini = startOfDayUTC(dateStrYYYYMMDD);
  const fim = endOfDayUTC(dateStrYYYYMMDD);

  // OBS: não colocamos "status" no query pra evitar exigir novo índice.
  const q = query(
    collection(firestore, "condominios", condominioId, "reservas"),
    where("data", ">=", Timestamp.fromDate(ini)),
    where("data", "<", Timestamp.fromDate(fim))
  );
const snap = await getDocs(q);

  let totalNoDia = 0;
  let bloqueando = 0;

  snap.forEach((doc) => {
    const data = doc.data() as any;
    const status = String(data?.status ?? "");

    const areaDaReserva = String(data?.areaId ?? "");
    const bloqueiaAreaId = data?.bloqueiaAreaId != null ? String(data.bloqueiaAreaId) : "";
    const bloqueiaAreaIds = Array.isArray(data?.bloqueiaAreaIds) ? data.bloqueiaAreaIds.map((x: any) => String(x)) : [];
    const resourceIds = Array.isArray(data?.resourceIds) ? data.resourceIds.map((x: any) => String(x)) : [];

    const afetaEstaArea =
      areaDaReserva === String(areaId) ||
      bloqueiaAreaId === String(areaId) ||
      bloqueiaAreaIds.includes(String(areaId)) ||
      resourceIds.includes(String(areaId));

    if (!afetaEstaArea) return;

    totalNoDia++;

    if (STATUS_BLOQUEIA.has(status)) bloqueando++;
  });

  return {
    disponivel: bloqueando === 0,
    totalNoDia,
    bloqueando,
  };
}
