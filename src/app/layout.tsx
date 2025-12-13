import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthGate } from "@/components/authgate";
import { CondominioProvider } from '@/contexts/CondominioContext';

export const metadata: Metadata = {
  title: 'TreeCondo',
  description: 'Gerencie seu condomínio com facilidade.',
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <AuthGate>
            <CondominioProvider>
              {children}
            </CondominioProvider>
          </AuthGate>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
