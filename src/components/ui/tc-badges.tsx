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
        "inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm",
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
    EXTINTORES: "bg-rose-500/25 text-rose-50 border-rose-300/30",
    ELEVADOR: "bg-violet-500/25 text-violet-50 border-violet-300/30",
    CAIXA_DAGUA: "bg-sky-500/25 text-sky-50 border-sky-300/30",
    "CAIXA D'AGUA": "bg-sky-500/25 text-sky-50 border-sky-300/30",
    DEDETIZACAO: "bg-amber-500/25 text-amber-50 border-amber-300/30",
    OUTROS: "bg-white/10 text-white/85 border-white/15",
  };

  const cls = map[c] ?? "bg-white/10 text-white/85 border-white/15";

  return (
    <Badge
      className={cn(
        "border shadow-sm px-2.5 py-0.5 font-semibold tracking-wide",
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
          "border px-2.5 py-0.5 font-semibold shadow-sm bg-emerald-600/25 text-emerald-100 border-emerald-400/30",
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
          "border px-2.5 py-0.5 font-semibold shadow-sm bg-red-600/25 text-red-100 border-red-400/30",
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
          "border px-2.5 py-0.5 font-semibold shadow-sm bg-emerald-600/25 text-emerald-100 border-emerald-400/30",
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
          "border px-2.5 py-0.5 font-semibold shadow-sm bg-white/10 text-white/85 border-white/15",
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
          "border px-2.5 py-0.5 font-semibold shadow-sm bg-emerald-600/25 text-emerald-100 border-emerald-400/30",
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
          "border px-2.5 py-0.5 font-semibold shadow-sm bg-amber-500/25 text-amber-100 border-amber-300/30",
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
        "border px-2.5 py-0.5 font-semibold shadow-sm bg-white/10 text-white/85 border-white/15",
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
    neutral: "bg-white/10 text-white/85 border-white/15",
    danger: "bg-red-600/25 text-red-100 border-red-400/30",
    warning: "bg-amber-500/25 text-amber-100 border-amber-300/30",
    success: "bg-emerald-600/25 text-emerald-100 border-emerald-400/30",
  } as const;

  return (
    <Badge
      className={cn(
        "border px-2.5 py-0.5 font-semibold shadow-sm",
        toneMap[tone],
        className
      )}
    >
      {label}
    </Badge>
  );
}
