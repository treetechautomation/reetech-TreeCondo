"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/firebase/hooks/useAuth";

export type AppLayoutProps = {
  pageTitle?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
};

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-md px-3 py-2 text-sm transition-colors",
        active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
      )}
    >
      {label}
    </Link>
  );
}

export function AppLayout({ pageTitle, headerActions, children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();

  const hideSidebar = pathname?.startsWith("/login");

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f2eb]">
      <div className="flex min-h-screen">
        {!hideSidebar && (
          <aside className="w-[240px] bg-slate-900 text-white flex flex-col">
            <div className="px-4 py-5 border-b border-white/10">
              <div className="text-lg font-semibold">TreeCondo</div>
            </div>

            <nav className="p-3 space-y-1">
              <NavItem href="/" label="Dashboard" />
              <NavItem href="/condominios" label="Condomínios" />
              <NavItem href="/cadastros" label="Cadastros" />
              <NavItem href="/acesso" label="Acesso" />
              <NavItem href="/anuncios" label="Anúncios" />
              <NavItem href="/reservas" label="Reservas" />
              <NavItem href="/incidentes" label="Incidentes" />
              <NavItem href="/encomendas" label="Encomendas" />
              <NavItem href="/documentos" label="Documentos" />
              <NavItem href="/enquetes" label="Enquetes" />
              <NavItem href="/reunioes" label="Reuniões" />
              <NavItem href="/configuracoes" label="Configurações" />
              <NavItem href="/administrador-global" label="Administrador Global" />
            </nav>

            <div className="mt-auto p-3 border-t border-white/10">
              <Button variant="secondary" className="w-full" onClick={handleLogout}>
                Sair
              </Button>
            </div>
          </aside>
        )}

        <main className="flex-1">
          {!hideSidebar && (
            <header className="sticky top-0 z-10 bg-[#f7f2eb]/80 backdrop-blur border-b border-black/5">
              <div className="flex items-center justify-between px-6 py-4">
                <div className="text-xl font-semibold text-slate-900">
                  {pageTitle ?? ""}
                </div>
                <div className="flex items-center gap-2">
                  {headerActions ?? null}
                </div>
              </div>
            </header>
          )}

          <div className="px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
