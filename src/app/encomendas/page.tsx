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
  PlusCircle,
  QrCode,
  PackageCheck,
  Camera,
  Archive,
  Clock,
  History,
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
import { UserNav } from "@/components/user-nav";
import { ActiveLink } from "@/components/active-link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const waitingPackages = [
    { id: "PKG001", unit: "Apto 101", carrier: "Correios", arrival: "28/07/2024 10:30", code: "A1B2C3D4" },
    { id: "PKG002", unit: "Apto 504", carrier: "Mercado Livre", arrival: "28/07/2024 14:00", code: "E5F6G7H8" },
    { id: "PKG003", unit: "Apto 802", carrier: "Amazon", arrival: "27/07/2024 18:15", code: "I9J0K1L2" },
];

const deliveredPackages = [
    { id: "PKG004", unit: "Apto 202", carrier: "FedEx", arrival: "26/07/2024 11:00", pickup: "26/07/2024 19:00", by: "Maria Oliveira" },
    { id: "PKG005", unit: "Apto 301", carrier: "DHL", arrival: "25/07/2024 09:20", pickup: "25/07/2024 12:30", by: "João da Silva" },
]


export default function EncomendasPage() {
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
            Gestão de Encomendas
          </h1>
          <div className="ml-auto flex items-center gap-4">
            <form>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Pesquisar por unidade ou código..."
                  className="w-full appearance-none bg-background pl-8 shadow-none md:w-[200px] lg:w-[320px]"
                />
              </div>
            </form>
             <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle />
                  Registrar Nova Encomenda
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Registrar Nova Encomenda</DialogTitle>
                  <DialogDescription>
                    Insira os dados da encomenda e notifique o morador.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="unit" className="text-right">
                      Unidade
                    </Label>
                    <Input id="unit" placeholder="Ex: Apto 101" className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="carrier" className="text-right">
                      Transportadora
                    </Label>
                     <Input id="carrier" placeholder="Ex: Correios, Mercado Livre" className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Foto</Label>
                    <div className="col-span-3">
                        <Button variant="outline">
                            <Camera className="mr-2" />
                            Tirar Foto do Pacote
                        </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">
                    <PackageCheck className="mr-2"/>
                    Registrar e Notificar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <UserNav />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
            <Tabs defaultValue="waiting">
              <TabsList className="mb-4">
                  <TabsTrigger value="waiting"><Clock className="mr-2" />Aguardando Retirada</TabsTrigger>
                  <TabsTrigger value="history"><History className="mr-2" />Histórico de Retiradas</TabsTrigger>
              </TabsList>
              <TabsContent value="waiting">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Cód. Encomenda</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead>Transportadora</TableHead>
                            <TableHead>Chegada</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                       {waitingPackages.map((pkg) => (
                         <TableRow key={pkg.id}>
                            <TableCell className="font-mono">{pkg.id}</TableCell>
                            <TableCell>{pkg.unit}</TableCell>
                            <TableCell>{pkg.carrier}</TableCell>
                            <TableCell>{pkg.arrival}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="outline" size="sm">
                                    <QrCode className="mr-2" />
                                    Registrar Retirada
                                </Button>
                            </TableCell>
                        </TableRow>
                       ))}
                    </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="history">
                 <Table>
                    <TableHeader>
                        <TableRow>
                             <TableHead>Cód. Encomenda</TableHead>
                             <TableHead>Unidade</TableHead>
                             <TableHead>Transportadora</TableHead>
                             <TableHead>Chegada</TableHead>
                             <TableHead>Retirada</TableHead>
                             <TableHead>Retirado por</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                       {deliveredPackages.map((pkg) => (
                         <TableRow key={pkg.id}>
                            <TableCell className="font-mono">{pkg.id}</TableCell>
                            <TableCell>{pkg.unit}</TableCell>
                            <TableCell>{pkg.carrier}</TableCell>
                            <TableCell>{pkg.arrival}</TableCell>
                            <TableCell>{pkg.pickup}</TableCell>
                            <TableCell>{pkg.by}</TableCell>
                        </TableRow>
                       ))}
                    </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
