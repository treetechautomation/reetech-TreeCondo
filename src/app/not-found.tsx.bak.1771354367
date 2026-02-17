import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f7f2eb] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-black/10 bg-white/70 backdrop-blur p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Página não encontrada</h1>
        <p className="mt-2 text-slate-600">
          O endereço que você acessou não existe (ou foi movido).
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Voltar ao painel
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium border border-black/10 bg-white hover:bg-white/80 transition"
          >
            Ir para login
          </Link>
        </div>
      </div>
    </div>
  );
}
