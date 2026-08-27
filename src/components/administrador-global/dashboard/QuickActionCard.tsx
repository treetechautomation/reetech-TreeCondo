import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function QuickActionCard({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <div
      aria-disabled="true"
      title="Ainda não implementado"
      className="flex cursor-not-allowed flex-col items-start gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-4 text-white/40 transition-colors"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="outline" className="border-white/10 px-1.5 py-0 text-[10px] text-white/40">
          Em breve
        </Badge>
      </div>
    </div>
  );
}
