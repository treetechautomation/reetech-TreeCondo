"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  if (status === "CONCLUIDA") return <Badge variant="secondary">CONCLUÍDA</Badge>;
  if (diff < 0) return <Badge className="bg-red-100 text-red-800">ATRASADA {Math.abs(diff)}d</Badge>;
  if (diff === 0) return <Badge className="bg-emerald-100 text-emerald-800">HOJE</Badge>;
  if (diff <= 7) return <Badge className="bg-yellow-100 text-yellow-800">EM {diff}d</Badge>;

  return <Badge variant="secondary">EM {diff}d</Badge>;
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
      <Card className="border-white/20 bg-white/28 backdrop-blur-2xl shadow-[0_18px_55px_rgba(2,6,23,0.12)]">
        <CardHeader>
          <CardTitle>Calendário de Manutenções</CardTitle>
          <CardDescription>Visualize as manutenções programadas do condomínio.</CardDescription>
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
            <h4 className="font-semibold mb-3">Eventos do dia {selectedDateStr}</h4>
            {eventosDoDia.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma manutenção para este dia.</p>
            ) : (
              <div className="space-y-3">
                {eventosDoDia.map((e) => (
                  <div key={e.id} className="p-4 rounded-xl border bg-muted/10">
                    <p className="font-semibold truncate">{e.titulo}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {e.categoria && <Badge variant="outline">{e.categoria}</Badge>}
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
