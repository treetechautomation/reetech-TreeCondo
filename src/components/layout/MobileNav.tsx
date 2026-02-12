"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, LogOut } from "lucide-react";
import UserBadge from "@/components/layout/UserBadge";

type Item = { href: string; label: string };

export default function MobileNav({
  items,
  onLogout,
  brand,
}: {
  items: Item[];
  onLogout: () => void;
  brand?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // Abre só no mobile na primeira vez (opcional: pode tirar se não quiser abrir automático)
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      setOpen(true);
    }
  }, []);

  // Ao trocar de rota, fecha o drawer (mata o “primeiro clique abre menu”)
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden rounded-xl text-slate-900 hover:bg-black/5"
          title="Menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-[86vw] max-w-[360px] p-0 border-none bg-slate-900 text-white"
      >
        <div className="h-[100dvh] flex flex-col">
          {/* topo (brand) */}
          <div className="px-4 py-4 border-b border-white/10">
            {brand ?? <div className="text-white font-semibold">TreeCondo</div>}
          </div>

          {/* lista (scroll real) */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-2">
              {items.map((it) => {
                const active = pathname === it.href || pathname?.startsWith(it.href + "/");
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className={[
                      "block rounded-2xl px-3 py-2.5 text-sm border backdrop-blur-xl transition-all",
                      active
                        ? "bg-white/[0.10] border-white/20 text-white"
                        : "bg-white/[0.04] border-white/10 text-white/85 hover:bg-white/[0.08] hover:border-white/15",
                    ].join(" ")}
                  >
                    {it.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* footer */}
          <div className="px-3 py-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <UserBadge variant="sidebar" className="flex-1" />
              <Button
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                variant="ghost"
                size="icon"
                className="rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
                title="Sair"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
