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
  User,
  ClipboardList,
  Car,
  Truck,
  Dog,
  Trash2,
  Edit,
  Blocks,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const moradores = [
    { id: 1, nome: "João da Silva", unidade: "Apto 101", perfil: "Proprietário", contato: "(11) 98765-4321" },
    { id: 2, nome: "Maria Oliveira", unidade: "Apto 203", perfil: "Inquilino", contato: "(21) 91234-5678" },
    { id: 3, nome: "Carlos Pereira (Síndico)", unidade: "Apto 505", perfil: "Síndico", contato: "(31) 99999-8888" },
];

const funcionarios = [
    { id: 1, nome: "José Almeida", cargo: "Zelador", horario: "08:00 - 17:00", contato: "(11) 98888-7777" },
    { id: 2, nome: "Ana Costa", cargo: "Porteiro", horario: "07:00 - 15:00 (Diurno)", contato: "(11) 97777-6666" },
];

const veiculos = [
    { id: 1, placa: "ABC-1234", modelo: "Honda Civic", unidade: "Apto 101" },
    { id: 2, placa: "XYZ-5678", modelo: "Toyota Corolla", unidade: "Apto 203" },
];

const fornecedores = [
    { id: 1, nome: "Jardim & Cia", servico: "Jardinagem", contato: "contato@jardimcia.com" },
    { id: 2, nome: "Limpa Mais", servico: "Limpeza Geral", contato: "(11) 5555-4444" },
];

const pets = [
    { id: 1, nome: "Rex", raca: "Labrador", porte: "Grande", unidade: "Apto 101" },
    { id: 2, nome: "Mimi", raca: "Siamês", porte: "Pequeno", unidade: "Apto 203" },
];

const blocos = [
    { id: 1, nome: "Bloco A", unidades: 40 },
    { id: 2, nome: "Bloco B", unidades: 40 },
];


export default function CadastrosPage() {
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
            Gestão de Cadastro
          </h1>
          <div className="ml-auto flex items-center gap-4">
            <form>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Pesquisar em todos os cadastros..."
                  className="w-full appearance-none bg-background pl-8 shadow-none md:w-[200px] lg:w-[320px]"
                />
              </div>
            </form>
            <UserNav />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Tabs defaultValue="moradores">
            <TabsList className="mb-4">
              <TabsTrigger value="moradores"><User className="mr-2"/>Moradores</TabsTrigger>
              <TabsTrigger value="funcionarios"><ClipboardList className="mr-2"/>Funcionários</TabsTrigger>
              <TabsTrigger value="veiculos"><Car className="mr-2"/>Veículos</TabsTrigger>
              <TabsTrigger value="fornecedores"><Truck className="mr-2"/>Fornecedores</TabsTrigger>
              <TabsTrigger value="pets"><Dog className="mr-2"/>Pets</TabsTrigger>
              <TabsTrigger value="blocos"><Blocks className="mr-2"/>Blocos</TabsTrigger>
            </TabsList>
            
            {/* Tab de Moradores */}
            <TabsContent value="moradores">
              <div className="flex justify-end mb-4">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2" />Adicionar Morador</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Novo Morador</DialogTitle>
                            <DialogDescription>Insira os dados do novo morador.</DialogDescription>
                        </DialogHeader>
                         <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="nome-morador" className="text-right">Nome</Label>
                                <Input id="nome-morador" placeholder="Nome completo" className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="unidade-morador" className="text-right">Unidade</Label>
                                <Input id="unidade-morador" placeholder="Ex: Apto 101" className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="perfil-morador" className="text-right">Perfil</Label>
                                <Select>
                                    <SelectTrigger className="col-span-3"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="proprietario">Proprietário</SelectItem>
                                        <SelectItem value="inquilino">Inquilino</SelectItem>
                                        <SelectItem value="sindico">Síndico</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="contato-morador" className="text-right">Contato</Label>
                                <Input id="contato-morador" placeholder="(99) 99999-9999" className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="lgpd" className="text-right">LGPD</Label>
                                <div className="flex items-center space-x-2 col-span-3">
                                    <Checkbox id="lgpd-terms" />
                                    <label htmlFor="lgpd-terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                       Li e concordo com os termos.
                                    </label>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Perfil</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {moradores.map(m => (
                        <TableRow key={m.id}>
                            <TableCell>{m.nome}</TableCell>
                            <TableCell>{m.unidade}</TableCell>
                            <TableCell>{m.perfil}</TableCell>
                            <TableCell>{m.contato}</TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button variant="outline" size="icon"><Edit className="h-4 w-4"/></Button>
                                <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4"/></Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Tab de Funcionários */}
             <TabsContent value="funcionarios">
              <div className="flex justify-end mb-4">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2" />Adicionar Funcionário</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Novo Funcionário</DialogTitle>
                            <DialogDescription>Insira os dados do novo funcionário.</DialogDescription>
                        </DialogHeader>
                         <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="nome-funcionario" className="text-right">Nome</Label>
                                <Input id="nome-funcionario" placeholder="Nome completo" className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="cargo-funcionario" className="text-right">Cargo</Label>
                                <Input id="cargo-funcionario" placeholder="Ex: Zelador" className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="horario-funcionario" className="text-right">Horário</Label>
                                <Input id="horario-funcionario" placeholder="Ex: 08:00 - 17:00" className="col-span-3" />
                            </div>
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="contato-funcionario" className="text-right">Contato</Label>
                                <Input id="contato-funcionario" placeholder="(99) 99999-9999" className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Horário</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                     {funcionarios.map(f => (
                        <TableRow key={f.id}>
                            <TableCell>{f.nome}</TableCell>
                            <TableCell>{f.cargo}</TableCell>
                            <TableCell>{f.horario}</TableCell>
                             <TableCell>{f.contato}</TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button variant="outline" size="icon"><Edit className="h-4 w-4"/></Button>
                                <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4"/></Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Tab de Veículos */}
             <TabsContent value="veiculos">
               <div className="flex justify-end mb-4">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2" />Adicionar Veículo</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Novo Veículo</DialogTitle>
                            <DialogDescription>Insira os dados do novo veículo.</DialogDescription>
                        </DialogHeader>
                         <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="placa-veiculo" className="text-right">Placa</Label>
                                <Input id="placa-veiculo" placeholder="ABC-1234" className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="modelo-veiculo" className="text-right">Modelo</Label>
                                <Input id="modelo-veiculo" placeholder="Ex: Honda Civic" className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="unidade-veiculo" className="text-right">Unidade</Label>
                                <Input id="unidade-veiculo" placeholder="Ex: Apto 101" className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Placa</TableHead>
                        <TableHead>Modelo</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {veiculos.map(v => (
                        <TableRow key={v.id}>
                            <TableCell>{v.placa}</TableCell>
                            <TableCell>{v.modelo}</TableCell>
                            <TableCell>{v.unidade}</TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button variant="outline" size="icon"><Edit className="h-4 w-4"/></Button>
                                <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4"/></Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TabsContent>

             {/* Tab de Fornecedores */}
             <TabsContent value="fornecedores">
               <div className="flex justify-end mb-4">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2" />Adicionar Fornecedor</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Novo Fornecedor</DialogTitle>
                            <DialogDescription>Insira os dados do novo fornecedor.</DialogDescription>
                        </DialogHeader>
                         <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="nome-fornecedor" className="text-right">Nome</Label>
                                <Input id="nome-fornecedor" placeholder="Nome da empresa" className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="servico-fornecedor" className="text-right">Serviço</Label>
                                <Input id="servico-fornecedor" placeholder="Ex: Jardinagem" className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="contato-fornecedor" className="text-right">Contato</Label>
                                <Input id="contato-fornecedor" placeholder="Email ou telefone" className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {fornecedores.map(f => (
                         <TableRow key={f.id}>
                            <TableCell>{f.nome}</TableCell>
                            <TableCell>{f.servico}</TableCell>
                            <TableCell>{f.contato}</TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button variant="outline" size="icon"><Edit className="h-4 w-4"/></Button>
                                <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4"/></Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TabsContent>

             {/* Tab de Pets */}
             <TabsContent value="pets">
               <div className="flex justify-end mb-4">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2" />Adicionar Pet</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Novo Pet</DialogTitle>
                            <DialogDescription>Insira os dados do pet.</DialogDescription>
                        </DialogHeader>
                         <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="nome-pet" className="text-right">Nome</Label>
                                <Input id="nome-pet" placeholder="Nome do animal" className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="raca-pet" className="text-right">Raça</Label>
                                <Input id="raca-pet" placeholder="Ex: Labrador" className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="porte-pet" className="text-right">Porte</Label>
                                 <Select>
                                    <SelectTrigger className="col-span-3"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pequeno">Pequeno</SelectItem>
                                        <SelectItem value="medio">Médio</SelectItem>
                                        <SelectItem value="grande">Grande</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="unidade-pet" className="text-right">Unidade</Label>
                                <Input id="unidade-pet" placeholder="Ex: Apto 101" className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Raça</TableHead>
                        <TableHead>Porte</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                     {pets.map(p => (
                        <TableRow key={p.id}>
                            <TableCell>{p.nome}</TableCell>
                            <TableCell>{p.raca}</TableCell>
                            <TableCell>{p.porte}</TableCell>
                            <TableCell>{p.unidade}</TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button variant="outline" size="icon"><Edit className="h-4 w-4"/></Button>
                                <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4"/></Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Tab de Blocos */}
            <TabsContent value="blocos">
              <div className="flex justify-end mb-4">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2" />Adicionar Bloco</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Novo Bloco</DialogTitle>
                            <DialogDescription>Insira os dados do novo bloco.</DialogDescription>
                        </DialogHeader>
                         <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="nome-bloco" className="text-right">Nome</Label>
                                <Input id="nome-bloco" placeholder="Ex: Bloco A" className="col-span-3" />
                            </div>
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="unidades-bloco" className="text-right">Nº de Unidades</Label>
                                <Input id="unidades-bloco" type="number" placeholder="Ex: 40" className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome do Bloco</TableHead>
                        <TableHead>Nº de Unidades</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                     {blocos.map(b => (
                        <TableRow key={b.id}>
                            <TableCell>{b.nome}</TableCell>
                            <TableCell>{b.unidades}</TableCell>
                            <TableCell className="text-right space-x-2">
                                <Button variant="outline" size="icon"><Edit className="h-4 w-4"/></Button>
                                <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4"/></Button>
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
