export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] tc-bg-signature flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl shadow-[0_30px_90px_rgba(0,0,0,.45)] p-8">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-[0_20px_60px_rgba(0,0,0,.35)]">
            <img
              src="/logo-treecondo.svg"
              alt="TreeCondo"
              className="absolute inset-0 h-full w-full object-contain opacity-25"
              draggable={false}
            />
            <div className="tc-logo-reveal absolute inset-0">
              <img
                src="/logo-treecondo.svg"
                alt=""
                className="h-full w-full object-contain"
                draggable={false}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-lg font-semibold text-white">TreeCondo</div>
            <div className="text-sm text-white/70">Carregando acesso…</div>
          </div>

          <div className="w-full">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
              <div className="tc-loader-bar h-full w-[45%] rounded-full bg-white/70" />
            </div>
            <div className="mt-3 text-xs text-white/60">Preparando tela de login</div>
          </div>
        </div>
      </div>
    </div>
  );
}
