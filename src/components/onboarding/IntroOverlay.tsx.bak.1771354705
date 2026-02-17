"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";

const KEY = "tc_intro_v1_seen";

export function IntroOverlay() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    // roda só no client
    const seen = localStorage.getItem(KEY) === "1";
    if (!seen) setOpen(true);
  }, []);

  function close() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setOpen(false);
  }

  // ESC para fechar
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          role="dialog"
          aria-label="Introdução TreeCondo"
        >
          {/* fundo com “aurora” */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background:
                "radial-gradient(1200px 600px at 20% 20%, hsl(var(--primary)/0.22), transparent 60%)," +
                "radial-gradient(900px 500px at 80% 30%, hsl(var(--accent)/0.20), transparent 55%)," +
                "radial-gradient(900px 700px at 50% 90%, hsl(var(--ring)/0.18), transparent 60%)",
            }}
          />

          <motion.div
            className="relative mx-auto w-full max-w-sm rounded-2xl border border-border/50 bg-card/70 p-8 text-center shadow-sm backdrop-blur"
            initial={{ y: 14, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="mx-auto mb-4 h-14 w-14 rounded-2xl border border-border/60 bg-background/60"
              initial={{ rotate: -6, scale: 0.9, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ delay: 0.05, type: "spring", stiffness: 260, damping: 18 }}
            />

            <motion.h1
              className="text-2xl font-semibold text-foreground"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
            >
              TreeCondo
            </motion.h1>

            <motion.p
              className="mt-2 text-sm text-muted-foreground"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              Gestão inteligente de condomínios
            </motion.p>

            <motion.button
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-95"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              onClick={close}
            >
              Entrar
            </motion.button>

            <motion.div
              className="mt-3 text-xs text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Toque fora para pular • ESC para fechar
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
