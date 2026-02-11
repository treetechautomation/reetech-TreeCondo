"use client";

import * as React from "react";
import { SessionProvider } from "@/contexts/SessionContext";
import { BrandingProvider } from "@/contexts/BrandingContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BrandingProvider>{children}</BrandingProvider>
    </SessionProvider>
  );
}
