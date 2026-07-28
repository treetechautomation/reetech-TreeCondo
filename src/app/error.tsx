"use client";

import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[TreeCondo] Erro de página:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-800">
            Erro ao carregar esta página
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Ocorreu um problema inesperado. Você pode tentar novamente ou
            voltar ao painel.
          </p>
          {error?.digest && (
            <p className="text-xs text-slate-400 font-mono">
              Ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} className="gap-2 bg-[#00D0E6] hover:bg-[#00b8cc] text-slate-900 font-semibold">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/painel")}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Ir para o Painel
          </Button>
        </div>
      </div>
    </div>
  );
}
