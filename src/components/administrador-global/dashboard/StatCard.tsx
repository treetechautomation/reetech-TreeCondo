import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StatAccent } from "./mock-data";

const ACCENT_CLASSES: Record<StatAccent, string> = {
  cyan: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20",
  emerald: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  amber: "text-amber-300 bg-amber-400/10 border-amber-400/20",
  violet: "text-violet-300 bg-violet-400/10 border-violet-400/20",
  rose: "text-rose-300 bg-rose-400/10 border-rose-400/20",
  slate: "text-slate-300 bg-slate-400/10 border-slate-400/20",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "slate",
  demo = false,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  accent?: StatAccent;
  demo?: boolean;
}) {
  return (
    <Card className={cn("border-white/5 bg-slate-900 text-white shadow-lg shadow-black/20", demo && "opacity-60")}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-xs font-medium text-white/50">{label}</div>
            {demo && (
              <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/40">
                Em breve
              </span>
            )}
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
          {hint && <div className="mt-1 truncate text-xs text-white/40">{hint}</div>}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", ACCENT_CLASSES[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
