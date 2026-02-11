import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';

import Providers from "./providers";
export const metadata: Metadata = {
  title: "TreeCondo - Gestão inteligente de condomínios",
  description: "TreeCondo - Gestão inteligente de condomínios",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TreeCondo",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script src="/pwa-register.js" defer></script>
        </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <Providers>{children}</Providers>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
