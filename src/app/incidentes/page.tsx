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
  Paperclip,
  Send,
  Star,
  MessageSquare,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export default function IncidentesPage() {
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
            Chamados e Incidentes
          </h1>
          <div className="ml-auto flex items-center gap-4">
            <form>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Pesquisar chamados..."
                  className="w-full appearance-none bg-background pl-8 shadow-none md:w-[200px] lg:w-[320px]"
                />
              </div>
            </form>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle />
                  Abrir Novo Chamado
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>Abrir Novo Chamado</DialogTitle>
                  <DialogDescription>
                    Descreva o seu problema ou sugestão. O gestor será notificado.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="type" className="text-right">
                      Tipo
                    </Label>
                    <Select>
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Selecione o tipo de solicitação" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="reclamacao">Reclamação</SelectItem>
                            <SelectItem value="manutencao">Manutenção</SelectItem>
                            <SelectItem value="duvida-sugestao">Dúvida/Sugestão</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right">
                      Título
                    </Label>
                    <Input id="title" placeholder="Ex: Lâmpada do corredor queimada" className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">
                      Descrição
                    </Label>
                    <Textarea id="description" placeholder="Detalhe o que está acontecendo." className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Foto</Label>
                    <div className="col-span-3">
                        <Button variant="outline">
                            <Paperclip className="mr-2" />
                            Anexar Foto
                        </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">
                    <Send className="mr-2" />
                    Enviar Chamado
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <UserNav />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-lg">Lâmpada queimada</CardTitle>
                                <CardDescription>Aberto por João (Apto 101) - há 1 dia</CardDescription>
                            </div>
                            <Badge variant="destructive">Manutenção</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">A lâmpada do corredor do 1º andar, em frente ao elevador, está queimada.</p>
                        <Separator className="my-4" />
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold">Histórico</h4>
                             <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Gestor:</span> "Recebido. Encaminhado para o zelador." (há 1 dia)</p>
                             <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Sistema:</span> Chamado aberto. (há 1 dia)</p>
                        </div>
                    </CardContent>
                    <CardFooter className="justify-between">
                         <Badge>Em Andamento</Badge>
                         <Button variant="outline" size="sm"><MessageSquare className="mr-2" /> Comentar</Button>
                    </CardFooter>
                </Card>
                 <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-lg">Barulho após as 22h</CardTitle>
                                <CardDescription>Aberto por Maria (Apto 304) - há 3 dias</CardDescription>
                            </div>
                            <Badge variant="secondary">Reclamação</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">O vizinho do 404 está fazendo muito barulho de festa durante a semana.</p>
                         <Separator className="my-4" />
                        <div className="space-y-3">
                             <h4 className="text-sm font-semibold">Histórico</h4>
                             <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Maria (Apto 304):</span> "Obrigada!" (há 2 dias)</p>
                             <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Gestor:</span> "Prezada Maria, o morador foi notificado. Por favor, nos informe caso o problema persista." (há 2 dias)</p>
                             <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Sistema:</span> Chamado aberto. (há 3 dias)</p>
                        </div>
                    </CardContent>
                    <CardFooter className="justify-between items-center">
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">Resolvido</Badge>
                        <div className="flex items-center gap-1 text-sm">
                            <span className="text-muted-foreground">Sua Avaliação:</span>
                            <Star className="text-yellow-400 fill-yellow-400" />
                            <Star className="text-yellow-400 fill-yellow-400" />
                            <Star className="text-yellow-400 fill-yellow-400" />
                            <Star className="text-yellow-400 fill-yellow-400" />
                            <Star className="text-muted-foreground" />
                        </div>
                    </CardFooter>
                </Card>
                 <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-lg">Sugestão de lixeiras</CardTitle>
                                <CardDescription>Aberto por Carlos (Apto 802) - há 5 dias</CardDescription>
                            </div>
                            <Badge>Dúvida/Sugestão</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Sugiro a instalação de lixeiras para coleta seletiva em cada andar.</p>
                         <Separator className="my-4" />
                        <div className="space-y-3">
                             <h4 className="text-sm font-semibold">Histórico</h4>
                             <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Gestor:</span> "Ótima sugestão, Carlos! Levaremos para a próxima reunião de conselho." (há 4 dias)</p>
                             <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Sistema:</span> Chamado aberto. (há 5 dias)</p>
                        </div>
                    </CardContent>
                    <CardFooter className="justify-between">
                         <Badge>Finalizado</Badge>
                         <Button variant="outline" size="sm" disabled><Star className="mr-2" /> Avaliar</Button>
                    </CardFooter>
                </Card>
            </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
