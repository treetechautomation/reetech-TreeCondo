
import Link from "next/link";
import { TreeCondoBrand } from "@/components/branding/TreeCondoBrand";

export default function Home() {
  return (
    <main className="tc-bg-signature tc-typography min-h-screen flex flex-col">

      {/* NAV */}
      <header className="flex items-center justify-between px-6 py-4">
        <TreeCondoBrand />
        <Link
          href="/login"
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20 transition"
        >
          Acessar sistema
        </Link>
      </header>

      {/* HERO */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6">

        <h1 className="text-4xl md:text-6xl font-semibold text-white max-w-4xl leading-tight">
          Gestão inteligente de condomínios
        </h1>

        <p className="mt-6 text-white/70 max-w-2xl text-lg">
          Controle reservas, acessos, incidentes, encomendas e comunicação em um único sistema moderno.
        </p>

        <div className="mt-10 flex flex-wrap gap-4 justify-center">

          <Link
            href="/login"
            className="px-6 py-3 rounded-2xl text-black font-medium tc-btn-neon"
            style={{ background: "#22C55E" }}
          >
            Começar agora
          </Link>

          <Link
            href="/login"
            className="px-6 py-3 rounded-2xl border border-white/20 text-white hover:bg-white/10 transition"
          >
            Acessar sistema
          </Link>

        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 pb-20 grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">

        <div className="tc-glass-card p-6">
          <h3 className="text-white text-lg font-semibold">Reservas</h3>
          <p className="text-white/70 mt-2">Gestão de áreas comuns com controle inteligente.</p>
        </div>

        <div className="tc-glass-card p-6">
          <h3 className="text-white text-lg font-semibold">Portaria</h3>
          <p className="text-white/70 mt-2">Controle de acesso com notificações em tempo real.</p>
        </div>

        <div className="tc-glass-card p-6">
          <h3 className="text-white text-lg font-semibold">Incidentes</h3>
          <p className="text-white/70 mt-2">Abertura e gestão de ocorrências com fotos.</p>
        </div>

      </section>

      {/* FOOTER */}
      <footer className="text-center text-white/40 text-sm pb-6">
        TreeCondo • Uma solução Treetech Automation
      </footer>

    </main>
  );
}
