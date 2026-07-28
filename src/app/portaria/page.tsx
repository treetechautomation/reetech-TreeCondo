"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users, Package, CalendarDays, AlertTriangle,
  QrCode, PackagePlus, UserSearch, AlertCircle,
  ArrowRight, RefreshCcw, Clock, Megaphone, Home,
  Shield, Building2,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { SectionCard } from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSessionCtx } from "@/contexts/SessionContext";
import { getAuth } from "firebase/auth";

const POLLING_SEC = 30;

type DashboardData = {
  ok: boolean;
  kpis: {
    acessosHoje: number;
    aguardandoEntrada: number;
    encomendasPendentes: number;
    reservasHoje: number;
    incidentesAbertos: number;
  };
  acessosRecentes: AcessoItem[];
  encomendasPendentes: EncomendaItem[];
  reservasHoje: ReservaItem[];
  incidentesAbertos: IncidenteItem[];
  comunicados: ComunicadoItem[];
};

type AcessoItem = {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  blocoId: string;
  unidadeId: string;
  blocoNome: string;
  unidadeNumero: string;
  createdAt: string | null;
};

type EncomendaItem = {
  id: string;
  transportadora: string;
  codigo: string;
  blocoNome: string;
  unidadeNumero: string;
  chegouEm: string | null;
};

type ReservaItem = {
  id: string;
  areaNome: string;
  horarioInicio: string;
  horarioFim: string;
  moradorNome: string;
  unidadeNumero: string;
  status: string;
};

type IncidenteItem = {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  local: string;
  createdAt: string | null;
};

type ComunicadoItem = {
  id: string;
  titulo: string;
  resumo: string;
  publicadoEm: string | null;
};

function statusTone(status: string) {
  switch (status) {
    case "AUTORIZADO":
    case "ENTROU":
    case "APROVADA":
    case "CONFIRMADA":
    case "RESOLVIDO":
    case "FINALIZADO":
    case "ATIVO":
      return "success" as const;
    case "PENDENTE":
    case "EM_ANDAMENTO":
    case "ABERTO":
      return "warning" as const;
    case "NEGADO":
    case "CANCELADO":
    case "EXPIRADO":
      return "danger" as const;
    case "SAIU":
    default:
      return "neutral" as const;
  }
}

function safeStr(v: any): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    PENDENTE: "Pendente",
    AUTORIZADO: "Autorizado",
    NEGADO: "Negado",
    ENTROU: "Entrou",
    SAIU: "Saiu",
    CANCELADO: "Cancelado",
    EXPIRADO: "Expirado",
    ABERTO: "Aberto",
    EM_ANDAMENTO: "Em andamento",
    RESOLVIDO: "Resolvido",
    FINALIZADO: "Finalizado",
    APROVADA: "Aprovada",
    CONFIRMADA: "Confirmada",
  };
  return map[status] || status;
}

function fmtTs(ts: string | null) {
  if (!ts) return "--";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "--";
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return "--"; }
}

function fmtDate(ts: string | null) {
  if (!ts) return "--";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "--";
    return d.toLocaleDateString("pt-BR");
  } catch { return "--"; }
}

export default function PortariaPage() {
  const { session } = useSessionCtx();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const condominioId = session?.activeCondominioId || "";
  const condominioNome = session?.vinculos?.[0]?.condominioNome || "";

  const fetchDashboard = useCallback(async () => {
    const auth = getAuth();
    const user = auth.currentUser || session?.user;
    if (!user || !condominioId) {
      setLoading(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      const url = `/api/portaria/dashboard?condominioId=${encodeURIComponent(condominioId)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 403) {
          setData((prev) => prev ? prev : null);
          setError((prev) => prev ?? "Acesso restrito. Este painel é exclusivo para a portaria.");
        } else {
          setError((prev) => prev ?? "Erro ao carregar dados do painel.");
        }
        return;
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError((prev) => prev ?? "Erro de conexão ao carregar painel.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioId, session?.user?.uid]);

  useEffect(() => {
    setLoading(true);
    fetchDashboard();
  }, [fetchDashboard]);

  // R6: Common-area guest check-in section
  const [convidadosUsoComum, setConvidadosUsoComum] = useState<any[]>([]);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  useEffect(() => {
    if (!condominioId) return;
    fetch(`/api/portaria/unificada?condominioId=${encodeURIComponent(condominioId)}`)
      .then(r => r.json()).then(d => setConvidadosUsoComum(d.convidadosUsoComum || [])).catch(() => {});
  }, [condominioId, data]);

  async function handleCheckinCommonGuest(convidado: any) {
    setCheckingIn(convidado.convidadoId);
    await fetch("/api/checkin/registrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ condominioId, origemTipo: "USO_CAMPO", origemId: convidado.origemId, convidadoId: convidado.convidadoId }) });
    setConvidadosUsoComum(prev => prev.filter(c => c.convidadoId !== convidado.convidadoId));
    setCheckingIn(null);
  }

  useEffect(() => {
    if (!condominioId) return;
    const interval = setInterval(fetchDashboard, POLLING_SEC * 1000);
    return () => clearInterval(interval);
  }, [fetchDashboard, condominioId]);

  if (!session) {
    return (
      <AppLayout pageTitle="Painel da Portaria">
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground text-sm">Carregando sessão...</p>
        </div>
      </AppLayout>
    );
  }

  if (!condominioId) {
    return (
      <AppLayout pageTitle="Painel da Portaria">
        <EmptyState
          icon={Building2}
          title="Nenhum condomínio selecionado"
          description="Selecione um condomínio para acessar o painel da portaria."
        />
      </AppLayout>
    );
  }

  if (error && !data) {
    return (
      <AppLayout pageTitle="Painel da Portaria">
        <EmptyState
          icon={Shield}
          title="Acesso restrito"
          description={error}
        />
      </AppLayout>
    );
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      {condominioNome && (
        <span className="hidden sm:inline text-xs text-muted-foreground px-2 py-1 rounded-full border">
          {condominioNome}
        </span>
      )}
      <Button variant="ghost" size="icon" onClick={fetchDashboard} title="Atualizar" disabled={loading}>
        <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
      </Button>
    </div>
  );

  const kpiCards = [
    { key: "acessosHoje", label: "Acessos Hoje", icon: Users, value: data?.kpis?.acessosHoje ?? 0 },
    { key: "aguardandoEntrada", label: "Aguard. Entrada", icon: Clock, value: data?.kpis?.aguardandoEntrada ?? 0 },
    { key: "encomendasPendentes", label: "Encom. Pendentes", icon: Package, value: data?.kpis?.encomendasPendentes ?? 0 },
    { key: "reservasHoje", label: "Reservas Hoje", icon: CalendarDays, value: data?.kpis?.reservasHoje ?? 0 },
    { key: "incidentesAbertos", label: "Incidentes", icon: AlertTriangle, value: data?.kpis?.incidentesAbertos ?? 0 },
  ];

  return (
    <AppLayout pageTitle="Painel da Portaria" headerActions={headerActions}>
      <div className="space-y-6">
        {loading ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {kpiCards.map((k) => (
                <div key={k.key} className="rounded-2xl border bg-card p-4 space-y-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
            <SectionCard title="Acessos Recentes"><Skeleton className="h-32 w-full" /></SectionCard>
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Encomendas Pendentes"><Skeleton className="h-32 w-full" /></SectionCard>
              <SectionCard title="Reservas do Dia"><Skeleton className="h-32 w-full" /></SectionCard>
            </div>
          </>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Erro ao carregar" description={error} />
        ) : (
          <>
            {/* ─── R6: Convidados — Uso Comum ─── */}
            {convidadosUsoComum.length > 0 && (
              <SectionCard title="Convidados — Uso Comum" description="Check-in de convidados do Campo/Quadra">
                <div className="space-y-2">
                  {convidadosUsoComum.map((c: any) => (
                    <div key={c.convidadoId} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium text-sm">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.bloco} {c.unidade} — {c.horaInicio} às {c.horaFim}</p>
                      </div>
                      <Button size="sm" className="bg-primary text-primary-foreground" disabled={checkingIn === c.convidadoId} onClick={() => handleCheckinCommonGuest(c)}>
                        {checkingIn === c.convidadoId ? "Confirmando..." : "Confirmar entrada"}
                      </Button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* ─── KPIs ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {kpiCards.map((k) => (
                <div key={k.key} className="rounded-2xl border bg-card p-4 space-y-1">
                  <k.icon className="h-5 w-5 text-muted-foreground" />
                  <p className="text-2xl font-bold">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* ─── Acessos Recentes ─── */}
              <div>
                <SectionCard
                  title="Acessos Recentes"
                  description="Últimos registros de acesso"
                  actions={
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/acesso">Ver todos <ArrowRight className="ml-1 h-3 w-3" /></Link>
                    </Button>
                  }
                >
                  {!data?.acessosRecentes?.length ? (
                    <EmptyState icon={Users} title="Nenhum acesso recente" description="Os registros de acesso aparecerão aqui." />
                  ) : (
                    <div className="divide-y -mx-6">
                      {(data.acessosRecentes || []).slice(0, 6).map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 px-6 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{a.nome || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {a.tipo === "PRESTADOR" ? "Prestador" : "Visitante"}
                              {(a.blocoNome || a.unidadeNumero) && (
                                <> • {a.blocoNome}{a.blocoNome && a.unidadeNumero ? " / " : ""}{a.unidadeNumero}</>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">{fmtTs(a.createdAt)}</span>
                            <StatusBadge tone={statusTone(a.status)}>{safeStr(statusLabel(a.status))}</StatusBadge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* ─── Ações Rápidas ─── */}
              <div className="space-y-6">
                <SectionCard title="Ações Rápidas">
                  <div className="grid grid-cols-2 gap-3">
                    <Link href="/encomendas">
                      <Button variant="outline" className="w-full h-auto py-4 flex-col gap-1.5">
                        <QrCode className="h-5 w-5" />
                        <span className="text-xs">Validar QR/PIN</span>
                      </Button>
                    </Link>
                    <Link href="/encomendas">
                      <Button variant="outline" className="w-full h-auto py-4 flex-col gap-1.5">
                        <PackagePlus className="h-5 w-5" />
                        <span className="text-xs">Receber Encomenda</span>
                      </Button>
                    </Link>
                    <Link href="/incidentes">
                      <Button variant="outline" className="w-full h-auto py-4 flex-col gap-1.5">
                        <AlertCircle className="h-5 w-5" />
                        <span className="text-xs">Registrar Incidente</span>
                      </Button>
                    </Link>
                    <Link href="/reservas/agenda">
                      <Button variant="outline" className="w-full h-auto py-4 flex-col gap-1.5">
                        <CalendarDays className="h-5 w-5" />
                        <span className="text-xs">Consultar Reservas</span>
                      </Button>
                    </Link>
                  </div>
                </SectionCard>

                {/* ─── Comunicados ─── */}
                <SectionCard
                  title="Comunicados"
                  actions={
                    data?.comunicados?.length ? (
                      <Button variant="ghost" size="sm" asChild>
                        <Link href="/anuncios">Ver todos <ArrowRight className="ml-1 h-3 w-3" /></Link>
                      </Button>
                    ) : undefined
                  }
                >
                  {!data?.comunicados?.length ? (
                    <EmptyState icon={Megaphone} title="Nenhum comunicado" description="Os comunicados do condomínio aparecerão aqui." />
                  ) : (
                    <div className="divide-y -mx-6">
                      {(data.comunicados || []).map((c) => (
                        <div key={c.id} className="px-6 py-3">
                          <div className="flex items-start gap-2">
                            <Megaphone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{c.titulo}</p>
                              {c.resumo && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.resumo}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>
            </div>

            {/* ─── Encomendas + Reservas ─── */}
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard
                title="Encomendas Pendentes"
                actions={
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/encomendas">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                }
              >
                {!data?.encomendasPendentes?.length ? (
                  <EmptyState icon={Package} title="Nenhuma encomenda pendente" description="As encomendas aguardando retirada aparecerão aqui." />
                ) : (
                  <div className="divide-y -mx-6">
                    {(data.encomendasPendentes || []).map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-3 px-6 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{e.transportadora || "Encomenda"}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.blocoNome}{e.blocoNome && e.unidadeNumero ? " / " : ""}{e.unidadeNumero}
                            {e.chegouEm && <> • {fmtTs(e.chegouEm)}</>}
                          </p>
                        </div>
                        <StatusBadge tone="warning">Aguardando</StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Reservas do Dia"
                actions={
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/reservas/agenda">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                }
              >
                {!data?.reservasHoje?.length ? (
                  <EmptyState icon={CalendarDays} title="Nenhuma reserva hoje" description="As reservas do dia aparecerão aqui." />
                ) : (
                  <div className="divide-y -mx-6">
                    {(data.reservasHoje || []).map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 px-6 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.areaNome || "Reserva"}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.horarioInicio} – {r.horarioFim}
                            {r.moradorNome && <> • {r.moradorNome}</>}
                            {r.unidadeNumero && <> • {r.unidadeNumero}</>}
                          </p>
                        </div>
                        <StatusBadge tone="success">Aprovada</StatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* ─── Incidentes Abertos ─── */}
            <SectionCard
              title="Incidentes Abertos"
              actions={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/incidentes">Ver todos <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              }
            >
              {!data?.incidentesAbertos?.length ? (
                <EmptyState icon={AlertTriangle} title="Nenhum incidente aberto" description="Os incidentes em aberto aparecerão aqui." />
              ) : (
                <div className="divide-y -mx-6">
                  {(data.incidentesAbertos || []).map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-3 px-6 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{i.titulo || "Sem título"}</p>
                        <p className="text-xs text-muted-foreground">
                          {i.tipo && <>{i.tipo} • </>}
                          {i.local || "—"}
                          {i.createdAt && <> • {fmtDate(i.createdAt)}</>}
                        </p>
                      </div>
                      <StatusBadge tone={statusTone(i.status)}>{statusLabel(i.status)}</StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </AppLayout>
  );
}
