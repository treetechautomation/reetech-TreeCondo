"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * PwaUpdateBanner — detecta quando o Service Worker tem uma nova versão
 * e exibe um banner para o usuário atualizar o app.
 * Resolve o problema de "Failed to find Server Action" após novos deploys.
 */
export function PwaUpdateBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Verifica SW registrado
    navigator.serviceWorker.getRegistration("/").then((reg) => {
      if (!reg) return;
      setRegistration(reg);

      // SW em espera = nova versão disponível
      if (reg.waiting) {
        setShowBanner(true);
        return;
      }

      // Escuta atualizações futuras
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setShowBanner(true);
          }
        });
      });
    });

    // Se o SW controlador mudar (skipWaiting ativado), recarrega a página
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  function handleUpdate() {
    if (registration?.waiting) {
      // Envia mensagem para o SW pular a espera e ativar
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      // Fallback: reload direto
      window.location.reload();
    }
    setShowBanner(false);
  }

  if (!showBanner) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-full px-4">
      <div className="bg-slate-900 border border-[#00D0E6]/30 rounded-2xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
        {/* Ícone */}
        <div className="h-9 w-9 rounded-xl bg-[#00D0E6]/10 flex items-center justify-center shrink-0">
          <RefreshCw className="h-4 w-4 text-[#00D0E6]" />
        </div>

        {/* Texto */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Nova versão disponível</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            Uma atualização do TreeCondo está pronta.
          </p>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={handleUpdate}
            className="h-7 text-xs px-3 bg-[#00D0E6] hover:bg-[#00b8cc] text-slate-900 font-semibold rounded-lg"
          >
            Atualizar
          </Button>
          <button
            onClick={() => setShowBanner(false)}
            className="text-slate-500 hover:text-slate-300 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
