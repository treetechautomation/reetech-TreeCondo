"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, KeyRound, Megaphone, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Início", icon: Home },
  { href: "/reservas", label: "Reservas", icon: CalendarDays },
  { href: "/acesso", label: "Acesso", icon: KeyRound },
  { href: "/comunicacao", label: "Comunicação", icon: Megaphone },
  { href: "/encomendas", label: "Encomendas", icon: Package },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="h-16 border-t border-black/10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-full max-w-lg items-center justify-around px-2">

        {items.map(({ href, label, icon: Icon }) => {

          const active =
            pathname === href ||
            pathname?.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex w-full flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] transition-all duration-200",

                active
                  ? "text-[hsl(var(--brand-blue))]"
                  : "text-slate-500 hover:text-[hsl(var(--accent))]"
              )}
            >

              <Icon
                className={cn(
                  "h-5 w-5 transition-all duration-200",

                  active
                    ? "scale-110 text-[hsl(var(--brand-blue))]"
                    : "group-hover:text-[hsl(var(--accent))]"
                )}
              />

              <span
                className={cn(
                  "transition-all duration-200",

                  active && "font-semibold"
                )}
              >
                {label}
              </span>

              {/* indicador ativo */}
              <div
                className={cn(
                  "mt-1 h-[3px] w-6 rounded-full transition-all duration-300",

                  active
                    ? "bg-[hsl(var(--brand-blue))] opacity-100"
                    : "opacity-0"
                )}
              />

            </Link>
          );
        })}

      </div>
    </nav>
  );
}
