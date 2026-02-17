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
    <nav className="h-16 border-t border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-full max-w-lg items-center justify-around px-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] transition",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5 transition", active && "scale-105")} />
              <span className={cn(active && "font-medium")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
