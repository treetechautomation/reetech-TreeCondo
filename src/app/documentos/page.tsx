
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
  Upload,
  Download,
  Eye,
  FileUp,
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


const balancetes = [
    {
        name: "Balancete Mensal - Junho 2024",
        date: "05/07/2024",
        size: "1.2 MB",
    },
    {
        name: "Balancete Mensal - Maio 2024",
        date: "04/06/2024",
        size: "1.1 MB",
    },
    {
        name: "Balancete Mensal - Abril 2024",
        date: "05/05/2024",
        size: "1.3 MB",
    }
];

const atas = [
    {
        name: "Ata da Assembleia Geral Ordinária - 30/07/2024",
        date: "01/08/2024",
        size: "800 KB",
    },
    {
        name: "Ata da Reunião do Conselho - 15/05/2024",
        date: "16/05/2024",
        size: "450 KB",
    },
];

const regimento = [
     {
        name: "Regimento Interno - Versão 2023",
        date: "10/01/2023",
        size: "2.5 MB",
    },
    {
        name: "Convenção do Condomínio - Versão 2020",
        date: "15/02/2020",
        size: "3.1 MB",
    }
]


export default function DocumentosPage() {
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
            Documentos do Condomínio
          </h1>
          <div className="ml-auto flex items-center gap-4">
            <form>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Pesquisar documentos..."
                  className="w-full appearance-none bg-background pl-8 shadow-none md:w-[200px] lg:w-[320px]"
                />
              </div>
            </form>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Upload />
                  Carregar Documento
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Carregar Novo Documento</DialogTitle>
                  <DialogDescription>
                    Faça o upload de um novo documento para o condomínio.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="doc-name" className="text-right">
                      Nome
                    </Label>
                    <Input id="doc-name" placeholder="Ex: Balancete de Agosto 2024" className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="doc-type" className="text-right">
                      Tipo
                    </Label>
                    <Select>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="balancete">Balancete</SelectItem>
                        <SelectItem value="ata">Ata</SelectItem>
                        <SelectItem value="regimento">Regimento/Convenção</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Arquivo</Label>
                    <div className="col-span-3">
                        <Button variant="outline">
                            <FileUp className="mr-2" />
                            Selecionar Arquivo
                        </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">
                    <Upload className="mr-2" />
                    Enviar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <UserNavClient />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
            <Tabs defaultValue="balancetes">
              <TabsList>
                <TabsTrigger value="balancetes">Balancetes</TabsTrigger>
                <TabsTrigger value="atas">Atas</TabsTrigger>
                <TabsTrigger value="regimento">Regimento e Convenções</TabsTrigger>
              </TabsList>
              <TabsContent value="balancetes">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome do Arquivo</TableHead>
                            <TableHead className="w-[150px]">Data de Publicação</TableHead>
                            <TableHead className="w-[120px]">Tamanho</TableHead>
                            <TableHead className="w-[180px] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {balancetes.map((doc) => (
                             <TableRow key={doc.name}>
                                <TableCell className="font-medium">{doc.name}</TableCell>
                                <TableCell>{doc.date}</TableCell>
                                <TableCell>{doc.size}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="sm"><Eye /> Visualizar</Button>
                                    <Button variant="secondary" size="sm"><Download /> Baixar</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="atas">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome do Arquivo</TableHead>
                            <TableHead className="w-[150px]">Data de Publicação</TableHead>
                            <TableHead className="w-[120px]">Tamanho</TableHead>
                            <TableHead className="w-[180px] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {atas.map((doc) => (
                             <TableRow key={doc.name}>
                                <TableCell className="font-medium">{doc.name}</TableCell>
                                <TableCell>{doc.date}</TableCell>
                                <TableCell>{doc.size}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="sm"><Eye /> Visualizar</Button>
                                    <Button variant="secondary" size="sm"><Download /> Baixar</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="regimento">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome do Arquivo</TableHead>
                            <TableHead className="w-[150px]">Data de Publicação</TableHead>
                            <TableHead className="w-[120px]">Tamanho</TableHead>
                            <TableHead className="w-[180px] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {regimento.map((doc) => (
                             <TableRow key={doc.name}>
                                <TableCell className="font-medium">{doc.name}</TableCell>
                                <TableCell>{doc.date}</TableCell>
                                <TableCell>{doc.size}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="sm"><Eye /> Visualizar</Button>
                                    <Button variant="secondary" size="sm"><Download /> Baixar</Button>
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

    
