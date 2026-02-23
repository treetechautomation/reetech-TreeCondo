"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertaBadge, CategoriaBadge, TcPill } from "@/components/ui/tc-badges";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import { CalendarMonthManutencao, type ManutencaoExec } from "@/components/manutencao/CalendarMonthManutencao";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function toISODateLocal(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function startOfTodayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function diffDaysLocal(isoDay: string) {
  const [y, m, d] = isoDay.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  const today = startOfTodayLocal();
  const ms = dt.getTime() - today.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function alertaBadge(exec: ManutencaoExec) {
  const status = String(exec.status ?? "").toUpperCase();
  const diff = diffDaysLocal(exec.isoDay);

  if (status === "CONCLUIDA") return <AlertaBadge tone="success" label="CONCLUÍDA" />;
  if (diff < 0) return <AlertaBadge tone="danger" label={`ATRASADA ${Math.abs(diff)}d`} />;
  if (diff === 0) return <AlertaBadge tone="success" label="HOJE" className="bg-emerald-600 text-white border border-emerald-400/40 shadow-sm" />;
  if (diff <= 7) return <AlertaBadge tone="warning" label={`EM ${diff}d`} />;

  return <AlertaBadge tone="neutral" label={`EM ${diff}d`} />;
}


export default function CalendarioManutencaoPage() {
  const firestore = useFirestore();
  const { session } = useSessionCtx();
  const condominioId = session?.activeCondominioId ?? null;

  const [selectedDateStr, setSelectedDateStr] = React.useState(() => toISODateLocal(new Date()));
  const [monthByDay, setMonthByDay] = React.useState<Record<string, ManutencaoExec[]>>({});

  const eventosDoDia = monthByDay[selectedDateStr] || [];

  return (
    <AppLayout pageTitle="Calendário de Manutenções">
      <Card className="border-white/15 bg-white/12 backdrop-blur-2xl shadow-[0_18px_55px_rgba(2,6,23,0.18)] text-white">
        <CardHeader>
          <CardTitle className="text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]">Calendário de Manutenções</CardTitle>
          <CardDescription className="text-white/70">Visualize as manutenções programadas do condomínio.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <CalendarMonthManutencao
              firestore={firestore}
              condominioId={condominioId}
              selectedDateStr={selectedDateStr}
              onSelectDateStr={setSelectedDateStr}
              onMonthData={({ byDay }) => setMonthByDay(byDay || {})}
            />
          </div>
          <div className="w-full md:w-1/3">
            <h4 className="font-semibold mb-3 tracking-wide text-white/90">
  <span className="drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]">Eventos do dia</span>
  <TcPill className="ml-2">{selectedDateStr}</TcPill>
</h4>
            {eventosDoDia.length === 0 ? (
              <p className="text-sm text-white/75">Nenhuma manutenção para este dia.</p>
            ) : (
              <div className="space-y-3">
                {eventosDoDia.map((e) => (
                  <div key={e.id} className="p-4 rounded-xl border border-white/20 bg-white/10 text-white">
                    <p className="font-semibold truncate text-white/95 drop-shadow-[0_1px_0_rgba(0,0,0,0.25)]">{e.titulo}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {e.categoria && <CategoriaBadge categoria={e.categoria} />}
                      {alertaBadge(e)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
