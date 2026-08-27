"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export default function MaintenanceFloatingAction() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/manutencao-preventiva/rotinas")}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-[#00D0E6] hover:bg-[#00B4CC] text-slate-950 shadow-[0_8px_30px_rgba(0,208,230,0.3)] hover:shadow-[0_8px_40px_rgba(0,208,230,0.4)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center group animate-in fade-in slide-in-from-bottom-4"
      aria-label="Criar nova rotina de manutenção"
    >
      <Plus className="h-6 w-6 transition-transform group-hover:rotate-90 duration-300" />
      <span className="absolute right-16 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 shadow-lg">
        Nova Rotina
      </span>
    </button>
  );
}
