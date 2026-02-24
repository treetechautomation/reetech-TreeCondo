"use client";

import * as React from "react";

export default function Loading() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center">
      <div className="relative w-full max-w-md px-6">
        {/* Glow premium */}
        <div
          className="pointer-events-none absolute -inset-10 opacity-80 blur-3xl"
          style={{
            background:
              "radial-gradient(600px circle at 20% 10%, rgba(0,208,230,.30), transparent 55%)," +
              "radial-gradient(600px circle at 80% 25%, rgba(11,31,58,.35), transparent 55%)," +
              "radial-gradient(600px circle at 60% 90%, rgba(22,101,52,.22), transparent 55%)",
          }}
        />

        {/* Card */}
        <div className="relative rounded-3xl border border-white/15 bg-white/10 backdrop-blur-2xl shadow-[0_25px_80px_rgba(0,0,0,.35)] overflow-hidden">
          {/* Barra premium */}
          <div className="h-2 w-full bg-[linear-gradient(90deg,#00d0e6_0%,#0b1f3a_52%,#166534_100%)]" />

          <div className="p-6">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="h-14 w-14 rounded-2xl bg-[linear-gradient(135deg,#00d0e6_0%,#0b1f3a_55%,#166534_100%)] shadow-[0_10px_40px_rgba(0,208,230,.22)]" />
              <div className="text-lg font-semibold text-white">TreeCondo</div>
              <div className="text-sm text-white/70">Iniciando seu painel…</div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-2/3 rounded-full bg-[linear-gradient(90deg,#00d0e6_0%,#0b1f3a_52%,#166534_100%)] animate-pulse" />
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-white/60">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00d0e6] animate-pulse" />
                <span>Carregando módulos essenciais</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
