"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type AreaOpcao = {
  id: string;
  nome: string;
  preco: number; // centavos
  bloqueiaAreaId?: string | null;
};

export type AreaReservavelUI = {
  id: string;
  nome: string;
  preco: number; // centavos (base)
  ativo: boolean;
  tipo?: string | null;
  fotoUrl?: string | null;
  fotoHint?: string | null;
  capacidadeMax?: number | null;
  opcoes?: AreaOpcao[] | null;
};

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatBRLFromCentavos(centavos: number) {
  const v = toNum(centavos, 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function minOptionPrice(area: AreaReservavelUI) {
  const ops = area.opcoes ?? [];
  if (!Array.isArray(ops) || ops.length === 0) return null;

  let min = Number.POSITIVE_INFINITY;
  for (const o of ops) {
    const p = toNum((o as any)?.preco, NaN);
    if (Number.isFinite(p)) min = Math.min(min, p);
  }
  return Number.isFinite(min) ? min : null;
}

export function AreaCard({
  area,
  selected,
  onSelect,
  children,
  availability = "available",
  availabilityLabel = null,
  action = null,
}: {
  area: AreaReservavelUI;
  selected: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
  availability?: "available" | "queued" | "unavailable";
  availabilityLabel?: string | null;
  action?: React.ReactNode;
}) {
  const min = minOptionPrice(area);
  const hasOptions = min !== null && (area.opcoes?.length ?? 0) > 0;

  const displayPrice = hasOptions ? min! : toNum(area.preco, 0);
  const priceLabel = hasOptions
    ? `A partir de ${formatBRLFromCentavos(displayPrice)}`
    : formatBRLFromCentavos(displayPrice);

  const availabilityClass =
    availability === "unavailable"
      ? "border-destructive/30 bg-destructive/10"
      : availability === "queued"
        ? "border-[#FFDE21]/60 bg-[#FFDE21]/15"
        : "border-emerald-500/30 bg-emerald-500/10";

  return (
    <div
      className={cn(
        "w-full rounded-2xl border backdrop-blur-2xl shadow-sm transition-colors",
        availabilityClass,
        selected ? "ring-2 ring-primary/30" : ""
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          "group h-auto w-full rounded-2xl p-3 transition cursor-pointer",
          "hover:bg-background/60 hover:text-foreground"
        )}
      >
        <div className="flex w-full flex-col gap-3">
            {/* FOTO (topo) */}
            <div className="h-[220px] w-full overflow-hidden rounded-2xl border bg-muted/30">
              {area.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={area.fotoUrl}
                  alt={area.nome}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  data-ai-hint={area.fotoHint ?? undefined}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
                  SEM FOTO
                </div>
              )}
            </div>

            {/* NOME + PREÇO (embaixo da imagem) */}
            <div className="w-full text-left">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-foreground whitespace-normal break-words">
                    {area.nome}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {priceLabel}
                  </div>

                  {Number.isFinite(Number(area.capacidadeMax)) &&
                    Number(area.capacidadeMax) > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Capacidade:{" "}
                        <span className="font-medium text-foreground">
                          {Number(area.capacidadeMax)}
                        </span>{" "}
                        pessoas
                      </div>
                    )}
                </div>

                {hasOptions && (
                  <span className="shrink-0 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
                    opções
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {selected ? (
                  <Badge>Selecionado</Badge>
                ) : null}
                {availabilityLabel ? (
                  <Badge variant="outline">{availabilityLabel}</Badge>
                ) : null}
              </div>
            </div>
          </div>
        </div>

      {/* CALENDÁRIO SEMPRE ABAIXO */}
      <div className="px-3 pb-3">
        {children}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
