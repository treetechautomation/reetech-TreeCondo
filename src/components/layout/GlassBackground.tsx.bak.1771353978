"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function GlassBackground({ className }: { className?: string }) {
  return (
    <div className={cn("fixed inset-0 -z-10 overflow-hidden", className)}>
      {/* base */}
      <div className="absolute inset-0 bg-[#f7f2eb]" />

      {/* aurora / blobs */}
      <div className="absolute -top-44 -left-40 h-[520px] w-[520px] rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="absolute top-24 -right-44 h-[560px] w-[560px] rounded-full bg-cyan-500/18 blur-3xl" />
      <div className="absolute bottom-[-140px] left-24 h-[520px] w-[520px] rounded-full bg-indigo-500/12 blur-3xl" />
      <div className="absolute bottom-32 right-20 h-[420px] w-[420px] rounded-full bg-lime-500/10 blur-3xl" />

      {/* vignette + brilho */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(255,255,255,.55),transparent_40%),radial-gradient(900px_circle_at_90%_30%,rgba(255,255,255,.35),transparent_45%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_120%,rgba(15,23,42,.10),transparent_55%)]" />

      {/* grain leve (sem imagem externa) */}
      <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay [background-image:repeating-linear-gradient(0deg,rgba(0,0,0,0.6),rgba(0,0,0,0.6)_1px,transparent_1px,transparent_2px)]" />
    </div>
  );
}
