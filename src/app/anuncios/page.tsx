"use client";

import {
  Home,
  Megaphone,
  CalendarDays,
  Users,
  AlertTriangle,
  Package,
  Contact,
  Settings,
  Search,
  PlusCircle,
  Image as ImageIcon,
  Send,
  Vote,
  KeyRound,
  BookUser,
  Building,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { useState } from "react";

export default function AnunciosPage() {
    const [destination, setDestination] = useState("all");

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
              <ActiveLink href="/diretorio">
                <Contact />
                Diretório
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
            Anúncios
          </h1>
          <div className="ml-auto flex items-center gap-4">
            <form>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Pesquisar anúncios..."
                  className="w-full appearance-none bg-background pl-8 shadow-none md:w-[200px] lg:w-[320px]"
                />
              </div>
            </form>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle />
                  Novo Anúncio
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Criar Novo Anúncio</DialogTitle>
                  <DialogDescription>
                    Envie comunicados para os moradores. O disparo será feito em tempo real.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">
                      Título
                    </Label>
                    <Input id="title" placeholder="Ex: Manutenção da Piscina" className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="message" className="text-right">
                      Mensagem
                    </Label>
                    <Textarea id="message" placeholder="Detalhe o seu anúncio aqui." className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Foto</Label>
                    <div className="col-span-3">
                        <Button variant="outline">
                            <ImageIcon className="mr-2" />
                            Adicionar Foto
                        </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Destino</Label>
                    <RadioGroup defaultValue="all" className="col-span-3 flex flex-col gap-2" onValueChange={setDestination}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="all" id="r1" />
                            <Label htmlFor="r1">Todo o Condomínio</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="tower" id="r2" />
                            <Label htmlFor="r2">Bloco ou Torre Específica</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="unit" id="r3" />
                            <Label htmlFor="r3">Unidade ou Pessoa Específica</Label>
                        </div>
                    </RadioGroup>
                  </div>
                  {destination === 'tower' && (
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="tower-select" className="text-right">Bloco/Torre</Label>
                        {/* This would be a select with actual data */}
                        <Input id="tower-select" placeholder="Ex: Bloco A" className="col-span-3" />
                     </div>
                  )}
                  {destination === 'unit' && (
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="unit-select" className="text-right">Unidade/Pessoa</Label>
                        <Input id="unit-select" placeholder="Ex: Apto 101 ou João Silva" className="col-span-3" />
                     </div>
                  )}

                </div>
                <DialogFooter>
                  <Button type="submit">
                    <Send className="mr-2" />
                    Enviar Notificação
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <UserNav />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
            <div className="space-y-4">
                <Card>
                    <CardHeader className="flex flex-row items-start gap-4">
                        <Avatar className="h-10 w-10 border">
                            <AvatarImage src="https://picsum.photos/seed/admin-1/40/40" alt="Avatar" data-ai-hint="person face" />
                            <AvatarFallback>S</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle>Manutenção da Piscina Agendada</CardTitle>
                            <CardDescription>Enviado por Síndico Admin - há 2 dias para Todo o Condomínio</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4">
                        Prezados moradores, informamos que a piscina será fechada para manutenção anual no dia 28 de Julho. Agradecemos a compreensão.
                        </p>
                        <Image
                            src="https://picsum.photos/seed/pool/600/400"
                            alt="Piscina em manutenção"
                            width={600}
                            height={400}
                            className="rounded-md object-cover"
                            data-ai-hint="swimming pool"
                        />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-start gap-4">
                        <Avatar className="h-10 w-10 border">
                            <AvatarImage src="https://picsum.photos/seed/admin-1/40/40" alt="Avatar" data-ai-hint="person face" />
                            <AvatarFallback>S</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle>Controle de Pragas Trimestral</CardTitle>
                            <CardDescription>Enviado por Síndico Admin - há 5 dias para Todo o Condomínio</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p>
                        O controle de pragas trimestral está agendado para 1º de Agosto. Por favor, garantam que as áreas comuns e, se necessário, suas unidades, estejam acessíveis para a equipe.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
