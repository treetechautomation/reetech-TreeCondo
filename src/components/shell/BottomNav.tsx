"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, KeyRound, Menu, Megaphone, Package } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: any; aliases?: string[] };

const items: NavItem[] = [
  { href: "/reservas", label: "Reservas", icon: CalendarDays },
  { href: "/acesso", label: "Acessos", icon: KeyRound, aliases: ["/acessos"] },
  { href: "/menu", label: "Menu", icon: Menu },
  { href: "/anuncios", label: "Anúncios", icon: Megaphone, aliases: ["/comunicacao"] },
  { href: "/encomendas", label: "Encomendas", icon: Package },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="h-16 border-t border-black/10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/30">
      <div className="mx-auto flex h-full max-w-lg items-center justify-around px-2">

        {items.map(({ href, label, icon: Icon }) => {

          const all = [href, ...(items.find(i => i.href === href)?.aliases ?? [])];

const active = all.some((base) =>
  pathname === base || pathname?.startsWith(base + "/")
);
return (
            <Link
              key={href}
              href={href}
              className={cn(
"group flex w-full flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] transition-all duration-200",
active ? "text-[#00d0e6] drop-shadow-[0_0_12px_rgba(0,208,230,.65)]" : "text-[#0D4459] hover:text-[#00d0e6]"
)}
            >

              <Icon
  className={cn(
    "h-5 w-5 transition-all duration-200",
    active ? "scale-110 text-[#00d0e6] drop-shadow-[0_0_12px_rgba(0,208,230,.65)]" : "text-[#0D4459] group-hover:text-[#00d0e6]"
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
