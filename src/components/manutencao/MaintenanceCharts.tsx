"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ExecItem,
  getLast12Months,
  computeMonthlyData,
  computeMonthlyVolumes,
  computeCategoryData,
  computeConformidadeTrend,
  type MonthlyData,
  type CategoryData,
} from "./maintenanceAnalyticsUtils";

const DARK_CHART_THEME = {
  grid: "rgba(255,255,255,0.06)",
  text: "rgba(255,255,255,0.40)",
  tooltipBg: "rgba(15,23,42,0.95)",
  tooltipBorder: "rgba(255,255,255,0.1)",
};

const COLORS = ["#00D0E6", "#f97316", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];

interface MaintenanceChartsProps {
  items: ExecItem[];
  months?: number;
  loading: boolean;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-white/[0.06] bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5 animate-in fade-in duration-300" role="region" aria-label={title}>
      <h4 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">{title}</h4>
      {children}
    </Card>
  );
}

function EmptyChart({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-[200px] text-xs text-white/30" role="status">
      {msg}
    </div>
  );
}

export default function MaintenanceCharts({ items, months: monthsProp, loading }: MaintenanceChartsProps) {
  const months = React.useMemo(() => getLast12Months().slice(-(monthsProp || 6)), [monthsProp]);
  const monthlyData = React.useMemo(() => computeMonthlyData(items, months), [items, months]);
  const volumeData = React.useMemo(() => computeMonthlyVolumes(items, months), [items, months]);
  const categoryData = React.useMemo(() => computeCategoryData(items), [items]);
  const conformidadeData = React.useMemo(() => computeConformidadeTrend(items, months), [items, months]);

  const hasData = items.length > 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        style={{
          background: DARK_CHART_THEME.tooltipBg,
          border: `1px solid ${DARK_CHART_THEME.tooltipBorder}`,
          borderRadius: "12px",
          padding: "8px 12px",
          fontSize: "12px",
          color: "#f8fafc",
        }}
      >
        <p className="font-bold mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <ChartCard key={i} title="">
            <Skeleton className="h-[200px] w-full bg-white/10 rounded-xl" />
          </ChartCard>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Chart 1 — Manutenções por mês */}
      <ChartCard title="Manutenções por mês">
        {!hasData ? (
          <EmptyChart msg="Sem dados para exibir." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={DARK_CHART_THEME.grid} />
              <XAxis dataKey="month" tick={{ fill: DARK_CHART_THEME.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: DARK_CHART_THEME.text, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", color: DARK_CHART_THEME.text }}
                iconType="circle"
              />
              <Bar dataKey="programadas" name="Programadas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="emAndamento" name="Em andamento" fill="#f97316" radius={[4, 4, 0, 0]} />
              <Bar dataKey="concluidas" name="Concluídas" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 2 — Distribuição por categoria */}
      <ChartCard title="Distribuição por categoria">
        {!hasData ? (
          <EmptyChart msg="Sem dados para exibir." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "10px", color: DARK_CHART_THEME.text }}
                iconType="circle"
                layout="vertical"
                align="right"
                verticalAlign="middle"
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 3 — Conformidade */}
      <ChartCard title="Conformidade mensal (%)">
        {!hasData ? (
          <EmptyChart msg="Sem dados para exibir." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={conformidadeData}>
              <CartesianGrid strokeDasharray="3 3" stroke={DARK_CHART_THEME.grid} />
              <XAxis dataKey="month" tick={{ fill: DARK_CHART_THEME.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: DARK_CHART_THEME.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="conformidade"
                name="Conformidade %"
                stroke="#00D0E6"
                strokeWidth={2.5}
                dot={{ fill: "#00D0E6", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Chart 4 — Volume de Execuções */}
      <ChartCard title="Programadas vs Concluídas">
        {!hasData ? (
          <EmptyChart msg="Sem dados para exibir." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke={DARK_CHART_THEME.grid} />
              <XAxis dataKey="month" tick={{ fill: DARK_CHART_THEME.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: DARK_CHART_THEME.text, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", color: DARK_CHART_THEME.text }}
                iconType="circle"
              />
              <Bar dataKey="programadas" name="Programadas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="concluidas" name="Concluídas" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
