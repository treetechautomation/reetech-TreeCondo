"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import { CalendarMonthManutencao, type ManutencaoExec } from "@/components/manutencao/CalendarMonthManutencao";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function badgeForStatus(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (s.includes("PEND")) return "secondary";
  if (s.includes("AGEND")) return "secondary";
  if (s.includes("EXEC")) return "default";
  if (s.includes("CONCL")) return "default";
  if (s.includes("CANC")) return "destructive";
  return "outline";
}

export default function CalendarioManutencaoPage() {
  const { session } = useSessionCtx();
  const firestore = useFirestore();

  const condominioId = session?.activeCondominioId ?? null;

  const [dateStr, setDateStr] = React.useState<string>(() => todayISO());
  const [byDay, setByDay] = React.useState<Record<string, ManutencaoExec[]>>({});

  const events = byDay[dateStr] || [];

  return (
    <AppLayout pageTitle="Calendário de Manutenções">
      <Card>
        <CardHeader>
          <CardTitle>Calendário</CardTitle>
          <CardDescription>
            Visualize as manutenções programadas do condomínio e selecione um dia para ver os detalhes.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <CalendarMonthManutencao
              firestore={firestore as any}
              condominioId={condominioId}
              selectedDateStr={dateStr}
              onSelectDateStr={setDateStr}
              onMonthData={({ byDay }) => setByDay(byDay)}
            />
          </div>

          <div className="w-full md:w-1/3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Eventos do dia</h4>
              <div className="text-xs text-muted-foreground">{dateStr}</div>
            </div>

            <div className="mt-3 space-y-3">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma manutenção registrada para este dia.</p>
              ) : (
                events.map((e) => (
                  <div key={e.id} className="p-3 rounded-md border bg-muted/30">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{e.titulo}</div>
                      {e.status ? <Badge variant={badgeForStatus(e.status)}>{e.status}</Badge> : null}
                    </div>

                    {e.categoria ? (
                      <div className="mt-2">
                        <Badge variant="outline">{String(e.categoria).replaceAll("_", " ")}</Badge>
                      </div>
                    ) : null}

                    {e.fornecedorNome ? (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Fornecedor: <span className="font-medium">{e.fornecedorNome}</span>
                      </div>
                    ) : null}

                    <div className="mt-2 text-[11px] text-muted-foreground">
                      ID: {e.id}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
