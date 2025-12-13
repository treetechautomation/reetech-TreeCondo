"use client";

import * as React from "react";
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
  FileDown,
  Calendar as CalendarIcon,
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ReunioesPage() {
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
            <SidebarMenuItem>
              <ActiveLink href="/cadastros">
                <BookUser />
                Cadastros
              </ActiveLink>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <ActiveLink href="/condominios">
                <Building />
                Condomínios
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
            Reuniões
          </h1>
          <div className="ml-auto flex items-center gap-4">
            <form>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Pesquisar reuniões..."
                  className="w-full appearance-none bg-background pl-8 shadow-none md:w-[200px] lg:w-[320px]"
                />
              </div>
            </form>
             <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle />
                  Nova Reunião
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Agendar Nova Reunião</DialogTitle>
                  <DialogDescription>
                    Preencha os detalhes para agendar uma nova reunião e notificar os moradores.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">
                      Título
                    </Label>
                    <Input id="title" placeholder="Ex: Assembleia Geral Ordinária" className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="date" className="text-right">
                      Data
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
                     <Label className="text-right">Horário</Label>
                     <div className="col-span-3 grid grid-cols-2 gap-2">
                        <Input id="start-time" type="time" />
                        <Input id="end-time" type="time" />
                     </div>
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="location" className="text-right">
                      Local
                    </Label>
                    <Select>
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Selecione o espaço" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="salao">Salão de Festas</SelectItem>
                            <SelectItem value="reunioes">Sala de Reuniões</SelectItem>
                            <SelectItem value="churrasqueira">Churrasqueira</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="agenda" className="text-right">
                      Pautas
                    </Label>
                    <Textarea id="agenda" placeholder="1. Aprovação de contas&#x0a;2. Eleição de síndico&#x0a;3. Assuntos gerais" className="col-span-3" rows={4} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">
                    <CalendarDays className="mr-2" />
                    Agendar e Notificar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <UserNavClient />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
           <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle>Assembleia Geral Ordinária</CardTitle>
                                <CardDescription>Agendada para 30 de Julho de 2024, às 19:00 - Salão de Festas</CardDescription>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline">
                                        <FileDown className="mr-2" />
                                        Gerar Documentos
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem>Protocolo de Convocação</DropdownMenuItem>
                                    <DropdownMenuItem>Lista de Presença</DropdownMenuItem>
                                    <DropdownMenuItem>Carta de Convocação (Modelo)</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <h4 className="font-semibold mb-2">Pautas:</h4>
                        <ul className="list-disc pl-5 text-muted-foreground">
                            <li>Aprovação das contas do último exercício.</li>
                            <li>Eleição do novo síndico e conselho fiscal.</li>
                            <li>Previsão orçamentária para o próximo ano.</li>
                            <li>Assuntos gerais.</li>
                        </ul>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle>Reunião do Conselho Fiscal</CardTitle>
                                <CardDescription>Agendada para 15 de Agosto de 2024, às 20:00 - Sala de Reuniões</CardDescription>
                            </div>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" disabled>
                                        <FileDown className="mr-2" />
                                        Gerar Documentos
                                    </Button>
                                </DropdownMenuTrigger>
                            </DropdownMenu>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <h4 className="font-semibold mb-2">Pautas:</h4>
                         <ul className="list-disc pl-5 text-muted-foreground">
                            <li>Análise dos balancetes de Junho e Julho.</li>
                            <li>Discussão sobre investimentos.</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
