"use client";

import * as React from "react";
import Image from "next/image";
import { useBranding } from "@/contexts/BrandingContext";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type TreeCondoBrandProps = {
  variant?: "sidebar" | "login";
  className?: string;
};

export function TreeCondoBrand({ variant = "sidebar", className }: TreeCondoBrandProps) {
  const branding = useBranding();
  const logoSrc = "/logo.png?v=2";

  if (branding.isLoading) {
    if (variant === "login") {
      return (
        <div className={cn("flex flex-col items-center gap-4", className)}>
          <Skeleton className="h-48 w-48 rounded-2xl" />
          <div className="text-center">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-56 mt-2" />
          </div>
        </div>
      );
    }
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    );
  }
  
  if (variant === "login") {
    return (
      <div className={cn("relative flex flex-col items-center gap-4", className)}>
        <div className="h-48 w-48 rounded-2xl bg-white/[0.08] backdrop-blur flex items-center justify-center border border-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]">
          <Image
            src={logoSrc}
            alt="TreeCondo"
            width={192}
            height={192}
            priority
            className="rounded-lg object-contain"
          />
        </div>
        <div className="text-center">
          <div className="text-3xl font-semibold tracking-tight text-white">
            <span style={{ color: '#00D0E6' }}>Tree</span>
            <span style={{ color: '#D3EA00' }}>Condo</span>
          </div>
          <div className="text-sm text-white/60 mt-1">
            Gestão inteligente de condomínios
          </div>
        </div>
      </div>
    );
  }

  // sidebar variant
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="h-16 w-16 rounded-2xl bg-white/[0.08] backdrop-blur flex items-center justify-center border border-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]">
        <Image
          src={logoSrc}
          alt="TreeCondo"
          width={64}
          height={64}
          className="rounded-lg object-contain"
          loading="eager"
        />
      </div>
      <div className="leading-tight">
        <div className="text-xl font-semibold tracking-tight text-white">
          <span style={{ color: '#00D0E6' }}>Tree</span>
          <span style={{ color: '#D3EA00' }}>Condo</span>
        </div>
        <div className="text-xs text-white/60 mt-1">
          Gestão inteligente de condomínios
        </div>
      </div>
    </div>
  );
}
