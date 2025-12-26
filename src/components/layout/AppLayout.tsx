"use client";

import UserBadge from "@/components/layout/UserBadge";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/firebase/hooks/useAuth";
import { useSession, type RoleKey } from "@/hooks/useSession";
import { fetchMenuPermissions, DEFAULT_PERMS, type MenuKey, type MenuPermissions } from "@/lib/menuPermissions";
import Image from "next/image";
import { signOut } from "firebase/auth";
import { initializeFirebase } from "@/firebase";
import { UserNav } from "@/components/user-nav";

type NavDef = { href: string; label: string; key: MenuKey };

const NAV_ITEMS: NavDef[] = [
  { href: "/", label: "Dashboard", key: "dashboard" },
  { href: "/condominios", label: "Condomínios", key: "condominios" },
  { href: "/cadastros", label: "Cadastros", key: "cadastros" },
  { href: "/acesso", label: "Acesso", key: "acesso" },
  { href: "/anuncios", label: "Anúncios", key: "anuncios" },
  { href: "/reservas", label: "Reservas", key: "reservas" },
  { href: "/incidentes", label: "Incidentes", key: "incidentes" },
  { href: "/encomendas", label: "Encomendas", key: "encomendas" },
  { href: "/documentos", label: "Documentos", key: "documentos" },
  { href: "/enquetes", label: "Enquetes", key: "enquetes" },
  { href: "/reunioes", label: "Reuniões", key: "reunioes" },
  { href: "/configuracoes", label: "Configurações", key: "configuracoes" },
  { href: "/administrador-global", label: "Administrador Global", key: "administrador_global" },
];

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "group relative block rounded-2xl px-3 py-2.5 text-sm transition-all",
        "border border-white/10 bg-white/[0.04] backdrop-blur-xl",
        "hover:bg-white/[0.08] hover:border-white/15 hover:shadow-[0_8px_30px_rgba(0,0,0,.22)]",
        active
          ? "bg-white/[0.10] border-white/20 text-white shadow-[0_10px_40px_rgba(0,0,0,.30)]"
          : "text-white/80"
      )}
    >
      {/* Neon line (ativo) */}
      <span
        className={cn(
          "absolute left-0 top-[10px] bottom-[10px] w-[3px] rounded-full",
          "transition-all duration-300",
          active
            ? "opacity-100 bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,.65),0_0_40px_rgba(34,211,238,.20)]"
            : "opacity-0 bg-emerald-400 group-hover:opacity-60"
        )}
      />

      {/* Conteúdo */}
      <div className="flex items-center gap-2 pl-2">
        <span className="truncate">{label}</span>
      </div>
    </Link>
  );
}

export type AppLayoutProps = {
  pageTitle?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
};

// fallback
function getLocalRoleFallback(): RoleKey {
  if (typeof window === "undefined") return "MORADOR";
  const raw = window.localStorage.getItem("treecondo_role");
  if (raw === "SINDICO" || raw === "MORADOR" || raw === "PORTEIRO" || raw === "ADMIN" || raw === "SUPER_ADMIN") return raw;
  return "MORADOR";
}
function getLocalCondoFallback(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("treecondo_condominioId");
}

export function AppLayout({ pageTitle, headerActions, children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();
  const { session, isSessionLoading } = useSession();

  const hideSidebar = pathname?.startsWith("/login");

  const [role, setRole] = React.useState<RoleKey>("MORADOR");
  const [condominioId, setCondominioId] = React.useState<string | null>(null);
  const [perms, setPerms] = React.useState<MenuPermissions | null>(null);

  React.useEffect(() => {
    if (isSessionLoading) return;

    const resolvedRole: RoleKey = (session as any)?.role ?? getLocalRoleFallback();
    const resolvedCondo: string | null = session?.activeCondominioId ?? getLocalCondoFallback();

    setRole(resolvedRole);
    setCondominioId(resolvedCondo);

    (async () => {
      try {
        if (!resolvedCondo) {
          setPerms(null);
          return;
        }
        const p = await fetchMenuPermissions(resolvedCondo);
        setPerms(p);
      } catch {
        setPerms(null);
      }
    })();
  }, [isSessionLoading, session?.activeCondominioId, pathname]);

  function isAllowed(menuKey: MenuKey) {
    if (role === "SUPER_ADMIN") return true;
    if (menuKey === "administrador_global") return false;

    const docPerms = perms?.[role]?.[menuKey];
    if (typeof docPerms === "boolean") return docPerms;

    const fallback = DEFAULT_PERMS?.[role]?.[menuKey];
    return Boolean(fallback);
  }

  const filteredNav = NAV_ITEMS.filter((i) => isAllowed(i.key));

  const handleLogout = async () => {
  try {
    // Se existir logout no hook/context, usa. Senão, faz signOut direto.
    if (typeof (logout as any) === "function") {
      await (logout as any)();
    } else {
      const { auth } = initializeFirebase() as any;
      await signOut(auth);
    }
  } catch (e) {
    console.error("[AppLayout] erro ao deslogar:", e);
  } finally {
    router.push("/login");
  }
};

  return (
    <div className="tc-bg">
      <div className="flex min-h-screen">
        {!hideSidebar && (
          <aside className="w-[325px] text-white relative overflow-hidden">
            {/* Fundo “aurora” */}
            <div className="absolute inset-0 bg-slate-900" />
            <div className="absolute -top-28 -left-24 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
            <div className="absolute top-40 -right-28 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
            <div className="absolute bottom-0 left-10 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

            {/* Painel 100% glass */}
            <div className="relative h-full flex flex-col p-3">
              <div 
                className="flex-1 rounded-[26px] border border-white/15 bg-white/[0.06] backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,.45)] overflow-hidden flex flex-col"
              >
                {/* brilho interno */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_circle_at_-20%_-20%,rgba(255,255,255,.18),transparent_45%),radial-gradient(900px_circle_at_120%_20%,rgba(255,255,255,.10),transparent_40%)]" />

                {/* Header */}
                <div className="relative px-5 py-6 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-white/[0.08] backdrop-blur flex items-center justify-center border border-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]">
                      <Image
                        src="/logo-treecondo.jpeg"
                        alt="TreeCondo"
                        width={48}
                        height={48}
                        className="rounded-lg object-contain"
                        loading="eager"
                      />
                    </div>

                    <div className="leading-tight">
                      <div className="text-xl font-semibold tracking-tight">
                        <span style={{ color: '#00D0E6' }}>Tree</span>
                        <span style={{ color: '#D3EA00' }}>Condo</span>
                      </div>
                      <div className="text-xs text-white/55 mt-1">
                        Gestão inteligente de condomínios
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nav */}
                <nav className="relative p-3 space-y-2 overflow-y-auto">
                  {filteredNav.map((item) => (
                    <NavItem key={item.href} href={item.href} label={item.label} />
                  ))}
                </nav>

                {/* Footer */}
                <div className="relative mt-auto p-3 border-t border-white/10">
                  <UserNav variant="sidebar" />
                </div>
              </div>
            </div>
          </aside>
        )}

        <main className="flex-1">
          {!hideSidebar && (
            <header className="sticky top-0 z-10 bg-[#f7f2eb]/80 backdrop-blur border-b border-black/5">
              <div className="flex items-center justify-between px-6 py-4">
                <div className="text-xl font-semibold text-slate-900">{pageTitle ?? ""}</div>
                <div className="flex items-center gap-4">
                  <UserNav variant="header" />
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
