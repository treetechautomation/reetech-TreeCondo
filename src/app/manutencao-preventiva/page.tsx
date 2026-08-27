"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KpiCard } from "@/components/treecondo/KpiCard";
import { FloatingActionButton } from "@/components/treecondo/FloatingActionButton";
import { CARD_STYLE, ANIM, BORDER, TEXT } from "@/components/treecondo/tokens";
import MaintenanceSchedule from "@/components/manutencao/MaintenanceSchedule";
import MaintenanceCommandSearch from "@/components/manutencao/MaintenanceCommandSearch";

const MaintenanceAnalytics = dynamic(
  () => import("@/components/manutencao/MaintenanceAnalytics"),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full bg-white/10 rounded-2xl" /> }
);
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import {
  FileText,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  ChevronRight,
} from "lucide-react";

function startOfToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateBR(v: any): string {
  if (!v?.toDate) return "-";
  return v.toDate().toLocaleDateString("pt-BR");
}

function formatDateShort(v: any): string {
  if (!v?.toDate) return "-";
  return v.toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

type ExecSummary = {
  id: string;
  titulo: string;
  categoria?: string;
  status: string;
  dataProgramada?: any;
  dataExecutadaEm?: any;
  fornecedorNome?: string;
};

export default function ManutencaoPreventivaPage() {
  const { session } = useSessionCtx();
  const firestore = useFirestore();
  const router = useRouter();
  const condominioId = session?.activeCondominioId ?? null;

  const [loading, setLoading] = React.useState(true);
  const [proximas7dias, setProximas7dias] = React.useState(0);
  const [atrasadas, setAtrasadas] = React.useState(0);
  const [concluidasMes, setConcluidasMes] = React.useState(0);
  const [execucoesProximas, setExecucoesProximas] = React.useState<ExecSummary[]>([]);
  const [execucoesAtrasadas, setExecucoesAtrasadas] = React.useState<ExecSummary[]>([]);
  const [fornecedoresCount, setFornecedoresCount] = React.useState(0);
  const [rotinasCount, setRotinasCount] = React.useState(0);
  const [rotinasList, setRotinasList] = React.useState<{ id: string; titulo: string; categoria?: string }[]>([]);
  const [fornecedoresList, setFornecedoresList] = React.useState<{ id: string; nome: string; servico?: string }[]>([]);

  React.useEffect(() => {
    if (!firestore || !condominioId) {
      setLoading(false);
      return;
    }

    const unsubs: (() => void)[] = [];
    const today = startOfToday();
    const next7d = daysFromNow(7);
    const monthStart = startOfMonth();

    const execRef = collection(firestore, "condominios", condominioId, "manutencaoExecucoes");

    // Próximos 7 dias
    const qProximas = query(
      execRef,
      where("dataProgramada", ">=", Timestamp.fromDate(today)),
      where("dataProgramada", "<", Timestamp.fromDate(next7d)),
      where("status", "in", ["PROGRAMADA", "EM_ANDAMENTO"])
    );
    unsubs.push(
      onSnapshot(qProximas, (snap) => {
        setProximas7dias(snap.size);
        setLoading(false);
      })
    );

    // Atrasadas
    const qAtrasadas = query(
      execRef,
      where("dataProgramada", "<", Timestamp.fromDate(today)),
      where("status", "in", ["PROGRAMADA", "EM_ANDAMENTO"]),
      orderBy("dataProgramada", "asc")
    );
    unsubs.push(
      onSnapshot(qAtrasadas, (snap) => {
        setAtrasadas(snap.size);
        const items: ExecSummary[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
        setExecucoesAtrasadas(items);
      })
    );

    // Concluídas no mês
    const qConcluidas = query(
      execRef,
      where("status", "==", "CONCLUIDA"),
      where("dataExecutadaEm", ">=", Timestamp.fromDate(monthStart)),
      orderBy("dataExecutadaEm", "asc")
    );
    unsubs.push(
      onSnapshot(qConcluidas, (snap) => {
        setConcluidasMes(snap.size);
      })
    );

    // Próximas execuções (para a timeline)
    const qTimeline = query(
      execRef,
      where("dataProgramada", ">=", Timestamp.fromDate(today)),
      where("status", "in", ["PROGRAMADA", "EM_ANDAMENTO"]),
      orderBy("dataProgramada", "asc"),
      limit(5)
    );
    unsubs.push(
      onSnapshot(qTimeline, (snap) => {
        const items: ExecSummary[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
        setExecucoesProximas(items);
      })
    );

    // Fornecedores count + list
    const fornecedoresRef = collection(firestore, "condominios", condominioId, "manutencaoFornecedores");
    unsubs.push(
      onSnapshot(fornecedoresRef, (snap) => {
        setFornecedoresCount(snap.size);
        const list: { id: string; nome: string; servico?: string }[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({ id: d.id, nome: data.nome || data.razaoSocial || "—", servico: data.servico || undefined });
        });
        setFornecedoresList(list);
      })
    );

    // Rotinas count + list
    const rotinasRef = collection(firestore, "condominios", condominioId, "manutencaoRotinas");
    unsubs.push(
      onSnapshot(rotinasRef, (snap) => {
        setRotinasCount(snap.size);
        const list: { id: string; titulo: string; categoria?: string }[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({ id: d.id, titulo: data.titulo || "Sem título", categoria: data.categoria || undefined });
        });
        setRotinasList(list);
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [firestore, condominioId]);

  const conformidade = atrasadas + concluidasMes > 0
    ? Math.round((concluidasMes / (atrasadas + concluidasMes)) * 100)
    : 100;

  const alertaItems = [
    ...(atrasadas > 0 ? [{ label: `${atrasadas} manutenção${atrasadas > 1 ? "ões" : ""} atrasada${atrasadas > 1 ? "s" : ""}`, tone: "danger" as const }] : []),
    ...execucoesAtrasadas.slice(0, 3).map((ex) => ({
      label: `${ex.titulo || "Sem título"} — ${formatDateShort(ex.dataProgramada)}`,
      tone: "danger" as const,
    })),
  ];

  const isLoaded = !loading;

  return (
    <AppLayout pageTitle="">
      <TooltipProvider delayDuration={300}>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* ── HEADER PREMIUM ── */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-900/60 backdrop-blur-xl p-6">
          <div className="flex items-start gap-4">
            <div className="bg-[#00D0E6]/10 p-3 rounded-xl shrink-0">
              <Wrench className="h-6 w-6 text-[#00D0E6]" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Manutenção Preventiva</h1>
                <MaintenanceCommandSearch rotinas={rotinasList} fornecedores={fornecedoresList} />
              </div>
              <p className="text-sm text-white/60">
                Planeje, acompanhe e gerencie todas as manutenções do condomínio.
              </p>
            </div>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Próx. 7 dias"
            value={proximas7dias}
            icon={Clock}
            accentClass="text-[#00D0E6]"
            accentBg="bg-[#00D0E6]/10"
            loading={!isLoaded}
          />
          <KpiCard
            label="Atrasadas"
            value={atrasadas}
            icon={AlertTriangle}
            accentClass="text-red-500"
            accentBg="bg-red-500/10"
            trend={atrasadas > 0 ? { direction: "down", label: `${atrasadas} pendente${atrasadas > 1 ? "s" : ""}`, good: false } : { direction: "neutral", label: "Em dia", good: true }}
            loading={!isLoaded}
          />
          <KpiCard
            label="Concluídas no mês"
            value={concluidasMes}
            icon={CheckCircle}
            accentClass="text-emerald-500"
            accentBg="bg-emerald-500/10"
            loading={!isLoaded}
          />
          <KpiCard
            label="Conformidade"
            value={`${conformidade}%`}
            icon={CheckCircle}
            accentClass={conformidade >= 90 ? "text-emerald-500" : conformidade >= 70 ? "text-amber-500" : "text-red-500"}
            accentBg={conformidade >= 90 ? "bg-emerald-500/10" : conformidade >= 70 ? "bg-amber-500/10" : "bg-red-500/10"}
            loading={!isLoaded}
          />
          <KpiCard
            label="Custo Previsto"
            value="—"
            icon={Calendar}
            accentClass="text-slate-400"
            accentBg="bg-slate-400/10"
            loading={false}
          />
          <KpiCard
            label="Custo Real"
            value="—"
            icon={Calendar}
            accentClass="text-slate-400"
            accentBg="bg-slate-400/10"
            loading={false}
          />
        </div>

        {/* ── MAIN LAYOUT: conteúdo central + painel lateral ── */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── PAINEL PRINCIPAL ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* ── ACESSO RÁPIDO ── */}
            <div>
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3">Acesso Rápido</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    title: "Rotinas",
                    desc: "Gerencie manutenções recorrentes",
                    href: "/manutencao-preventiva/rotinas",
                    icon: FileText,
                    count: rotinasCount,
                    color: "text-[#00D0E6]" as const,
                    bg: "bg-[#00D0E6]/10" as const,
                  },
                  {
                    title: "Calendário",
                    desc: "Visualize as datas programadas",
                    href: "/manutencao-preventiva/calendario",
                    icon: Calendar,
                    count: null,
                    color: "text-amber-500" as const,
                    bg: "bg-amber-500/10" as const,
                  },
                  {
                    title: "Fornecedores",
                    desc: "Gerencie prestadores de serviço",
                    href: "/manutencao-preventiva/fornecedores",
                    icon: Users,
                    count: fornecedoresCount,
                    color: "text-violet-500" as const,
                    bg: "bg-violet-500/10" as const,
                  },
                ].map((card) => (
                  <Link key={card.href} href={card.href}>
                    <Card className="h-full border-white/[0.06] bg-slate-900/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:border-[#00D0E6]/20 hover:shadow-[0_8px_40px_rgba(0,208,230,0.06)] transition-all duration-300 rounded-2xl p-5 cursor-pointer group">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className={`${card.bg} p-2 rounded-lg w-fit`}>
                            <card.icon className={`h-5 w-5 ${card.color}`} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white group-hover:text-[#00D0E6] transition-colors">
                              {card.title}
                            </h4>
                            <p className="text-[11px] text-white/40 mt-0.5">{card.desc}</p>
                          </div>
                        </div>
                        {card.count !== null && (
                          <span className="text-xs font-bold text-white/50 bg-white/5 px-2 py-0.5 rounded-full">
                            {card.count}
                          </span>
                        )}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>

            {/* ── CRONOGRAMA PREMIUM ── */}
            <MaintenanceSchedule firestore={firestore} condominioId={condominioId} />
          </div>

          {/* ── PAINEL LATERAL ── */}
          <div className="space-y-6">
            {/* ── ALERTAS ── */}
            <Card className="border-white/[0.06] bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Alertas
              </h3>
              {!isLoaded ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full bg-white/10" />
                  ))}
                </div>
              ) : alertaItems.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs text-white/40">Tudo em dia. Nenhum alerta.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alertaItems.map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-2.5 rounded-xl text-xs ${
                        item.tone === "danger" ? "bg-red-500/5 border border-red-500/10" : "bg-amber-500/5 border border-amber-500/10"
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${item.tone === "danger" ? "bg-red-500" : "bg-amber-500"}`} />
                      <span className="text-white/70 leading-relaxed">{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* ── ACESSO RÁPIDO LATERAL ── */}
            <Card className="border-white/[0.06] bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">
                Gestão
              </h3>
              <div className="space-y-1">
                {[
                  { label: "Rotinas", href: "/manutencao-preventiva/rotinas", count: rotinasCount },
                  { label: "Calendário", href: "/manutencao-preventiva/calendario", count: null },
                  { label: "Fornecedores", href: "/manutencao-preventiva/fornecedores", count: fornecedoresCount },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.04] transition-colors group"
                  >
                    <span className="text-sm text-white/70 group-hover:text-white transition-colors">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {item.count !== null && (
                        <span className="text-[10px] font-bold text-white/40 bg-white/5 px-1.5 py-0.5 rounded-full">
                          {item.count}
                        </span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* ── ANALYTICS ── */}
        <MaintenanceAnalytics firestore={firestore} condominioId={condominioId} />
      </div>

      {/* ── FLOATING ACTION ── */}
      <FloatingActionButton
        onClick={() => router.push("/manutencao-preventiva/rotinas")}
        label="Nova Rotina"
      />
      </TooltipProvider>
    </AppLayout>
  );
}
