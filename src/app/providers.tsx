"use client";

import * as React from "react";
import { SessionProvider } from "@/contexts/SessionContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { CondominioProvider } from "@/contexts/CondominioContext";
import InAppNotifications from "@/components/notifications/InAppNotifications";
import { ThemeProvider } from "@/contexts/ThemeContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <BrandingProvider>
          <CondominioProvider>
              <InAppNotifications />
              {children}
            </CondominioProvider>
        </BrandingProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
