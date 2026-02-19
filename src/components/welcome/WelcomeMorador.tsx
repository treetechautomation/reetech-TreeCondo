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
    <div className="relative overflow-hidden rounded-2xl border border-white/10 p-6 backdrop-blur-2xl
shadow-[0_30px_120px_rgba(0,0,0,.85),0_0_0_1px_rgba(255,255,255,.04),inset_0_0_80px_rgba(0,208,230,.05)]
bg-[linear-gradient(90deg,rgba(0,208,230,.22)_0%,rgba(15,23,42,.55)_48%,rgba(34,197,94,.20)_100%)]">
        {/* WELCOME_ULTRA_LAYER */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,208,230,.22)_0%,rgba(15,23,42,.55)_48%,rgba(34,197,94,.20)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,208,230,.22)_0%,rgba(15,23,42,.55)_48%,rgba(34,197,94,.20)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,208,230,.22)_0%,rgba(15,23,42,.55)_48%,rgba(34,197,94,.20)_100%)]" />

      
      
      

      <div className="relative flex flex-col items-center text-center gap-3">
        <Image
            src={branding.logoUrl}
            alt="Logo TreeCondo"
            width={140}
            height={140}
            className="rounded-full border border-white/15 shadow-[0_0_40px_rgba(0,208,230,.30),0_12px_40px_rgba(0,0,0,.55)]"
        />
        <div className="w-full">
            <div className="text-xs font-medium text-white/65 tracking-wide">
              TreeCondo • Plataforma oficial do condomínio
            </div>

            <div className="mt-1 text-2xl font-semibold text-white">
              Olá, {nome} 👋
            </div>
        </div>
      </div>
       <div className="relative mt-4">
        <p className="text-sm text-white/75 max-w-2xl mx-auto">
          Tudo o que você precisa do condomínio, em um só lugar — com clareza, rapidez e segurança.
Acompanhe avisos importantes, gerencie reservas e tenha acesso a documentos e enquetes em segundos.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/75">
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1">📌 Avisos</span>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1">📅 Reservas</span>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1">📄 Documentos</span>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1">🗳️ Enquetes</span>
        </div>
      </div>
    </div>
  );
}
