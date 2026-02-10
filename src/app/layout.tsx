import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthGate } from "@/components/authgate";
import { CondominioProvider } from '@/contexts/CondominioContext';
import { SessionProvider } from '@/contexts/SessionContext';
import { BrandingProvider } from '@/contexts/BrandingContext';

const APP_NAME = "TreeCondo";
const APP_DESCRIPTION = "Gerencie seu condomínio com facilidade.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s - ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#C9A79E",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  width: 'device-width',
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
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=PT+Sans:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
          <link rel="apple-touch-icon" href="/icons/icon-192.png" />
                  <script src="/pwa-register.js" defer></script>
        </head>
      <body>
        <FirebaseClientProvider>
          <SessionProvider>
            <BrandingProvider>
<AuthGate>
              <CondominioProvider>
                {children}
              </CondominioProvider>
            </AuthGate>
            </BrandingProvider>
          </SessionProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
