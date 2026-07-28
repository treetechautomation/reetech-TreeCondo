"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionCtx } from "@/contexts/SessionContext";

/**
 * ⚠️ PÁGINA /seed — PROTEGIDA
 * Apenas SUPER_ADMIN pode acessar esta página em produção.
 * Em desenvolvimento, use com cautela.
 */
export default function SeedPage() {
  const router = useRouter();
  const { session, isSessionLoading } = useSessionCtx();

  useEffect(() => {
    if (isSessionLoading) return;
    if (!session || session.role !== "SUPER_ADMIN") {
      router.replace("/painel");
    }
  }, [session, isSessionLoading, router]);

  if (isSessionLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Verificando permissões…</p>
      </div>
    );
  }

  if (session.role !== "SUPER_ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-destructive font-medium">Acesso negado.</p>
      </div>
    );
  }

  // Apenas SUPER_ADMIN chega aqui
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border bg-card shadow-sm p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
              Admin Apenas
            </span>
          </div>
          <h1 className="text-xl font-semibold">Seed do TreeCondo</h1>
          <p className="text-sm text-muted-foreground">
            Crie o primeiro condomínio e vincule-se automaticamente como ADMIN.
            Esta página está restrita a Super Admins.
          </p>
        </div>
        <div className="text-sm rounded-lg bg-muted p-3">
          <div>
            <span className="font-medium">Logado como:</span>{" "}
            {session.user?.email || "(sem email)"}
          </div>
          <div className="truncate">
            <span className="font-medium">UID:</span> {session.user?.uid}
          </div>
          <div>
            <span className="font-medium">Role:</span>{" "}
            <span className="text-emerald-600 font-bold">{session.role}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Use o painel de <code>/administrador-global</code> para criar e gerenciar condomínios.
        </p>
      </div>
    </div>
  );
}
