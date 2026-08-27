"use client";

import * as React from "react";
import { useSessionCtx } from "@/contexts/SessionContext";
import { CockpitShell } from "@/components/administrador-global/CockpitShell";

export default function AdministradorGlobalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isSessionLoading } = useSessionCtx();

  if (isSessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Carregando sessão…
      </div>
    );
  }

  if (session?.superAdmin !== true) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-lg font-semibold text-slate-800">Acesso restrito</p>
        <p className="text-sm text-slate-500">
          Esta área é exclusiva do SUPER_ADMIN da Treetech.
        </p>
      </div>
    );
  }

  return <CockpitShell>{children}</CockpitShell>;
}
