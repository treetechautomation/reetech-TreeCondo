"use client";

/**
 * UI.G2 — PageContainer
 * 
 * Standard page content wrapper with responsive padding and max-width.
 * Compose with existing AppLayout. Does NOT wrap AppLayout — goes INSIDE it.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-screen-xl min-w-0 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8", className)}>
      {children}
    </div>
  );
}
