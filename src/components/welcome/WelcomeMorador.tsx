"use client";

import * as React from "react";
import { useBranding } from "@/contexts/BrandingContext";
import { useSession } from "@/hooks/useSession";
import Image from "next/image";

export default function WelcomeMorador() {
  const branding = useBranding();


  const { session, isSessionLoading } = useSession();
  const user = session?.user ?? null;

  if (isSessionLoading || !user) return null;

  const nome = user.displayName?.trim() || "Bem-vindo";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-6 shadow-[0_10px_30px_rgba(0,0,0,.08)] backdrop-blur">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-indigo-500/10" />
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />

      <div className="relative flex items-center gap-4">
        <Image
            src={branding.logoUrl}
            alt="Logo TreeCondo"
            width={180}
            height={180}
            className="rounded-full border-4 border-white/50 shadow-lg"
        />
        <div className="flex-1">
            <div className="text-xs font-medium text-slate-700/80">
              TreeCondo • Seu painel
            </div>

            <div className="mt-1 text-2xl font-semibold text-slate-900">
              Olá, {nome} 👋
            </div>
        </div>
      </div>
       <div className="relative mt-4">
        <p className="text-sm text-slate-700 max-w-2xl">
          Aqui você encontra avisos do condomínio, reservas, documentos e tudo o que precisa
          para o dia a dia. Qualquer novidade importante vai aparecer primeiro aqui.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-700/90">
          <span className="rounded-full border border-black/10 bg-white/40 px-3 py-1">📌 Avisos</span>
          <span className="rounded-full border border-black/10 bg-white/40 px-3 py-1">📅 Reservas</span>
          <span className="rounded-full border border-black/10 bg-white/40 px-3 py-1">📄 Documentos</span>
          <span className="rounded-full border border-black/10 bg-white/40 px-3 py-1">🗳️ Enquetes</span>
        </div>
      </div>
    </div>
  );
}
