"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, KeyRound, Menu, Megaphone, Package,
  Shield, Home, AlertTriangle, Bell, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionCtx } from "@/contexts/SessionContext";

type NavItem = { href: string; label: string; icon: any; aliases?: string[]; color?: string };

const PORTEIRO_ITEMS: NavItem[] = [
  { href: "/portaria", label: "Portaria", icon: Shield, aliases: ["/painel"], color: "#00BEEA" },
  { href: "/acesso", label: "Acessos", icon: KeyRound, color: "#22D3EE" },
  { href: "/encomendas", label: "Encomendas", icon: Package, color: "#A78BFA" },
  { href: "/incidentes", label: "Incidentes", icon: AlertTriangle, color: "#F87171" },
  { href: "/menu", label: "Menu", icon: Menu, color: "#94A3B8" },
];

const MORADOR_ITEMS: NavItem[] = [
  { href: "/painel", label: "Início", icon: Home, color: "#38BDF8" },
  { href: "/reservas", label: "Reservas", icon: CalendarDays, color: "#22C55E" },
  { href: "/anuncios", label: "Avisos", icon: Megaphone, color: "#00BEEA" },
  { href: "/notificacoes", label: "Notificações", icon: Bell, color: "#A78BFA" },
  { href: "/menu", label: "Menu", icon: Menu, color: "#94A3B8" },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/painel", label: "Painel", icon: Home, color: "#38BDF8" },
  { href: "/reservas", label: "Reservas", icon: CalendarDays, color: "#22C55E" },
  { href: "/acesso", label: "Acessos", icon: KeyRound, aliases: ["/acessos"], color: "#22D3EE" },
  { href: "/anuncios", label: "Anúncios", icon: Megaphone, color: "#00BEEA" },
  { href: "/menu", label: "Menu", icon: Menu, color: "#94A3B8" },
];

const DEFAULT_ITEMS: NavItem[] = [
  { href: "/painel", label: "Painel", icon: Home, color: "#38BDF8" },
  { href: "/reservas", label: "Reservas", icon: CalendarDays, color: "#22C55E" },
  { href: "/menu", label: "Menu", icon: Menu, color: "#94A3B8" },
  { href: "/anuncios", label: "Anúncios", icon: Megaphone, color: "#00BEEA" },
  { href: "/encomendas", label: "Encomendas", icon: Package, color: "#A78BFA" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { session } = useSessionCtx();

  const role = String(session?.role || "").toUpperCase();
  const isSuper = Boolean((session as any)?.superAdmin);

  const items: NavItem[] = (() => {
    if (role === "PORTEIRO") return PORTEIRO_ITEMS;
    if (isSuper || role === "SUPER_ADMIN") return ADMIN_ITEMS;
    if (role === "SINDICO" || role === "ADMIN" || role === "ADMIN_CONDOMINIO") return ADMIN_ITEMS;
    if (role === "MORADOR") return MORADOR_ITEMS;
    return DEFAULT_ITEMS;
  })();

  return (
    <nav
      className="h-16 border-t border-black/10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/30 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex h-full max-w-lg items-center justify-around px-2">
        {items.map((item) => {
          const allPaths = [item.href, ...(item.aliases ?? [])];
          const active = allPaths.some(
            (base) => pathname === base || pathname?.startsWith(base + "/")
          );

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex w-full flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] transition-all duration-200",
                active
                  ? "text-[#00d0e6] drop-shadow-[0_0_12px_rgba(0,208,230,.65)]"
                  : "text-[#0D4459] hover:text-[#00d0e6]"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 transition-all duration-200",
                  active
                    ? "scale-110 text-[#00d0e6] drop-shadow-[0_0_12px_rgba(0,208,230,.65)]"
                    : "group-hover:text-[#00d0e6]"
                )}
                style={active ? undefined : { color: item.color ?? "#0D4459" }}
              />

              <span className={cn("transition-all duration-200", active && "font-semibold")}>
                {item.label}
              </span>

              <div
                className={cn(
                  "mt-0.5 h-[3px] w-6 rounded-full transition-all duration-300",
                  active ? "bg-[#00d0e6] opacity-100 drop-shadow-[0_0_12px_rgba(0,208,230,.65)]" : "opacity-0"
                )}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
