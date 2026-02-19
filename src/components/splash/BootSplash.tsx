"use client";

import * as React from "react";

type Props = {
  durationMs?: number;
};

const KEY = "tc_boot_done_v1";

export default function BootSplash({ durationMs = 1100 }: Props) {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    // mostra só uma vez por sessão (tab)
    const done = sessionStorage.getItem(KEY);
    if (done) return;

    setShow(true);
    const t = setTimeout(() => {
      sessionStorage.setItem(KEY, "1");
      setShow(false);
    }, durationMs);

    return () => clearTimeout(t);
  }, [durationMs]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Fundo premium (degradê referência) */}
      <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_30%_40%,rgba(255,255,255,.20),transparent_55%),radial-gradient(700px_circle_at_70%_65%,rgba(255,255,255,.12),transparent_60%),linear-gradient(90deg,#00d0e6_0%,#0b1f3a_52%,#166534_100%)]" />

      {/* Cart central */}
      <div className="relative flex h-full w-full items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-8 shadow-[0_30px_90px_rgba(0,0,0,.45)] backdrop-blur-2xl">
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 shadow-[0_20px_60px_rgba(0,0,0,.35)]">
              <img
                src="/logo-treecondo.jpeg"
                alt="TreeCondo"
                className="h-14 w-14 rounded-xl object-contain"
              />
            </div>

            <div>
              <div className="text-white/95 text-xl font-semibold tracking-wide">
                TreeCondo
              </div>
              <div className="text-white/75 text-sm">
                Iniciando…
              </div>
            </div>

            {/* Barra */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-1/2 animate-[tc-boot_1.1s_ease-in-out_infinite] rounded-full bg-white/70" />
            </div>

            <div className="text-[12px] text-white/65">
              Carregando interface…
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes tc-boot {
          0% { transform: translateX(-55%); opacity: .45; }
          50% { transform: translateX(110%); opacity: 1; }
          100% { transform: translateX(-55%); opacity: .45; }
        }
      `}</style>
    </div>
  );
}
