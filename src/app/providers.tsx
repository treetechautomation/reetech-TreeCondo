"use client";

import * as React from "react";
import { SessionProvider } from "@/contexts/SessionContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { CondominioProvider } from "@/contexts/CondominioContext";
import InAppNotifications from "@/components/notifications/InAppNotifications";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BrandingProvider>
        <CondominioProvider>
            <InAppNotifications />
            {children}
          </CondominioProvider>
      </BrandingProvider>
    </SessionProvider>
  );
}
