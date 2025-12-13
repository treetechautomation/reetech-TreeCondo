"use client";

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
  UserCheck,
  User,
  DoorOpen,
} from "lucide-react";
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
} from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { Input } from "@/components/ui/input";
import { UserNavClient } from "@/components/user-nav-client";
import { ActiveLink } from "@/components/active-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClaims } from "@/firebase"; // vem do provider.tsx atualizado

const modules = [
  { id: "painel", name: "Painel", icon: Home, roles: { sindico: true, morador: true, porteiro: true } },
  { id: "anuncios", name: "Anúncios", icon: Megaphone, roles: { sindico: true, morador: true, porteiro: false } },
  { id: "reservas", name: "Reservas", icon: CalendarDays, roles: { sindico: true, morador: true, porteiro: false } },
  { id: "reunioes", name: "Reuniões", icon: Users, roles: { sindico: true, morador: true, porteiro: false } },
  { id: "incidentes", name: "Chamados e Incidentes", icon: AlertTriangle, roles: { sindico: true, morador: true, porteiro: true } },
  { id: "encomendas", name: "Encomendas", icon: Package, roles: { sindico: true, morador: true, porteiro: true } },
  { id: "documentos", name: "Documentos", icon: FileText, roles: { sindico: true, morador: true, porteiro: false } },
  { id: "enquetes", name: "Enquetes e Votações", icon: Vote, roles: { sindico: true, morador: true, porteiro: false } },
  { id: "acesso", name: "Controle de Acesso", icon: KeyRound, roles: { sindico: true, morador: true, porteiro: true } },
  { id: "cadastros", name: "Gestão de Cadastro", icon: BookUser, roles: { sindico: true, morador: false, porteiro: false } },
  { id: "condominios", name: "Gestão de Condomínios", icon: Building, roles: { sindico: false, morador: false, porteiro: false } },
  { id: "configuracoes", name: "Configurações", icon: Settings, roles: { sindico: true, morador: true, porteiro: true } },
];

export default function AdministradorGlobalPage() {
  const router = useRouter();
  const { claims, isClaimsLoading } = useClaims();

  const isSuperAdmin = claims?.super_admin === true;

  useEffect(() => {
    if (isClaimsLoading) return;

    if (!isSuperAdmin) {
      router.replace("/"); // ou "/login" se preferir
    }
  }, [isClaimsLoading, isSuperAdmin, router]);

  if (isClaimsLoading) return null;
  if (!isSuperAdmin) return null;

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Logo />
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
                Chamados e Incidentes
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
                Enquetes e Votações
              </ActiveLink>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <ActiveLink href="/acesso">
                <KeyRound />
                Controle de Acesso
              </ActiveLink>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <ActiveLink href="/cadastros">
                <BookUser />
                Gestão de Cadastro
              </ActiveLink>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <ActiveLink href="/condominios">
                <Building />
                Gestão de Condomínios
              </ActiveLink>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <ActiveLink href="/administrador-global">
                <Shield />
                Administrador Global
              </ActiveLink>
            </SidebarMenuItem>
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
        <header className="flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
          <SidebarTrigger className="md:hidden" />
          <h1 className="font-headline text-lg font-semibold md:text-xl">
            Administrador Global
          </h1>

          <div className="ml-auto flex items-center gap-4">
            <form>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Pesquisar..."
                  className="w-full appearance-none bg-background pl-8 shadow-none md:w-[200px] lg:w-[320px]"
                />
              </div>
            </form>

            <UserNavClient />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Gestão de Permissões de Menu</CardTitle>
                  <CardDescription>
                    Controle a visibilidade dos itens de menu para cada perfil de usuário.
                  </CardDescription>
                </div>

                <div className="w-64">
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar Condomínio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="condo1">Condomínio Vila das Flores</SelectItem>
                      <SelectItem value="condo2">Residencial Bosque Verde</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Módulo</TableHead>
                    <TableHead className="text-center">
                      <UserCheck className="inline-block mr-2" />
                      Síndico
                    </TableHead>
                    <TableHead className="text-center">
                      <User className="inline-block mr-2" />
                      Morador
                    </TableHead>
                    <TableHead className="text-center">
                      <DoorOpen className="inline-block mr-2" />
                      Porteiro
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {modules.map((mod) => (
                    <TableRow key={mod.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <mod.icon className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{mod.name}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <Switch defaultChecked={mod.roles.sindico} aria-label={`${mod.name} - Síndico`} />
                      </TableCell>

                      <TableCell className="text-center">
                        <Switch defaultChecked={mod.roles.morador} aria-label={`${mod.name} - Morador`} />
                      </TableCell>

                      <TableCell className="text-center">
                        <Switch defaultChecked={mod.roles.porteiro} aria-label={`${mod.name} - Porteiro`} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end mt-6">
                <Button>Salvar Alterações</Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
