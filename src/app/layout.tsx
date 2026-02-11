import type { Metadata, Viewport } from "next";
import "./globals.css";

import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { AuthGate } from "@/components/authgate";
import { CondominioProvider } from "@/contexts/CondominioContext";
import { SessionProvider } from "@/contexts/SessionContext";
import { BrandingProvider } from "@/contexts/BrandingContext";

const APP_NAME = "TreeCondo";
const APP_DESCRIPTION = "Gestão inteligente de condomínios";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <head>
        <script src="/pwa-register.js" defer />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=PT+Sans:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body>
        <FirebaseClientProvider>
          <SessionProvider>
            <BrandingProvider>
              <AuthGate>
                <CondominioProvider>{children}</CondominioProvider>
              </AuthGate>
            </BrandingProvider>
          </SessionProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
