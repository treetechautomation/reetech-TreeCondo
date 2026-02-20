"use client";

import * as React from "react";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useCondominioBranding } from "@/hooks/useCondominioBranding";
import { cn } from "@/lib/utils";

export function CondominioLogo({
  className,
  fallbackSrc = "/branding-fallback/logo-painel.jpeg",
}: {
  className?: string;
  fallbackSrc?: string;
}) {
  const { session, isSessionLoading } = useSessionCtx();
  const condId = session?.activeCondominioId ?? null;

  const { branding } = useCondominioBranding(condId);
  const src = branding?.logoUrl || fallbackSrc;

  if (isSessionLoading) {
    return <div className={cn("h-9 w-28 rounded-xl bg-muted/30", className)} />;
  }

   
  return (
    <img
      src={src}
      alt="Logo do condomínio"
      className={cn("h-9 w-auto object-contain", className)}
      referrerPolicy="no-referrer"
    />
  );
}
