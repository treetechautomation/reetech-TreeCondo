"use client";

import * as React from "react";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Fundo premium (degradê igual referência) */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#00d0e6_0%,#0b1f3a_52%,#166534_100%)]" />

      {/* Luz suave premium */}
      <div className="absolute inset-0 opacity-25 bg-[radial-gradient(900px_circle_at_20%_30%,rgba(255,255,255,.38),transparent_55%),radial-gradient(700px_circle_at_80%_65%,rgba(255,255,255,.18),transparent_60%)]" />

      {/* Conteúdo */}
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-5 px-6">
          <div className="rounded-3xl border border-white/25 bg-white/10 p-5 shadow-[0_25px_70px_rgba(0,0,0,.35)] backdrop-blur-2xl">
            <img
              src="/logo-treecondo.jpeg"
              alt="TreeCondo"
              className="h-20 w-20 rounded-2xl object-contain"
            />
          </div>

          <div className="text-center">
            <div className="text-white/95 text-xl font-semibold tracking-wide">
              TreeCondo
            </div>
            <div className="text-white/80 text-sm">
              Gestão inteligente de condomínios
            </div>
          </div>

          {/* Barra premium */}
          <div className="h-1.5 w-44 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full w-1/2 rounded-full bg-white/85"
              style={{ animation: "tc_splash 1.1s ease-in-out infinite" }}
            />
          </div>
        </div>
      </div>

      {/* CSS normal (SEM styled-jsx) */}
      <style>{`
        @keyframes tc_splash {
          0% { transform: translateX(-40%); opacity: .5; }
          50% { transform: translateX(90%); opacity: 1; }
          100% { transform: translateX(-40%); opacity: .5; }
        }
      `}</style>
    </div>
  );
}
