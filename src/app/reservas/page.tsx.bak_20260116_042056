"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useReservas } from "@/hooks/useReservas";

function moneyBRLFromCentavos(v?: number) {
  const n = Number(v ?? 0) / 100;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ReservasPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const condId = session?.activeCondominioId ?? null;

  const [dateStr, setDateStr] = React.useState(() => toISODateLocal(new Date()));
  const [areaFilter, setAreaFilter] = React.useState<string | "ALL">("ALL");

  const { areas, reservas, loadingAreas, loadingReservas } = useReservas(condId, dateStr);

  const reservasFiltradas = React.useMemo(() => {
    if (areaFilter === "ALL") return reservas;
    return reservas.filter((r) => r.areaId === areaFilter);
  }, [reservas, areaFilter]);

  const podeVer = !isSessionLoading && !!session && !!condId;
  const role = session?.role ?? null;

  return (
    <AppLayout pageTitle="Reservas" headerActions={null}>
      {!podeVer ? (
        <div className="rounded-2xl border bg-card p-6">
          <div className="text-sm text-muted-foreground">Carregando sessão/condomínio...</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top bar: data */}
          <div className="rounded-2xl border bg-card p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm text-muted-foreground">Dia</div>
              <input
                className="h-10 rounded-xl border bg-background px-3 text-sm"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Placeholder para próxima etapa (criar reserva / aprovar / check-in) */}
              {role === "MORADOR" && (
                <Button variant="default" disabled>
                  Nova reserva (próxima etapa)
                </Button>
              )}
              {(role === "SINDICO" || role === "ADMIN") && (
                <Button variant="default" disabled>
                  Aprovar / Bloquear (próxima etapa)
                </Button>
              )}
              {role === "PORTEIRO" && (
                <Button variant="secondary" disabled>
                  Registrar entrada (próxima etapa)
                </Button>
              )}
            </div>
          </div>

          {/* Áreas */}
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Áreas reserváveis</div>
              <div className="text-xs text-muted-foreground">
                {loadingAreas ? "Carregando..." : `${areas.length} área(s)`}
              </div>
            </div>

            {loadingAreas ? (
              <div className="mt-4 text-sm text-muted-foreground">Buscando áreas...</div>
            ) : areas.length === 0 ? (
              <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-sm">
                <div className="font-medium">Nenhuma área configurada neste condomínio.</div>
                <div className="mt-1 text-muted-foreground">
                  Isso é intencional e permite ter condomínios diferentes (com ou sem churrasqueira, campo, etc.)
                  sem quebrar o app.
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant={areaFilter === "ALL" ? "default" : "secondary"}
                  onClick={() => setAreaFilter("ALL")}
                >
                  Todas
                </Button>

                {areas.map((a) => (
                  <Button
                    key={a.id}
                    variant={areaFilter === a.id ? "default" : "secondary"}
                    onClick={() => setAreaFilter(a.id)}
                    title={a.descricao ?? undefined}
                  >
                    {a.nome} · {moneyBRLFromCentavos(a.preco)}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Reservas do dia */}
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Reservas do dia</div>
              <div className="text-xs text-muted-foreground">
                {loadingReservas ? "Carregando..." : `${reservasFiltradas.length} reserva(s)`}
              </div>
            </div>

            {loadingReservas ? (
              <div className="mt-4 text-sm text-muted-foreground">Buscando reservas...</div>
            ) : reservasFiltradas.length === 0 ? (
              <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                Nenhuma reserva encontrada para este dia.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {reservasFiltradas.map((r) => (
                  <div key={r.id} className="rounded-xl border p-4 flex flex-col gap-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">
                        Área: <span className="text-muted-foreground">{r.areaId}</span>
                      </div>
                      <div className="text-sm">
                        Status: <span className="font-semibold">{r.status}</span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Valor: {moneyBRLFromCentavos(r.valorCobrado)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Reserva ID: {r.id} • UID: {r.uid}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
