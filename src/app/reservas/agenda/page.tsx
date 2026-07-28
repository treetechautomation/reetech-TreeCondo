"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Grid3X3,
  List,
  CheckCircle2,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CORES: Record<string, string> = {
  APROVADA: "bg-emerald-500",
  PENDENTE: "bg-amber-400",
  CANCELADA: "bg-red-400",
  REJEITADA: "bg-rose-500",
};

const STATUS_LABELS: Record<string, string> = {
  APROVADA: "Aprovada",
  PENDENTE: "Pendente",
  CANCELADA: "Cancelada",
  REJEITADA: "Rejeitada",
};

function toDateStr(d: Date) {
  return format(d, "yyyy-MM-dd");
}

type ReservaItem = {
  id: string;
  areaId: string;
  areaNome?: string;
  dateStr: string;
  uid: string;
  moradorNome?: string;
  status: string;
  opcaoNome?: string;
  valorCobrado?: number;
  statusAcesso?: string;
};

export default function AgendaReservasPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const firestore = useFirestore();

  const condId = session?.activeCondominioId ?? null;
  const roleUpper = String((session as any)?.role || "").toUpperCase();
  const isAdminLike = ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN", "PORTEIRO"].includes(roleUpper);

  const [viewMode, setViewMode] = React.useState<"calendar" | "list">("calendar");
  const [currentMonth, setCurrentMonth] = React.useState(() => new Date());
  const [reservas, setReservas] = React.useState<ReservaItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
  const [areas, setAreas] = React.useState<Record<string, string>>({});
  const [filterArea, setFilterArea] = React.useState<string>("TODAS");
  const [loadingCheckinId, setLoadingCheckinId] = React.useState<string | null>(null);

  // Carregar áreas do condomínio
  React.useEffect(() => {
    if (!firestore || !condId) return;
    getDocs(collection(firestore, "condominios", condId, "areas")).then((snap) => {
      const map: Record<string, string> = {};
      snap.docs.forEach((d) => { map[d.id] = d.data()?.nome || d.id; });
      setAreas(map);
    }).catch(() => {});
  }, [firestore, condId]);

  // Carregar reservas do mês atual
  React.useEffect(() => {
    if (!firestore || !condId) return;
    setLoading(true);

    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    getDocs(query(
      collection(firestore, "condominios", condId, "reservas"),
      where("data", ">=", Timestamp.fromDate(start)),
      where("data", "<=", Timestamp.fromDate(end))
    )).then(async (snap) => {
      const items: ReservaItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setReservas(items);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [firestore, condId, currentMonth]);

  // Dias do mês
  const daysInMonth = React.useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  }, [currentMonth]);

  // Primeiro dia da semana (0=Dom)
  const firstDayOfWeek = getDay(startOfMonth(currentMonth));

  // Reservas filtradas por área
  const reservasFiltradas = React.useMemo(() => {
    if (filterArea === "TODAS") return reservas;
    return reservas.filter((r) => r.areaId === filterArea);
  }, [reservas, filterArea]);

  // Reservas por dateStr para o calendário
  const reservasByDate = React.useMemo(() => {
    const map: Record<string, ReservaItem[]> = {};
    reservasFiltradas.forEach((r) => {
      const k = r.dateStr;
      if (!map[k]) map[k] = [];
      map[k].push(r);
    });
    return map;
  }, [reservasFiltradas]);

  // Reservas do dia selecionado
  const reservasDoDia = React.useMemo(() => {
    if (!selectedDay) return [];
    return reservasByDate[toDateStr(selectedDay)] || [];
  }, [selectedDay, reservasByDate]);

  function prevMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    setSelectedDay(null);
  }
  function nextMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    setSelectedDay(null);
  }

  async function handleCheckin(reservaId: string) {
    if (!firestore || !condId) return;
    setLoadingCheckinId(reservaId);
    try {
      await updateDoc(doc(firestore, "condominios", condId, "reservas", reservaId), {
        statusAcesso: "ENTROU",
        entradaEm: serverTimestamp(),
        porteiroUid: session?.user?.uid ?? null,
      });
      setReservas((prev) => prev.map((r) => r.id === reservaId ? { ...r, statusAcesso: "ENTROU" } : r));
    } catch (e) {
      alert("Erro ao registrar entrada.");
    } finally {
      setLoadingCheckinId(null);
    }
  }

  const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  if (!isAdminLike && !isSessionLoading) {
    return (
      <AppLayout pageTitle="Calendário de Reservas">
        <div className="text-center py-20 text-slate-500">Acesso restrito a operadores do condomínio.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Calendário de Reservas" headerActions={
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === "calendar" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("calendar")}
          className="gap-1"
          title="Ver Mês"
        >
          <Grid3X3 className="h-4 w-4" />
          <span className="hidden sm:inline">Mês</span>
        </Button>
        <Button
          variant={viewMode === "list" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("list")}
          className="gap-1"
          title="Ver Lista"
        >
          <List className="h-4 w-4" />
          <span className="hidden sm:inline">Lista</span>
        </Button>
      </div>
    }>
      <div className="space-y-4">
        {/* Navegação do mês */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-bold capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Filtro por área */}
          {Object.keys(areas).length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setFilterArea("TODAS")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                  filterArea === "TODAS"
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white/60 text-slate-600 border-white/40"
                )}
              >
                Todas as áreas
              </button>
              {Object.entries(areas).map(([id, nome]) => (
                <button
                  key={id}
                  onClick={() => setFilterArea(id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                    filterArea === id
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white/60 text-slate-600 border-white/40"
                  )}
                >
                  {nome}
                </button>
              ))}
            </div>
          )}
        </div>

        {viewMode === "calendar" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calendário */}
            <div className="lg:col-span-2 rounded-2xl border border-white/30 bg-white/60 backdrop-blur-xl overflow-hidden shadow-sm">
              {/* Header dos dias da semana */}
              <div className="grid grid-cols-7 border-b border-white/30">
                {DIAS_SEMANA.map((d) => (
                  <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500">
                    {d}
                  </div>
                ))}
              </div>

              {/* Grid de dias */}
              <div className="grid grid-cols-7">
                {/* Espaços em branco antes do primeiro dia */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[72px] border-b border-r border-white/20 bg-slate-50/40" />
                ))}

                {/* Dias do mês */}
                {daysInMonth.map((day) => {
                  const ds = toDateStr(day);
                  const dayReservas = reservasByDate[ds] || [];
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const isCurrentDay = isToday(day);

                  return (
                    <button
                      key={ds}
                      onClick={() => setSelectedDay(isSameDay(day, selectedDay || new Date(0)) ? null : day)}
                      className={cn(
                        "min-h-[72px] p-1.5 border-b border-r border-white/20 text-left transition-all hover:bg-[#00D0E6]/5",
                        isSelected ? "bg-[#00D0E6]/10 ring-2 ring-[#00D0E6] ring-inset" : "",
                        isCurrentDay ? "font-bold" : ""
                      )}
                    >
                      <div className={cn(
                        "text-xs mb-1 h-5 w-5 rounded-full flex items-center justify-center",
                        isCurrentDay ? "bg-[#00D0E6] text-white" : "text-slate-700"
                      )}>
                        {day.getDate()}
                      </div>

                      {/* Indicadores de reservas */}
                      <div className="flex flex-wrap gap-0.5">
                        {dayReservas.slice(0, 3).map((r) => (
                          <div
                            key={r.id}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              STATUS_CORES[r.status] || "bg-slate-400"
                            )}
                          />
                        ))}
                        {dayReservas.length > 3 && (
                          <span className="text-[9px] text-slate-500">+{dayReservas.length - 3}</span>
                        )}
                      </div>

                      {dayReservas.length > 0 && (
                        <div className="text-[9px] text-slate-500 mt-0.5">
                          {dayReservas.length} reserva{dayReservas.length > 1 ? "s" : ""}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legenda */}
              <div className="px-4 py-3 border-t border-white/20 flex items-center gap-4 text-xs text-slate-500">
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <div key={status} className="flex items-center gap-1">
                    <div className={cn("h-2 w-2 rounded-full", STATUS_CORES[status])} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Painel de detalhe do dia selecionado */}
            <div className="rounded-2xl border border-white/30 bg-white/60 backdrop-blur-xl p-4 shadow-sm">
              {!selectedDay ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 gap-3">
                  <Calendar className="h-12 w-12 text-slate-200" />
                  <p className="text-slate-400 text-sm">Clique em um dia no calendário para ver as reservas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-800 capitalize">
                    {format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </h3>

                  {reservasDoDia.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-sm">
                      Nenhuma reserva neste dia
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {reservasDoDia.map((r) => {
                        const entrou = r.statusAcesso === "ENTROU";
                        return (
                          <div key={r.id} className="rounded-xl border border-white/40 bg-white/80 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-sm text-slate-800">
                                {areas[r.areaId] || r.areaId}
                              </span>
                              <Badge className={cn("text-[10px]", STATUS_CORES[r.status]?.replace("bg-", "bg-") || "")}>
                                {STATUS_LABELS[r.status] || r.status}
                              </Badge>
                            </div>

                            {r.opcaoNome && (
                              <p className="text-xs text-slate-500">{r.opcaoNome}</p>
                            )}

                            {/* Check-in */}
                            {r.status === "APROVADA" && (
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-xs flex items-center gap-1">
                                  {entrou ? (
                                    <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                    <span className="text-emerald-600 font-medium">Entrou</span></>
                                  ) : (
                                    <><Clock className="h-3.5 w-3.5 text-amber-400" />
                                    <span className="text-amber-600">Aguardando</span></>
                                  )}
                                </span>
                                {!entrou && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCheckin(r.id)}
                                    disabled={loadingCheckinId === r.id}
                                    className="h-6 text-xs px-2"
                                  >
                                    {loadingCheckinId === r.id ? "..." : "Check-in"}
                                  </Button>
                                )}
                              </div>
                            )}

                            <div className="flex gap-1">
                              <Link
                                href={`/reservas/convidados-checkin/${r.id}`}
                                className="text-[10px] text-[#00D0E6] hover:underline"
                              >
                                Ver convidados →
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Modo lista */
          <div className="rounded-2xl border border-white/30 bg-white/60 backdrop-blur-xl p-4 shadow-sm space-y-2">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
              ))
            ) : reservasFiltradas.length === 0 ? (
              <div className="py-12 text-center text-slate-400">Nenhuma reserva este mês.</div>
            ) : (
              reservasFiltradas
                .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
                .map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/40 bg-white/80 p-3">
                    <div className="w-12 text-center">
                      <div className="text-xs text-slate-400">{format(new Date(r.dateStr + "T12:00:00"), "MMM", { locale: ptBR })}</div>
                      <div className="text-xl font-bold text-slate-800 leading-none">
                        {parseInt(r.dateStr.split("-")[2])}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-slate-800">{areas[r.areaId] || r.areaId}</div>
                      {r.opcaoNome && <div className="text-xs text-slate-500">{r.opcaoNome}</div>}
                    </div>
                    <Badge className={cn("text-[10px] shrink-0", STATUS_CORES[r.status] || "bg-slate-400")}>
                      {STATUS_LABELS[r.status] || r.status}
                    </Badge>
                    <Link
                      href={`/reservas/convidados-checkin/${r.id}`}
                      className="text-xs text-[#00D0E6] hover:underline shrink-0"
                    >
                      Detalhes →
                    </Link>
                  </div>
                ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
