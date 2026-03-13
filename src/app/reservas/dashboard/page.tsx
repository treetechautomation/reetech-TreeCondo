"use client";

import * as React from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

type ReservaRow = {
  id: string;
  areaId: string;
  areaNome: string;
  status: string;
  uid: string;
  nomeMorador: string;
  bloco: string;
  unidade: string;
  valorCobrado: number;
  criadoEm?: any;
  data?: any;
  dateStr?: string;
  reservaManualPorOperador?: boolean;
  origemFila?: boolean;
  assumidaDeOferta?: boolean;
  opcaoNome?: string;
};

function moneyBRLFromCentavos(v?: number) {
  const n = Number(v ?? 0) / 100;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toDateSafe(v: any): Date | null {
  try {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v?.toDate === "function") return v.toDate();
    if (typeof v?._seconds === "number") return new Date(v._seconds * 1000);
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
    return null;
  } catch {
    return null;
  }
}

function getMonthRange(ref = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

function formatDateBR(v: any) {
  const d = toDateSafe(v);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR");
}

function formatDateTimeBR(v: any) {
  const d = toDateSafe(v);
  if (!d) return "—";
  return d.toLocaleString("pt-BR");
}

function KpiCard(props: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#0D4459]">
        {props.title}
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{props.value}</div>
      {props.subtitle ? (
        <div className="mt-1 text-xs text-slate-500">{props.subtitle}</div>
      ) : null}
    </div>
  );
}

export default function ReservasDashboardPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const firestore = useFirestore();

  const condId = session?.activeCondominioId ?? null;
  const role = String(session?.role || "").toUpperCase();

  const isAdminLike =
    role === "SINDICO" ||
    role === "ADMIN" ||
    role === "ADMIN_CONDOMINIO" ||
    role === "SUPER_ADMIN";

  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<ReservaRow[]>([]);
  const [condominioNome, setCondominioNome] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      if (!firestore || !condId || !isAdminLike) {
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        const { start, end } = getMonthRange(new Date());

        const reservasRef = collection(firestore, "condominios", condId, "reservas");
        const qReservas = query(
          reservasRef,
          where("data", ">=", Timestamp.fromDate(start)),
          where("data", "<", Timestamp.fromDate(end))
        );

        const [reservasSnap, condoSnap, areasSnap, membrosSnap] = await Promise.all([
          getDocs(qReservas),
          getDoc(doc(firestore, "condominiosPublicos", condId)),
          getDocs(collection(firestore, "condominios", condId, "areasReservaveis")),
          getDocs(collection(firestore, "condominios", condId, "membros")),
        ]);

        const areasById: Record<string, string> = {};
        areasSnap.docs.forEach((d) => {
          const data = d.data() as any;
          areasById[String(d.id)] = String(data?.nome || d.id);
        });

        const membrosByUid: Record<string, any> = {};
        membrosSnap.docs.forEach((d) => {
          membrosByUid[String(d.id)] = d.data() || {};
        });

        const list: ReservaRow[] = reservasSnap.docs.map((d) => {
          const data = d.data() as any;
          const membro = membrosByUid[String(data?.uid || "")] || {};
          return {
            id: String(d.id),
            areaId: String(data?.areaId || ""),
            areaNome: String(
              areasById[String(data?.areaId || "")] ||
                data?.areaNome ||
                data?.areaId ||
                "Área"
            ),
            status: String(data?.status || "—"),
            uid: String(data?.uid || ""),
            nomeMorador: String(
              membro?.nome || membro?.displayName || membro?.name || data?.uid || "Morador"
            ),
            bloco: String(membro?.blocoNome || membro?.blocoId || membro?.bloco || ""),
            unidade: String(
              membro?.unidadeNome || membro?.unidadeId || membro?.unidade || membro?.apto || ""
            ),
            valorCobrado: Number(data?.valorCobrado || 0) || 0,
            criadoEm: data?.criadoEm ?? null,
            data: data?.data ?? null,
            dateStr: String(data?.dateStr || ""),
            reservaManualPorOperador: Boolean(data?.reservaManualPorOperador),
            origemFila: Boolean(data?.origemFila),
            assumidaDeOferta: Boolean(data?.assumidaDeOferta),
            opcaoNome: String(data?.opcaoNome || ""),
          };
        });

        list.sort((a, b) => {
          const da = toDateSafe(a.data)?.getTime() || 0;
          const db = toDateSafe(b.data)?.getTime() || 0;
          return db - da;
        });

        if (!cancelled) {
          setCondominioNome(String((condoSnap.data() as any)?.nome || condId));
          setRows(list);
          setLoading(false);
        }
      } catch (e: any) {
        console.error("[ReservasDashboard] erro:", e);
        if (!cancelled) {
          setErr(e?.message || "Erro ao carregar dashboard.");
          setRows([]);
          setLoading(false);
        }
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [firestore, condId, isAdminLike]);

  const totalReservas = rows.length;
  const totalAprovadas = rows.filter((r) => String(r.status).toUpperCase() === "APROVADA").length;
  const totalPendentes = rows.filter((r) => String(r.status).toUpperCase() === "PENDENTE").length;
  const totalCanceladas = rows.filter((r) => String(r.status).toUpperCase() === "CANCELADA").length;
  const totalManuais = rows.filter((r) => !!r.reservaManualPorOperador).length;
  const totalFilaOrigem = rows.filter((r) => !!r.origemFila || !!r.assumidaDeOferta).length;
  const receitaTotal = rows.reduce((acc, r) => acc + (Number(r.valorCobrado || 0) || 0), 0);

  const rankingAreas = React.useMemo(() => {
    const map = new Map<string, { nome: string; total: number; receita: number; canceladas: number }>();

    rows.forEach((r) => {
      const key = String(r.areaId || r.areaNome || "sem-area");
      const prev = map.get(key) || {
        nome: r.areaNome || r.areaId || "Área",
        total: 0,
        receita: 0,
        canceladas: 0,
      };
      prev.total += 1;
      prev.receita += Number(r.valorCobrado || 0) || 0;
      if (String(r.status).toUpperCase() === "CANCELADA") prev.canceladas += 1;
      map.set(key, prev);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const rankingBlocos = React.useMemo(() => {
    const map = new Map<string, { nome: string; total: number; receita: number }>();

    rows.forEach((r) => {
      const nome = String(r.bloco || "Sem bloco");
      const prev = map.get(nome) || {
        nome,
        total: 0,
        receita: 0,
      };
      prev.total += 1;
      prev.receita += Number(r.valorCobrado || 0) || 0;
      map.set(nome, prev);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const porDia = React.useMemo(() => {
    const map = new Map<string, number>();

    rows.forEach((r) => {
      const d = toDateSafe(r.data);
      const key = d
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : (r.dateStr || "sem-data");
      map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([dia, total]) => ({ dia, total }))
      .sort((a, b) => String(a.dia).localeCompare(String(b.dia)));
  }, [rows]);

  if (isSessionLoading) {
    return <AppLayout pageTitle="Dashboard de Reservas">Carregando sessão...</AppLayout>;
  }

  if (!session || !condId) {
    return <AppLayout pageTitle="Dashboard de Reservas">Sem sessão ativa.</AppLayout>;
  }

  if (!isAdminLike) {
    return <AppLayout pageTitle="Dashboard de Reservas">Acesso negado.</AppLayout>;
  }

  return (
    <AppLayout pageTitle="Dashboard de Reservas">
      <div className="space-y-6">
        <div className="rounded-3xl border border-black/5 bg-white/65 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[#0D4459]">{condominioNome}</div>
              <div className="text-xs text-slate-500">Visão mensal administrativa das reservas</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/reservas">Voltar para Reservas</Link>
              </Button>
              <Button asChild>
                <Link href="/reservas/agenda">Reservas Aprovadas</Link>
              </Button>
            </div>
          </div>
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-black/5 bg-white/65 p-4 text-sm text-slate-600">
            Carregando dashboard...
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <KpiCard title="Total de reservas" value={String(totalReservas)} />
              <KpiCard title="Aprovadas" value={String(totalAprovadas)} />
              <KpiCard title="Pendentes" value={String(totalPendentes)} />
              <KpiCard title="Canceladas" value={String(totalCanceladas)} />
              <KpiCard title="Reservas manuais" value={String(totalManuais)} />
              <KpiCard title="Receita do mês" value={moneyBRLFromCentavos(receitaTotal)} subtitle={`Fila assumida/origem fila: ${totalFilaOrigem}`} />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="rounded-3xl border border-black/5 bg-white/65 p-5 shadow-sm backdrop-blur-xl xl:col-span-1">
                <div className="mb-4 text-sm font-semibold text-[#0D4459]">Ranking por área</div>
                <div className="space-y-3">
                  {rankingAreas.length === 0 ? (
                    <div className="text-sm text-slate-500">Sem dados no mês.</div>
                  ) : (
                    rankingAreas.map((a, idx) => (
                      <div key={`${a.nome}-${idx}`} className="rounded-2xl border border-black/5 bg-white/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">{a.nome}</div>
                          <div className="text-sm text-[#0D4459]">{a.total} reserva(s)</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Canceladas: {a.canceladas} • Receita: {moneyBRLFromCentavos(a.receita)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-black/5 bg-white/65 p-5 shadow-sm backdrop-blur-xl xl:col-span-1">
                <div className="mb-4 text-sm font-semibold text-[#0D4459]">Ranking por bloco</div>
                <div className="space-y-3">
                  {rankingBlocos.length === 0 ? (
                    <div className="text-sm text-slate-500">Sem dados no mês.</div>
                  ) : (
                    rankingBlocos.map((b, idx) => (
                      <div key={`${b.nome}-${idx}`} className="rounded-2xl border border-black/5 bg-white/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">{b.nome}</div>
                          <div className="text-sm text-[#0D4459]">{b.total} reserva(s)</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Receita: {moneyBRLFromCentavos(b.receita)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-black/5 bg-white/65 p-5 shadow-sm backdrop-blur-xl xl:col-span-1">
                <div className="mb-4 text-sm font-semibold text-[#0D4459]">Reservas por dia</div>
                <div className="space-y-2">
                  {porDia.length === 0 ? (
                    <div className="text-sm text-slate-500">Sem dados no mês.</div>
                  ) : (
                    porDia.map((item) => (
                      <div key={item.dia} className="flex items-center justify-between rounded-2xl border border-black/5 bg-white/70 px-3 py-2">
                        <div className="text-sm text-slate-900">{item.dia}</div>
                        <div className="text-sm font-semibold text-[#0D4459]">{item.total}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-black/5 bg-white/65 p-5 shadow-sm backdrop-blur-xl">
              <div className="mb-4 text-sm font-semibold text-[#0D4459]">Reservas do mês</div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Área</th>
                      <th className="px-3 py-2">Morador</th>
                      <th className="px-3 py-2">Bloco/Unidade</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Origem</th>
                      <th className="px-3 py-2">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                          Nenhuma reserva encontrada no mês atual.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.id} className="border-b border-black/5 text-slate-800">
                          <td className="px-3 py-3">{formatDateBR(r.data)}</td>
                          <td className="px-3 py-3">
                            <div>{r.areaNome}</div>
                            {r.opcaoNome ? <div className="text-xs text-slate-500">{r.opcaoNome}</div> : null}
                          </td>
                          <td className="px-3 py-3">{r.nomeMorador}</td>
                          <td className="px-3 py-3">
                            {[r.bloco, r.unidade].filter(Boolean).join(" • ") || "—"}
                          </td>
                          <td className="px-3 py-3">{r.status}</td>
                          <td className="px-3 py-3">
                            {r.reservaManualPorOperador
                              ? "Manual"
                              : r.origemFila || r.assumidaDeOferta
                              ? "Fila"
                              : "Morador"}
                          </td>
                          <td className="px-3 py-3">{moneyBRLFromCentavos(r.valorCobrado)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Atualizado com base nas reservas do mês atual do condomínio ativo.
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
