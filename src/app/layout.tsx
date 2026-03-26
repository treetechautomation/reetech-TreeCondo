import type { Metadata } from "next";
import "./globals.css";

import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { AppShell } from "@/components/shell/AppShell";
import Providers from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://treecondo.treetechautomation.com"),

  title: {
    default: "TreeCondo - Gestão inteligente de condomínios",
    template: "%s | TreeCondo"
  },

  description:
    "Sistema completo para gestão de condomínios. Controle reservas, acessos, incidentes, encomendas e comunicação em um único lugar.",

  keywords: [
    "gestão de condomínio",
    "sistema para condomínio",
    "software para síndico",
    "controle de portaria",
    "reservas condomínio",
    "TreeCondo"
  ],

  openGraph: {
    title: "TreeCondo - Gestão inteligente de condomínios",
    description:
      "Sistema moderno para síndicos, moradores e portaria.",
    url: "https://treecondo.treetechautomation.com",
    siteName: "TreeCondo",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/logo-treecondo.jpeg",
        width: 1200,
        height: 630,
        alt: "TreeCondo"
      }
    ]
  },

  twitter: {
    card: "summary_large_image",
    title: "TreeCondo",
    description: "Gestão inteligente de condomínios",
    images: ["/logo-treecondo.jpeg"]
  },

  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },

  manifest: "/manifest.webmanifest",
};


import { RealtimeToast } from "@/components/toast/RealtimeToast";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>

      <body className="font-body antialiased tc-bg-signature tc-typography">
        <FirebaseClientProvider>
          <Providers>
              
              <AppShell>{children}</AppShell>
            </Providers>
        </FirebaseClientProvider>

        <Toaster />

        {/* Root de Portals (Radix) */}
        <div id="tc-portal-root" />
        <RealtimeToast />
  </body>
    </html>
  );
}
