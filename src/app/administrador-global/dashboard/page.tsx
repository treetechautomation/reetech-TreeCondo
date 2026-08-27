"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardGrid } from "@/components/administrador-global/dashboard/DashboardGrid";
import { DashboardSection } from "@/components/administrador-global/dashboard/DashboardSection";
import { StatCard } from "@/components/administrador-global/dashboard/StatCard";
import { DashboardCard } from "@/components/administrador-global/dashboard/DashboardCard";
import { QuickActionCard } from "@/components/administrador-global/dashboard/QuickActionCard";
import { EmptyCard } from "@/components/administrador-global/dashboard/EmptyCard";
import {
  MOCK_STATS,
  MOCK_ACTIVITIES,
  MOCK_QUICK_ACTIONS,
  REAL_STATS_META,
} from "@/components/administrador-global/dashboard/mock-data";
import { useGlobalDashboard } from "@/hooks/useGlobalDashboard";

export default function DashboardOperacionalPage() {
  const dashboard = useGlobalDashboard();

  // Os seis indicadores reais vêm de GET /api/global/dashboard (G1.4/G1.5).
  // Enquanto carrega, não exibimos números — "—" evita simular dado real antes da resposta.
  const realStats = REAL_STATS_META.map((meta) => {
    if (dashboard.status === "success") {
      const raw = dashboard.data[meta.key];
      if (typeof raw === "number" && Number.isFinite(raw)) {
        return { ...meta, value: raw as number | string };
      }
      return { ...meta, value: "—" as number | string, hint: "dado indisponível" };
    }
    if (dashboard.status === "error") {
      return { ...meta, value: "—" as number | string, hint: "falha ao carregar" };
    }
    return { ...meta, value: "—" as number | string, hint: "carregando…" };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard Operacional</h1>
        <p className="mt-1 text-sm text-slate-500">
          Visão consolidada da operação Treetech. Os seis indicadores abaixo usam dados reais do TreeCondo —
          os indicadores comerciais (Clientes, Produtos, Implantações etc.) continuam de demonstração até seus
          módulos existirem.
        </p>
      </div>

      <DashboardSection title="Indicadores reais">
        {dashboard.status === "error" && (
          <DashboardCard
            title="Não foi possível carregar os indicadores"
            description={dashboard.error}
            action={
              <Button variant="outline" size="sm" className="gap-2" onClick={dashboard.reload}>
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            }
          >
            <p className="text-xs text-white/40">Os cards abaixo exibem "—" até uma nova tentativa.</p>
          </DashboardCard>
        )}
        <DashboardGrid>
          {realStats.map((stat) => (
            <StatCard
              key={stat.key}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              hint={stat.hint}
              accent={stat.accent}
            />
          ))}
        </DashboardGrid>
      </DashboardSection>

      <DashboardSection
        title="Indicadores comerciais"
        description="Demonstração — aguardando as entidades de Cliente, Produto e Implantação"
      >
        <DashboardGrid>
          {MOCK_STATS.map((stat) => (
            <StatCard
              key={stat.key}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              hint={stat.hint}
              accent={stat.accent}
              demo
            />
          ))}
        </DashboardGrid>
      </DashboardSection>

      <DashboardSection title="Atividades recentes">
        <DashboardCard
          title="Últimos eventos"
          description="Dados de demonstração — auditoria global real será conectada em fase futura"
        >
          {MOCK_ACTIVITIES.length === 0 ? (
            <EmptyCard />
          ) : (
            <ul className="divide-y divide-white/5">
              {MOCK_ACTIVITIES.map((activity) => (
                <li key={activity.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">{activity.label}</div>
                    <div className="truncate text-xs text-white/40">{activity.detail}</div>
                  </div>
                  <div className="shrink-0 text-xs text-white/30">{activity.time}</div>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </DashboardSection>

      <DashboardSection title="Ações rápidas" description="Em desenvolvimento — parte do escopo comercial (G2+)">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MOCK_QUICK_ACTIONS.map((action) => (
            <QuickActionCard key={action.key} label={action.label} icon={action.icon} />
          ))}
        </div>
      </DashboardSection>
    </div>
  );
}
