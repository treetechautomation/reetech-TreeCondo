"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Eye,
  Wrench,
} from "lucide-react";
import {
  type ExecItem,
  formatDateBR,
  formatDateShort,
  formatDateRelative,
  getStatusConfig,
  isAtrasada,
  normalize,
  STATUS_FILTERS,
  ITEMS_PER_PAGE,
} from "./maintenance-utils";

type SortField = "data" | "titulo" | "status";
type SortDir = "asc" | "desc";

interface MaintenanceListViewProps {
  items: ExecItem[];
  loading: boolean;
  onOpenDetalhe?: (id: string) => void;
}

export default function MaintenanceListView({ items, loading, onOpenDetalhe }: MaintenanceListViewProps) {
  const [search, setSearch] = React.useState("");
  const [filterKey, setFilterKey] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [sortField, setSortField] = React.useState<SortField>("data");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [page, setPage] = React.useState(0);
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const filtered = React.useMemo(() => {
    let result = [...items];

    if (filterKey === "hoje") {
      const today = new Date();
      result = result.filter((item) => {
        const d = item.dataProgramada?.toDate?.() ?? (item.dataProgramada instanceof Date ? item.dataProgramada : null);
        if (!d) return false;
        return d.toDateString() === today.toDateString();
      });
    } else if (filterKey === "proximos7d") {
      const now = new Date();
      const next7 = new Date();
      next7.setDate(next7.getDate() + 7);
      result = result.filter((item) => {
        const d = item.dataProgramada?.toDate?.() ?? (item.dataProgramada instanceof Date ? item.dataProgramada : null);
        if (!d) return false;
        return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && d < new Date(next7.getFullYear(), next7.getMonth(), next7.getDate());
      });
    } else if (filterKey === "atrasadas") {
      result = result.filter((item) => isAtrasada(item));
    } else if (filterKey === "em_andamento") {
      result = result.filter((item) => normalize(item.status) === "EM_ANDAMENTO");
    } else if (filterKey === "concluidas") {
      result = result.filter((item) => normalize(item.status) === "CONCLUIDA");
    }

    if (statusFilter !== "all") {
      result = result.filter((item) => normalize(item.status) === statusFilter);
    }

    if (debouncedSearch) {
      const q = debouncedSearch;
      result = result.filter(
        (item) =>
          (item.titulo || "").toLowerCase().includes(q) ||
          (item.fornecedorNome || "").toLowerCase().includes(q) ||
          (item.categoria || "").toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const aAtrasada = isAtrasada(a);
      const bAtrasada = isAtrasada(b);
      if (aAtrasada && !bAtrasada) return -1;
      if (!aAtrasada && bAtrasada) return 1;

      if (sortField === "status") {
        const cmp = getStatusConfig(a.status).order - getStatusConfig(b.status).order;
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortField === "titulo") {
        const cmp = (a.titulo || "").localeCompare(b.titulo || "");
        return sortDir === "asc" ? cmp : -cmp;
      }

      const aDate = a.dataProgramada?.toDate?.() ?? (a.dataProgramada instanceof Date ? a.dataProgramada : new Date(0));
      const bDate = b.dataProgramada?.toDate?.() ?? (b.dataProgramada instanceof Date ? b.dataProgramada : new Date(0));
      const cmp = aDate.getTime() - bDate.getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [items, filterKey, statusFilter, debouncedSearch, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  React.useEffect(() => {
    if (page >= totalPages && totalPages > 0) setPage(0);
  }, [page, totalPages]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full bg-white/10 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Filters */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilterKey(f.key);
              setPage(0);
            }}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
              filterKey === f.key
                ? "bg-[#00D0E6]/15 text-[#00D0E6] border border-[#00D0E6]/30"
                : "bg-white/5 text-white/50 hover:bg-white/10 border border-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <Input
            placeholder="Buscar por manutenção, rotina ou fornecedor..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-10 h-9 text-sm bg-slate-900/60 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#00D0E6]/40"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white" aria-label="Limpar pesquisa">
              ✕
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px] h-9 bg-slate-900/60 border-white/10 text-white/70 text-xs rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-white/10">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="PROGRAMADA">Programada</SelectItem>
            <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
            <SelectItem value="CONCLUIDA">Concluída</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>{filtered.length} manutenç{filtered.length === 1 ? "ão" : "ões"}</span>
        {(filterKey !== "all" || statusFilter !== "all" || debouncedSearch) && (
          <button
            onClick={() => { setFilterKey("all"); setStatusFilter("all"); setSearch(""); setPage(0); }}
            className="text-[#00D0E6] hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
          {filterKey === "all" && statusFilter === "all" && !debouncedSearch ? (
            <>
              <Calendar className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/40 mb-1">Nenhuma manutenção programada.</p>
              <Link
                href="/manutencao-preventiva/rotinas"
                className="text-xs text-[#00D0E6] font-bold hover:underline"
              >
                Cadastre uma rotina para começar
              </Link>
            </>
          ) : (
            <>
              <Search className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/40 mb-3">Nenhuma manutenção encontrada com os filtros selecionados.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setFilterKey("all"); setStatusFilter("all"); setSearch(""); setPage(0); }}
                className="border-white/10 text-white/70 hover:bg-white/5 rounded-xl"
              >
                Limpar filtros
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="p-3 text-[11px] font-bold text-white/40 uppercase tracking-wider w-8"></th>
                  <th
                    className="p-3 text-[11px] font-bold text-white/40 uppercase tracking-wider cursor-pointer hover:text-white/70"
                    onClick={() => toggleSort("titulo")}
                  >
                    Manutenção <SortIcon field="titulo" />
                  </th>
                  <th className="p-3 text-[11px] font-bold text-white/40 uppercase tracking-wider hidden md:table-cell">Categoria</th>
                  <th
                    className="p-3 text-[11px] font-bold text-white/40 uppercase tracking-wider cursor-pointer hover:text-white/70"
                    onClick={() => toggleSort("data")}
                  >
                    Data <SortIcon field="data" />
                  </th>
                  <th className="p-3 text-[11px] font-bold text-white/40 uppercase tracking-wider hidden sm:table-cell">Fornecedor</th>
                  <th
                    className="p-3 text-[11px] font-bold text-white/40 uppercase tracking-wider cursor-pointer hover:text-white/70"
                    onClick={() => toggleSort("status")}
                  >
                    Status <SortIcon field="status" />
                  </th>
                  <th className="p-3 text-[11px] font-bold text-white/40 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {paged.map((item) => {
                  const cfg = isAtrasada(item) ? { label: "ATRASADA", icon: getStatusConfig("ATRASADA").icon, color: "#ef4444", bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", order: -1 } : getStatusConfig(item.status);
                  const StatusIcon = cfg.icon;
                  const isConcluida = normalize(item.status) === "CONCLUIDA";

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-white/[0.03] transition-colors ${isConcluida ? "opacity-50" : ""}`}
                    >
                      <td className="p-3">
                        <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: cfg.color }} />
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-semibold text-white text-sm truncate max-w-[200px]">
                            {item.titulo || "Sem título"}
                          </p>
                          <p className="text-[11px] text-white/30 mt-0.5">
                            {formatDateRelative(item.dataProgramada)}
                          </p>
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        {item.categoria ? (
                          <span className="text-[11px] text-white/50 bg-white/5 px-2 py-0.5 rounded-full">
                            {item.categoria}
                          </span>
                        ) : (
                          <span className="text-[11px] text-white/20">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-white/70 whitespace-nowrap">{formatDateShort(item.dataProgramada)}</span>
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <span className="text-[11px] text-white/50 truncate max-w-[120px] block">
                          {item.fornecedorNome || "-"}
                        </span>
                      </td>
                      <td className="p-3">
                        <Badge
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1 inline" />
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/manutencao-preventiva/rotinas/${item.rotinaId || item.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00D0E6] hover:text-[#00B4CC] transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Ver</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-white/40 pt-2">
              <span>
                {page * ITEMS_PER_PAGE + 1}–{Math.min((page + 1) * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-7 w-7 p-0 text-white/50 hover:text-white hover:bg-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D0E6]/50"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 w-7 p-0 text-white/50 hover:text-white hover:bg-white/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D0E6]/50"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
