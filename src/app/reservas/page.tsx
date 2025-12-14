
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
  Clock,
  User,
  PartyPopper,
  Flame,
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import React from "react";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const areas = [
    { 
        id: "salao-festas", 
        name: "Salão de Festas", 
        icon: PartyPopper, 
        image: "https://picsum.photos/seed/party/400/200", 
        hint: "party balloons",
        capacity: 50,
        description: "Espaço amplo para eventos, com cozinha de apoio." 
    },
    { 
        id: "churrasqueira", 
        name: "Churrasqueira", 
        icon: Flame, 
        image: "https://picsum.photos/seed/bbq/400/200", 
        hint: "barbecue grill",
        capacity: 20,
        description: "Área coberta com churrasqueira e mesas."
    },
];

const reservationsToday = [
    { area: "Salão de Festas", time: "19:00 - 23:00", user: "Ana Paula (Apto 302)"},
    { area: "Churrasqueira", time: "12:00 - 16:00", user: "Carlos Silva (Apto 101)"},
]

export default function ReservasPage() {
  const [date, setDate] = React.useState<Date | undefined>(new Date());

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
            Reservas de Áreas Comuns
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
             <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle />
                  Nova Reserva
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Fazer Nova Reserva</DialogTitle>
                  <DialogDescription>
                    Selecione a área, data e horário desejado.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="area" className="text-right">
                      Área
                    </Label>
                    <Select>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Selecione uma área" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="salao">Salão de Festas</SelectItem>
                        <SelectItem value="churrasqueira">Churrasqueira</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="date" className="text-right">
                      Data
                    </Label>
                    <Input id="date" type="date" className="col-span-3" defaultValue={new Date().toISOString().substring(0, 10)} />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Horário</Label>
                    <div className="col-span-3 grid grid-cols-2 gap-2">
                        <Input id="start-time" type="time" />
                        <Input id="end-time" type="time" />
                     </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="notes" className="text-right">
                      Observações
                    </Label>
                    <Textarea id="notes" placeholder="Ex: Aniversário infantil" className="col-span-3" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Confirmar Reserva</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <UserNavClient />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                <div className="lg:col-span-2 grid gap-6 auto-rows-max">
                     {areas.map((area) => (
                        <Card key={area.id} className="overflow-hidden">
                             <div className="grid md:grid-cols-2">
                                <div className="p-6">
                                    <CardHeader className="p-0 mb-4">
                                        <div className="flex items-center gap-3">
                                            <area.icon className="w-8 h-8 text-primary"/>
                                            <CardTitle>{area.name}</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardDescription>{area.description}</CardDescription>
                                    <CardContent className="p-0 mt-4 text-sm text-muted-foreground">
                                        <p>Capacidade: {area.capacity} pessoas</p>
                                        <p>Disponibilidade: Ver no calendário</p>
                                    </CardContent>
                                    <CardFooter className="p-0 mt-4">
                                        <Button>Reservar {area.name}</Button>
                                    </CardFooter>
                                </div>
                                <div className="min-h-[150px] md:min-h-0">
                                     <img src={area.image} alt={area.name} data-ai-hint={area.hint} className="w-full h-full object-cover"/>
                                </div>
                             </div>
                        </Card>
                     ))}
                </div>
                <div className="space-y-6">
                    <Card className="flex justify-center">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            className="p-0"
                            classNames={{
                                head_cell: 'w-full',
                                cell: 'w-full',
                            }}
                        />
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Reservas para Hoje</CardTitle>
                            <CardDescription>
                                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-4">
                                {reservationsToday.map(res => (
                                <li key={res.area} className="flex items-center gap-4 text-sm">
                                    <div className="bg-muted rounded-lg p-2">
                                        {res.area === "Salão de Festas" ? <PartyPopper/> : <Flame/>}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold">{res.area}</p>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Clock className="h-4 w-4"/>
                                            <span>{res.time}</span>
                                        </div>
                                         <div className="flex items-center gap-2 text-muted-foreground">
                                            <User className="h-4 w-4"/>
                                            <span>{res.user}</span>
                                        </div>
                                    </div>
                                </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

    