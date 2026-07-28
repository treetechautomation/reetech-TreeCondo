"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { BottomNav } from "@/components/shell/BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isPublicRoute =
    !pathname ||
    pathname === "/" ||
    pathname === "/index" ||
    pathname === "/index.html" ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/signup") ||
    pathname?.startsWith("/primeiro-acesso") ||
    pathname?.startsWith("/definir-senha") ||
    pathname?.startsWith("/guias") ||
    pathname?.startsWith("/_not-found") ||
    pathname?.startsWith("/tela");

  const hideBottomNav = isPublicRoute;

  return (
    <div className="min-h-dvh w-full">
      {/* Conteúdo principal */}
      <div className="w-full min-h-dvh">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="w-full min-h-dvh"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* BottomNav — oculto em rotas públicas */}
      {!hideBottomNav && <BottomNav />}

      {/* Botão flutuante de suporte (WhatsApp) — Oculto no mobile das áreas logadas para não sobrepor o BottomNav */}
      <div className={cn("fixed bottom-6 right-6 z-50 transition-all duration-300", !hideBottomNav ? "hidden lg:block" : "block")}>
        <a 
          href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT || "5511999999999"}`}
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg transition duration-300 hover:scale-110 group relative"
          aria-label="Falar com suporte via WhatsApp"
        >
          <svg className="h-7 w-7 fill-white" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.731-1.456L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.528 2.01 14.069.993 11.45.993 6.01 10.05 1.583 6.002 9.861 6.002c-1.637 0-3.235.5-4.834 1.45l-.346-.205-3.605.945.961-3.516-.226-.359z" />
            <path d="M17.485 14.341c-.268-.134-1.588-.784-1.834-.874-.246-.09-.425-.134-.604.134-.179.268-.693.874-.85 1.053-.157.179-.313.201-.582.067-.268-.134-1.134-.418-2.161-1.336-.798-.711-1.336-1.59-1.493-1.858-.157-.268-.017-.413.118-.547.121-.12.268-.313.403-.47.134-.157.179-.268.268-.448.09-.179.045-.336-.022-.47-.067-.134-.604-1.456-.827-1.993-.217-.523-.456-.453-.627-.461-.16-.008-.344-.011-.528-.011-.184 0-.485.069-.74.346-.255.278-.973.953-.973 2.324 0 1.371 1 2.695 1.139 2.874.139.179 1.968 3.006 4.77 4.212.666.287 1.187.458 1.593.587.669.213 1.278.183 1.76.111.537-.081 1.588-.649 1.811-1.277.223-.627.223-1.164.157-1.277-.067-.112-.246-.179-.514-.313z" />
          </svg>
          <span className="absolute right-16 scale-0 transition-all rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:scale-100 whitespace-nowrap shadow-md border border-white/10">
            Falar com Suporte
          </span>
        </a>
      </div>
    </div>
  );
}
