"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { ArrowLeft, LogOut, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useSessionCtx } from "@/contexts/SessionContext";
import { initializeFirebase } from "@/firebase";

const BREADCRUMB_LABELS: Record<string, string> = {
  "administrador-global": "Painel Global",
  dashboard: "Dashboard Operacional",
  clientes: "Clientes",
  condominios: "Condomínios",
  produtos: "Produtos",
  auditoria: "Auditoria",
  configuracoes: "Configurações",
};

function buildBreadcrumb(pathname: string | null): string[] {
  const segments = (pathname || "").split("/").filter(Boolean);
  if (segments[0] !== "administrador-global") return ["Painel Global"];
  if (segments.length === 1) return ["Painel Global"];
  return ["Painel Global", ...segments.slice(1).map((s) => BREADCRUMB_LABELS[s] || s)];
}

export function CockpitHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useSessionCtx();

  const crumbs = buildBreadcrumb(pathname);
  const nome = session?.user?.displayName?.trim() || session?.user?.email || "Super Admin";
  const inicial = (nome[0] || "S").toUpperCase();

  async function handleLogout() {
    try {
      const { auth } = initializeFirebase();
      await signOut(auth);
    } finally {
      router.push("/login");
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-black/5 bg-white/70 px-4 backdrop-blur-xl">
      <SidebarTrigger className="md:hidden" />

      <nav aria-label="breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 text-sm text-slate-500">
        {crumbs.map((crumb, i) => (
          <React.Fragment key={`${crumb}-${i}`}>
            {i > 0 && <span className="text-slate-300">/</span>}
            <span className={i === crumbs.length - 1 ? "truncate font-medium text-slate-800" : "truncate"}>
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </nav>

      <Button
        variant="ghost"
        size="sm"
        disabled
        aria-disabled="true"
        className="hidden gap-2 text-slate-400 sm:flex"
        title="Busca global — em breve"
      >
        <Search className="h-4 w-4" />
        Buscar
      </Button>

      <Link href="/painel">
        <Button variant="outline" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">TreeCondo operacional</span>
        </Button>
      </Link>

      <div className="hidden items-center gap-2 sm:flex">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-slate-900 text-xs text-white">{inicial}</AvatarFallback>
        </Avatar>
        <div className="leading-tight">
          <div className="max-w-[160px] truncate text-sm font-medium text-slate-800">{nome}</div>
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            SUPER_ADMIN
          </Badge>
        </div>
      </div>

      <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  );
}
