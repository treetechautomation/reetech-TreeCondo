"use client";

import * as React from "react";
import { AreaCard } from "@/components/reservas/AreaCard";
import { AreaOpcaoDialog } from "@/components/reservas/AreaOpcaoDialog";
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
  const [selectedAreaId, setSelectedAreaId] = React.useState<string>("ALL");

  // Modal de opções (Churrasqueira 2 etc.)
  const [opcoesOpen, setOpcoesOpen] = React.useState(false);
  const [areaParaOpcaoId, setAreaParaOpcaoId] = React.useState<string | null>(null);

  // "base" ou id da opção (ex: "com_quadra")
  const [selectedOpcaoId, setSelectedOpcaoId] = React.useState<string | null>(null);

  // Guarda info completa da opção selecionada (para usar na “próxima etapa”)
  const [selectedOpcaoMeta, setSelectedOpcaoMeta] = React.useState<{
    opcaoId: string;
    opcaoNome: string;
    precoCentavos: number;
    bloqueiaAreaId?: string | null;
  } | null>(null);

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

  function handleSelectAll() {
    setSelectedAreaId("ALL");
    setAreaFilter("ALL");
    setSelectedOpcaoId(null);
    setSelectedOpcaoMeta(null);
    setAreaParaOpcaoId(null);
    setOpcoesOpen(false);
  }

  function handleSelectArea(area: any) {
    if (!area?.id) return;

    // seleciona o card + filtra as reservas por área (UX melhor)
    setSelectedAreaId(area.id);
    setAreaFilter(area.id);

    const hasOpcoes = Array.isArray(area.opcoes) && area.opcoes.length > 0;

    if (hasOpcoes) {
      // abre modal para escolher qual opção (ex: churrasqueira 2 + quadra)
      setAreaParaOpcaoId(area.id);
      setOpcoesOpen(true);
      return;
    }

    // sem opções => é base
    setAreaParaOpcaoId(null);
    setSelectedOpcaoId("base");
    setSelectedOpcaoMeta({
      opcaoId: "base",
      opcaoNome: String(area.nome ?? area.id),
      precoCentavos: Number(area.preco || 0),
      bloqueiaAreaId: null,
    });
  }

  return (
    <AppLayout pageTitle="Reservas" headerActions={null}>
      {!podeVer ? (
        <div className="rounded-2xl border bg-card p-6">
          <div className="text-sm text-muted-foreground">Carregando sessão/condomínio...</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top bar: data */}
          <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between shadow-sm">
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
          <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-4 shadow-sm">
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
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={areaFilter === "ALL" ? "default" : "secondary"}
                    onClick={handleSelectAll}
                  >
                    Todas
                  </Button>
                </div>

                <div className="flex flex-col gap-3">
                  {areas.map((a) => (
                    <AreaCard
                      key={a.id}
                      area={a as any}
                      selected={selectedAreaId === a.id}
                      onSelect={() => handleSelectArea(a as any)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reservas do dia */}
          <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-4 shadow-sm">
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

          {/* Modal: opções (Churrasqueira 2 etc.) */}
          {(() => {
            const area = areas.find((x: any) => x.id === areaParaOpcaoId);
            if (!area) return null;

            return (
              <AreaOpcaoDialog
                open={opcoesOpen}
                onOpenChange={setOpcoesOpen}
                areaNome={String(area.nome ?? area.id)}
                precoBaseCentavos={Number(area.preco || 0)}
                opcoes={(area.opcoes || []) as any}
                selectedOpcaoId={selectedOpcaoId}
                onConfirm={(p) => {
                  setSelectedOpcaoId(p.opcaoId);
                  setSelectedOpcaoMeta(p);

                  // mantém seleção do card e filtro
                  setSelectedAreaId(area.id);
                  setAreaFilter(area.id);
                }}
              />
            );
          })()}
        </div>
      )}
    </AppLayout>
  );
}
