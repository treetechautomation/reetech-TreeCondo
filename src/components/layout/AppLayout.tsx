"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSessionCtx } from "@/contexts/SessionContext";
import { fetchMenuPermissions, DEFAULT_PERMS, type MenuKey, type MenuPermissions } from "@/lib/menuPermissions";
import { signOut, getIdToken } from "firebase/auth";
import { initializeFirebase } from "@/firebase";
import UserBadge from "./UserBadge";
import { CondominioSwitcher } from "@/components/condominios/CondominioSwitcher";
import { LogOut, Menu, ArrowLeft } from "lucide-react";
import { TreeCondoBrand } from "@/components/branding/TreeCondoBrand";
import { NotificationBell } from "@/components/notifications/NotificationBell";

type NavDef = { href: string; label: string; key: MenuKey };

const NAV_ITEMS: NavDef[] = [
  { href: "/painel", label: "Dashboard", key: "dashboard" },
  { href: "/portaria", label: "Painel da Portaria", key: "portaria" },
  { href: "/condominios", label: "Condomínios", key: "condominios" },
  { href: "/cadastros", label: "Cadastros", key: "cadastros" },
  { href: "/acesso", label: "Acesso", key: "acesso" },
  { href: "/anuncios", label: "Anúncios", key: "anuncios" },
  { href: "/reservas", label: "Reservas", key: "reservas" },
    { href: "/reservas/gestao", label: "Gestão de Áreas e Reservas", key: "reservas_gestao" },
  { href: "/reservas/agenda", label: "Reservas Aprovadas", key: "reservas_agenda" },
  { href: "/reservas/solicitacoes", label: "Solicitações de Reservas", key: "reservas_solicitacoes" },
  { href: "/incidentes", label: "Incidentes", key: "incidentes" },
  { href: "/encomendas", label: "Encomendas", key: "encomendas" },
  { href: "/documentos", label: "Documentos", key: "documentos" },
  { href: "/enquetes", label: "Enquetes", key: "enquetes" },
  { href: "/reunioes", label: "Reuniões", key: "reunioes" },
  { href: "/manutencao-preventiva", label: "Manutenção Preventiva", key: "manutencao_preventiva" },
  { href: "/configuracoes", label: "Configurações", key: "configuracoes" },
  { href: "/administrador-global", label: "Administrador Global", key: "administrador_global" },
];

function NavLinkButton({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(href + "/");

  // Usamos <button> + router.push no mobile para garantir: fecha drawer -> navega 1x (sem “voltar”)
  return (
    <Link
      href={href}
      onClick={() => onNavigate?.()}
      className={cn(
        "group relative block rounded-2xl px-3 py-2.5 text-sm transition-all",
        "border border-white/10 bg-white/[0.04] backdrop-blur-xl",
        "hover:bg-white/[0.08] hover:border-white/15 hover:shadow-[0_8px_30px_rgba(0,0,0,.22)]",
        active
          ? "bg-white/[0.10] border-white/20 text-white shadow-[0_10px_40px_rgba(0,0,0,.30)]"
          : "text-white/80"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-[10px] bottom-[10px] w-[3px] rounded-full transition-all duration-300",
          active
            ? "opacity-100 bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,.65),0_0_40px_rgba(34,211,238,.20)]"
            : "opacity-0 bg-emerald-400 group-hover:opacity-60"
        )}
      />
      <div className="flex items-center gap-2 pl-2">
        <span className="truncate">{label}</span>
      </div>
    </Link>
  );
}

export type AppLayoutProps = {
  pageTitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  hideMobileMenuButton?: boolean;
  children: React.ReactNode;
};

export function AppLayout({ pageTitle, headerActions, hideMobileMenuButton = false, children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isSessionLoading, isAuthenticated } = useSessionCtx();

/** AUTO_REDIRECT_LOGIN_GUARD **/
React.useEffect(() => {
    if (isSessionLoading) return;

    const isPublicRoute =
      pathname?.startsWith("/login") ||
      pathname?.startsWith("/definir-senha") ||
      pathname?.startsWith("/primeiro-acesso") ||
      pathname?.startsWith("/signup") ||
      pathname?.startsWith("/onboarding");

    if (isPublicRoute) return;

    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isSessionLoading, isAuthenticated, pathname, router]);
/** /AUTO_REDIRECT_LOGIN_GUARD **/

/** ONBOARDING_GATE: sem vínculo ATIVO -> primeiro acesso pendente ou
 *  /onboarding/vincular-condominio (defesa em profundidade — ver
 *  ADMIN_CONDOMINIO.1C. Usa o mesmo resolvedor canônico do LoginClient
 *  para não duplicar a lógica de decisão em dois lugares.) **/
React.useEffect(() => {
    if (isSessionLoading) return;
    if (!session) return;

    const isPublicOrOnboarding =
      pathname?.startsWith("/login") ||
      pathname?.startsWith("/signup") ||
      pathname?.startsWith("/primeiro-acesso") ||
      pathname?.startsWith("/onboarding");

    if (isPublicOrOnboarding) return;

    const isSuperAdmin =
      Boolean((session as any).superAdmin) ||
      String(session.role || "").toUpperCase() === "SUPER_ADMIN";

    if (isSuperAdmin) return;

    const hasActiveVinculo = (session.vinculos ?? []).some(
      (v: any) => v.status === "ATIVO"
    );

    if (hasActiveVinculo) return;

    let cancelled = false;

    (async () => {
      try {
        const token = await getIdToken(session.user);
        const res = await fetch("/api/auth/resolve-identity", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.ok && data?.ok && data.state === "PENDING_INVITED_USER") {
          // ADMIN_CONDOMINIO.1C-R2 — /primeiro-acesso lê `code`, não
          // `conviteId` (que o resolvedor não possui em texto puro).
          router.replace("/primeiro-acesso");
          return;
        }
      } catch {
        // Falha ao resolver não deve travar a navegação; cai no
        // comportamento padrão abaixo (self-onboarding MORADOR, inalterado).
      }
      if (!cancelled) {
        router.replace("/onboarding/vincular-condominio");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSessionLoading, session, pathname, router]);
/** /ONBOARDING_GATE **/

/** PORTEIRO_REDIRECT: PORTEIRO sempre vai para /portaria **/
React.useEffect(() => {
    if (isSessionLoading) return;
    if (!session) return;

    const isExcluded =
      pathname?.startsWith("/login") ||
      pathname?.startsWith("/signup") ||
      pathname?.startsWith("/primeiro-acesso") ||
      pathname?.startsWith("/onboarding") ||
      pathname?.startsWith("/portaria") ||
      pathname?.startsWith("/acesso") ||
      pathname?.startsWith("/encomendas") ||
      pathname?.startsWith("/incidentes") ||
      pathname?.startsWith("/reservas") ||
      pathname?.startsWith("/anuncios") ||
      pathname?.startsWith("/notificacoes") ||
      pathname?.startsWith("/menu") ||
      pathname?.startsWith("/meus-dados") ||
      pathname?.startsWith("/manutencao-preventiva") ||
      pathname?.startsWith("/api/") ||
      pathname?.startsWith("/_next");

    if (isExcluded) return;

    const isSuperAdmin =
      Boolean((session as any).superAdmin) ||
      String(session.role || "").toUpperCase() === "SUPER_ADMIN";

    if (isSuperAdmin) return;

    const role = String(session.role || "").toUpperCase();
    if (role === "PORTEIRO") {
      router.replace("/portaria");
    }
  }, [isSessionLoading, session, pathname, router]);
/** /PORTEIRO_REDIRECT **/


  const isSuper =
    Boolean((session as any)?.superAdmin) ||
    Boolean((session as any)?.isSuperAdmin) ||
    Boolean((session as any)?.super_admin) ||
    String((session as any)?.role || session?.role || "").toUpperCase() === "SUPER_ADMIN";

  const hideSidebar = pathname?.startsWith("/login");

  const [perms, setPerms] = React.useState<MenuPermissions | null>(null);

  React.useEffect(() => {
    if (isSessionLoading || !session?.activeCondominioId) {
      setPerms(null);
      return;
    }

    (async () => {
      try {
        const condoId = session.activeCondominioId;
        const p = condoId ? await fetchMenuPermissions(condoId) : null;
        setPerms(p);
      } catch {
        setPerms(null);
      }
    })();
  }, [isSessionLoading, session?.activeCondominioId]);

  function isAllowed(menuKey: MenuKey) {
    if (!session) return false;

    if (isSuper) {
      return menuKey !== "administrador_global" || session.user.email === "treecommunity@treetechautomation.com";
    }

    const role = session.role;
    if (!role || role === "SUPER_ADMIN") return false;

    const docPerms = perms?.[role]?.[menuKey];
    if (typeof docPerms === "boolean") return docPerms;

    const fallback = DEFAULT_PERMS?.[role]?.[menuKey];
    return !!fallback;
  }

  const filteredNav = NAV_ITEMS.filter((i) => isAllowed(i.key));

  const handleLogout = async () => {
    try {
      const { auth } = initializeFirebase() as any;
      await signOut(auth);
    } catch (e) {
      console.error("[AppLayout] erro ao deslogar:", e);
    } finally {
      router.push("/login");
    }
  };

  const SidebarPanel = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="relative h-full w-full text-white overflow-hidden">
      {/* Fundo “aurora” */}
      <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_10%_10%,rgba(16,185,129,.25),transparent_55%),radial-gradient(900px_circle_at_90%_25%,rgba(34,211,238,.20),transparent_52%),radial-gradient(900px_circle_at_70%_90%,rgba(99,102,241,.18),transparent_55%),linear-gradient(180deg,rgba(2,6,23,.96)_0%,rgba(2,6,23,.92)_100%)]" />
      <div className="absolute -top-28 -left-24 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="absolute top-40 -right-28 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute bottom-0 left-10 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Painel glass */}
      <div className="relative m-3 h-[calc(100dvh-24px)] rounded-[26px] border border-white/15 bg-black/20 backdrop-blur-2xl shadow-[0_20px_90px_rgba(0,0,0,.65)] overflow-hidden flex flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_-20%_-20%,rgba(255,255,255,.18),transparent_45%),radial-gradient(900px_circle_at_120%_20%,rgba(255,255,255,.10),transparent_40%)]" />

        {/* Header */}
        <div className="relative px-5 py-6 border-b border-white/10">
          <TreeCondoBrand variant="sidebar" />
        </div>

        {/* Nav scrollável */}
        <div className="relative p-3 flex-1 min-h-0">
          <nav className="h-full space-y-2 overflow-y-auto pr-1">
            {filteredNav.map((item) => (
              <NavLinkButton key={item.href} href={item.href} label={item.label} onNavigate={onNavigate} />
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="relative mt-auto p-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <UserBadge variant="sidebar" className="flex-1" />
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="icon"
              className="rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="tc-bg">
      <div className="flex min-h-screen">
        {/* DESKTOP sidebar */}
        {!hideSidebar && (
          <aside className="hidden lg:block w-[350px] text-white relative overflow-visible">
            <SidebarPanel />
          </aside>
        )}

        <main className="flex-1 min-w-0">
          {!hideSidebar && (
            <header className="sticky top-0 z-[999] bg-white/35 backdrop-blur-xl border-b border-white/15" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>

              {/* ─── MOBILE: duas camadas (lg:hidden) ─── */}
              <div className="lg:hidden">
                {/* Camada 1 — Navegação Global */}
                <div className="flex items-center px-3 py-2.5 gap-1.5">
                  {!hideMobileMenuButton && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-slate-900 hover:text-[#00d0e6] min-h-[44px] min-w-[44px] shrink-0"
                      title="Menu"
                      aria-label="Abrir menu de navegação"
                      onClick={() => router.push("/menu")}
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  )}
                  {isSuper && (
                    <div className="flex-1 min-w-0 max-w-[160px]">
                      <CondominioSwitcher />
                    </div>
                  )}
                  {!isSuper && <div className="flex-1" />}
                  <NotificationBell className="text-slate-900 hover:text-[#00d0e6] shrink-0" />
                  <Button
                    onClick={handleLogout}
                    variant="ghost"
                    size="icon"
                    className="rounded-xl shrink-0 min-h-[44px] min-w-[44px]"
                    title="Sair"
                    aria-label="Sair da conta"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>

                {/* Camada 2 — Contexto da Página (título + ações) */}
                {(pageTitle || headerActions) && (
                  <div className="flex items-center gap-2 px-3 pb-2.5">
                    <div className="flex-1 min-w-0 text-base font-semibold text-slate-900 leading-tight">
                      {pageTitle ?? ""}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {headerActions ?? null}
                    </div>
                  </div>
                )}
              </div>

              {/* ─── DESKTOP: linha única (lg:flex) ─── */}
              <div className="hidden lg:flex items-center px-6 py-4 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-semibold text-slate-900 truncate">
                    {pageTitle ?? ""}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isSuper && (
                    <div className="min-w-[220px]">
                      <CondominioSwitcher />
                    </div>
                  )}
                  <NotificationBell className="text-slate-900 hover:text-[#00d0e6] shrink-0" />
                  {headerActions ?? null}
                  <Button
                    onClick={handleLogout}
                    variant="ghost"
                    size="icon"
                    className="rounded-xl shrink-0"
                    title="Sair"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </header>
          )}

          <div className="px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 lg:pb-8 pb-[calc(1rem+4rem+env(safe-area-inset-bottom,0px))]">
              <div className="mx-auto w-full max-w-screen-xl min-w-0">
                {children}
              </div>
            </div>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
