"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log do erro para monitoramento (não exposição ao usuário)
    console.error("[TreeCondo] Erro de renderização:", error);
  }, [error]);

  return (
    <html lang="pt">
      <body className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Ícone */}
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-10 w-10 text-red-400" />
            </div>
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">
              Algo deu errado
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Ocorreu um erro inesperado nesta página. Tente recarregar — se o
              problema persistir, entre em contato com o suporte.
            </p>
            {error?.digest && (
              <p className="text-xs text-slate-600 font-mono mt-2">
                Ref: {error.digest}
              </p>
            )}
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={reset}
              className="bg-[#00D0E6] hover:bg-[#00b8cc] text-slate-900 font-semibold gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/painel")}
              className="border-white/20 text-white hover:bg-white/10 gap-2"
            >
              <Home className="h-4 w-4" />
              Ir para o Painel
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
