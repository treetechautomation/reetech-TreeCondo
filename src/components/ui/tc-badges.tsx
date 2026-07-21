"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function normalize(v?: string | null) {
  return String(v ?? "").trim().toUpperCase();
}

export function TcPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 shadow-sm",
        className
      )}
    >
      {children}
    </span>
  );
}

export function CategoriaBadge({
  categoria,
  className,
}: {
  categoria?: string | null;
  className?: string;
}) {
  const c = normalize(categoria);

  const map: Record<string, string> = {
    EXTINTORES: "bg-destructive/15 text-destructive border-destructive/20",
    ELEVADOR: "bg-indigo-100 text-indigo-700 border-indigo-200",
    CAIXA_DAGUA: "bg-info/15 text-info border-info/20",
    "CAIXA D'AGUA": "bg-info/15 text-info border-info/20",
    DEDETIZACAO: "bg-warning/20 text-warning-foreground border-warning/30",
    OUTROS: "bg-slate-100 text-slate-700 border-border",
  };

  const cls = map[c] ?? "bg-slate-100 text-slate-700 border-border";

  return (
    <Badge
      className={cn(
        "border shadow-sm px-2.5 py-0.5 font-semibold tracking-wide hover:bg-transparent",
        cls,
        className
      )}
    >
      {categoria ?? "-"}
    </Badge>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  const s = normalize(status);

  // enquetes
  if (s === "ABERTA")
    return (
      <Badge
        className={cn(
          "border px-2.5 py-0.5 font-semibold shadow-sm bg-success/15 text-success border-success/20 hover:bg-success/20",
          className
        )}
      >
        ABERTA
      </Badge>
    );

  if (s === "ENCERRADA")
    return (
      <Badge
        className={cn(
          "border px-2.5 py-0.5 font-semibold shadow-sm bg-destructive/15 text-destructive border-destructive/20 hover:bg-destructive/20",
          className
        )}
      >
        ENCERRADA
      </Badge>
    );


  // manutenção / rotinas
  if (s === "CONCLUIDA" || s === "CONCLUÍDA")
    return (
      <Badge
        className={cn(
          "border px-2.5 py-0.5 font-semibold shadow-sm bg-success/15 text-success border-success/20 hover:bg-success/20",
          className
        )}
      >
        CONCLUÍDA
      </Badge>
    );

  if (s === "PROGRAMADA")
    return (
      <Badge
        className={cn(
          "border px-2.5 py-0.5 font-semibold shadow-sm bg-slate-100 text-slate-700 border-border hover:bg-slate-200",
          className
        )}
      >
        PROGRAMADA
      </Badge>
    );

  if (s === "ATIVA")
    return (
      <Badge
        className={cn(
          "border px-2.5 py-0.5 font-semibold shadow-sm bg-success/15 text-success border-success/20 hover:bg-success/20",
          className
        )}
      >
        ATIVA
      </Badge>
    );

  if (s === "PAUSADA")
    return (
      <Badge
        className={cn(
          "border px-2.5 py-0.5 font-semibold shadow-sm bg-warning/20 text-warning-foreground border-warning/30 hover:bg-warning/30",
          className
        )}
      >
        PAUSADA
      </Badge>
    );
  // fallback
  return (
    <Badge
      className={cn(
        "border px-2.5 py-0.5 font-semibold shadow-sm bg-slate-100 text-slate-700 border-border hover:bg-slate-200",
        className
      )}
    >
      {status ?? "-"}
    </Badge>
  );
}

export function AlertaBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: "neutral" | "danger" | "warning" | "success";
  className?: string;
}) {
  const toneMap = {
    neutral: "bg-slate-100 text-slate-700 border-border",
    danger: "bg-destructive/15 text-destructive border-destructive/20",
    warning: "bg-warning/20 text-warning-foreground border-warning/30",
    success: "bg-success/15 text-success border-success/20",
  } as const;

  return (
    <Badge
      className={cn(
        "border px-2.5 py-0.5 font-semibold shadow-sm hover:bg-transparent",
        toneMap[tone],
        className
      )}
    >
      {label}
    </Badge>
  );
}
