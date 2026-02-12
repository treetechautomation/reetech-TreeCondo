"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { useSessionCtx } from "@/contexts/SessionContext";

export default function HomePage() {
  const router = useRouter();
  const { session, isSessionLoading } = useSessionCtx();

  React.useEffect(() => {
    if (isSessionLoading) return;
    if (!session) router.replace("/login");
  }, [isSessionLoading, session, router]);

  if (isSessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="tc-card px-6 py-5">Carregando…</div>
      </div>
    );
  }

  if (!session) {
    // evita “flash” do app antes do redirect
    return null;
  }

  // ✅ aqui você mantém seu dashboard em "/"
  return (
    <AppLayout pageTitle="Painel">
      {/* Se você já tinha um componente de dashboard, pode colocar aqui.
          Por enquanto, deixo um placeholder elegante. */}
      <div className="tc-card p-6">
        <div className="text-lg font-semibold text-slate-900">Bem-vindo 👋</div>
        <div className="text-slate-700 mt-1">Seu painel está pronto.</div>
      </div>
    </AppLayout>
  );
}
