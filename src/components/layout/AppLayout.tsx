'use client';

import {
  Home,
  Megaphone,
  CalendarDays,
  Users,
  AlertTriangle,
  Package,
  FileText,
  Settings,
  Search,
  Vote,
  KeyRound,
  BookUser,
  Building,
  Shield,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';
import { UserNavClient } from '@/components/user-nav-client';
import { ActiveLink } from '@/components/active-link';
import { useSessionCtx } from '@/contexts/SessionContext';
import { hasRole } from '@/lib/acl';
import React from 'react';

type AppLayoutProps = {
  children: React.ReactNode;
  pageTitle: string;
  searchPlaceholder?: string;
  headerActions?: React.ReactNode;
};

export function AppLayout({
  children,
  pageTitle,
  searchPlaceholder = 'Pesquisar...',
  headerActions,
}: AppLayoutProps) {
  const { session } = useSessionCtx();
  const canSeeAdminGlobal = hasRole(session, ['SUPER_ADMIN']);
  const canSeeCondominios = hasRole(session, ['SUPER_ADMIN', 'ADMIN_CONDOMINIO']);
  const canSeeCadastros = hasRole(session, [
    'SUPER_ADMIN',
    'ADMIN_CONDOMINIO',
    'SINDICO',
  ]);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4 space-y-4">
          <Logo />
          {/* Seletor de condomínio saiu daqui, agora fica na tela de login */}
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <ActiveLink href="/">
                <Home />
                Painel
              </ActiveLink>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <ActiveLink href="/anuncios">
                <Megaphone />
                Anúncios
              </ActiveLink>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <ActiveLink href="/reservas">
                <CalendarDays />
                Reservas
              </ActiveLink>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <ActiveLink href="/reunioes">
                <Users />
                Reuniões
              </ActiveLink>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <ActiveLink href="/incidentes">
                <AlertTriangle />
                Incidentes
              </ActiveLink>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <ActiveLink href="/encomendas">
                <Package />
                Encomendas
              </ActiveLink>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <ActiveLink href="/documentos">
                <FileText />
                Documentos
              </ActiveLink>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <ActiveLink href="/enquetes">
                <Vote />
                Enquetes
              </ActiveLink>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <ActiveLink href="/acesso">
                <KeyRound />
                Acesso
              </ActiveLink>
            </SidebarMenuItem>
            {canSeeCadastros && (
              <SidebarMenuItem>
                <ActiveLink href="/cadastros">
                  <BookUser />
                  Cadastros
                </ActiveLink>
              </SidebarMenuItem>
            )}
            {canSeeCondominios && (
              <SidebarMenuItem>
                <ActiveLink href="/condominios">
                  <Building />
                  Condomínios
                </ActiveLink>
              </SidebarMenuItem>
            )}
            {canSeeAdminGlobal && (
              <SidebarMenuItem>
                <ActiveLink href="/administrador-global">
                  <Shield />
                  Administrador Global
                </ActiveLink>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <ActiveLink href="/configuracoes">
                <Settings />
                Configurações
              </ActiveLink>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-card px-4 md:px-6">
          <SidebarTrigger className="md:hidden" />
          <h1 className="font-headline text-lg font-semibold md:text-xl">
            {pageTitle}
          </h1>
          <div className="ml-auto flex items-center gap-4">
            <UserNavClient />
            {headerActions}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
