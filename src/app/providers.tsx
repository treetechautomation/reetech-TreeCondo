"use client";

import * as React from "react";
import { SessionProvider } from "@/contexts/SessionContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { CondominioProvider } from "@/contexts/CondominioContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BrandingProvider>
        <CondominioProvider>{children}</CondominioProvider>
      </BrandingProvider>
    </SessionProvider>
  );
}
