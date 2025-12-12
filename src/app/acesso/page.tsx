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
  PlusCircle,
  UserPlus,
  Clock,
  ArrowRightLeft,
  FileDown,
  Calendar as CalendarIcon,
  Repeat,
  Shield,
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
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from 'date-fns/locale';
import React from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const upcomingVisitors = [
  { name: "Ana Silva (Personal)", type: "Recorrente", details: "Seg, Qua, Sex - 08:00", unit: "Apto 101" },
  { name: "Marcos Andrade (Técnico)", type: "Único", details: "28/07/2024", unit: "Apto 304" },
  { name: "Delivery iFood", type: "Único", details: "Hoje, 19:30", unit: "Apto 802" },
];

const accessLog = [
    { name: "Ana Silva", unit: "Apto 101", timeIn: "27/07/2024 08:01", timeOut: "27/07/2024 09:05", status: "Saiu" },
    { name: "Entregador Rappi", unit: "Apto 505", timeIn: "27/07/2024 12:45", timeOut: "27/07/2024 12:50", status: "Saiu" },
    { name: "Visitante - João", unit: "Apto 202", timeIn: "27/07/2024 14:00", timeOut: "-", status: "Dentro" },
];

export default function AcessoPage() {
    const [date, setDate] = React.useState<Date>();

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
            Controle de Acesso
          </h1>
          <div className="ml-auto flex items-center gap-4">
            <form>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Pesquisar visitantes..."
                  className="w-full appearance-none bg-background pl-8 shadow-none md:w-[200px] lg:w-[320px]"
                />
              </div>
            </form>
             <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus />
                  Pré-liberar Visita
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>Pré-liberar Nova Visita</DialogTitle>
                  <DialogDescription>
                    Agilize a entrada de seus visitantes e prestadores de serviço.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="visitor-name" className="text-right">
                      Nome
                    </Label>
                    <Input id="visitor-name" placeholder="Nome completo do visitante" className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="visitor-doc" className="text-right">
                      Documento
                    </Label>
                    <Input id="visitor-doc" placeholder="CPF ou RG" className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="date" className="text-right">
                      Data da Visita
                    </Label>
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "col-span-3 justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                initialFocus
                                locale={ptBR}
                            />
                        </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="recurrent" className="text-right">
                      Visita Recorrente
                    </Label>
                    <div className="col-span-3 flex items-center gap-2">
                        <Switch id="recurrent" />
                        <span className="text-xs text-muted-foreground">Ex: diarista, personal trainer.</span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">
                    <UserPlus className="mr-2" />
                    Salvar Liberação
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <UserNavClient />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
            <Tabs defaultValue="upcoming">
              <div className="flex justify-between items-center mb-4">
                <TabsList>
                    <TabsTrigger value="upcoming"><Clock className="mr-2"/>Próximas Liberações</TabsTrigger>
                    <TabsTrigger value="log"><ArrowRightLeft className="mr-2"/>Registro de Entradas e Saídas</TabsTrigger>
                </TabsList>
                <Button variant="outline"><FileDown className="mr-2" /> Gerar Relatório</Button>
              </div>
              <TabsContent value="upcoming">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Detalhes</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {upcomingVisitors.map((visitor) => (
                             <TableRow key={visitor.name}>
                                <TableCell className="font-medium">{visitor.name}</TableCell>
                                <TableCell>{visitor.unit}</TableCell>
                                <TableCell>{visitor.type}</TableCell>
                                <TableCell>{visitor.details}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="log">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead>Entrada</TableHead>
                            <TableHead>Saída</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {accessLog.map((log) => (
                             <TableRow key={log.name + log.timeIn}>
                                <TableCell className="font-medium">{log.name}</TableCell>
                                <TableCell>{log.unit}</TableCell>
                                <TableCell>{log.timeIn}</TableCell>
                                <TableCell>{log.timeOut}</TableCell>
                                <TableCell>
                                    <Badge variant={log.status === 'Dentro' ? 'default' : 'secondary'}>{log.status}</Badge>
                                </TableCell>
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
