"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
}: {
  area: AreaReservavelUI;
  selected: boolean;
  onSelect: () => void;
}) {
  const min = minOptionPrice(area);
  const hasOptions = min !== null && (area.opcoes?.length ?? 0) > 0;

  const displayPrice = hasOptions ? min! : toNum(area.preco, 0);
  const priceLabel = hasOptions
    ? `A partir de ${formatBRLFromCentavos(displayPrice)}`
    : formatBRLFromCentavos(displayPrice);

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onSelect}
      className={cn(
        "group h-auto w-full justify-start rounded-2xl border bg-background/40 p-3 shadow-sm transition",
        "hover:bg-background/60 hover:text-foreground",
        "data-[state=open]:text-foreground",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border/60",
      )}
    >
      <div className="flex w-full items-center gap-4">
        {/* FOTO 120x120 */}
        <div className="h-[150px] w-[150px] shrink-0 overflow-hidden rounded-2xl border bg-muted/30">
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

        {/* TEXTO */}
        <div className="min-w-0 flex-1 text-foreground">
          <div className="flex items-start gap-2">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-foreground">{area.nome}</div>
              <div className="mt-1 text-sm text-muted-foreground group-hover:text-muted-foreground">{priceLabel}</div>
            </div>

            {hasOptions && (
              <span className="ml-auto shrink-0 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground group-hover:text-muted-foreground">
                opções
              </span>
            )}
          </div>

          {selected && (
            <div className="mt-2 text-xs text-muted-foreground">
              Selecionado
            </div>
          )}
        </div>
      </div>
    </Button>
  );
}
