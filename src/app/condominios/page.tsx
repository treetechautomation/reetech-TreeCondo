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
  Edit,
  Trash2,
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
import { useCondominios } from "@/hooks/useCondominios";
import { useFirestore } from "@/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { toast } from "@/hooks/use-toast";

const condominioSchema = z.object({
  nome: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
  cnpj: z.string().optional(),
  cep: z.string().optional(),
  sindico: z.string().optional(),
  contato: z.string().optional(),
});

type CondominioFormData = z.infer<typeof condominioSchema>;

export default function CondominiosPage() {
    const { data: condominios, loading } = useCondominios();
    const firestore = useFirestore();
    const [open, setOpen] = React.useState(false);

    const { register, handleSubmit, formState: { errors }, reset } = useForm<CondominioFormData>({
        resolver: zodResolver(condominioSchema),
    });

    const onSubmit = async (data: CondominioFormData) => {
        try {
            await addDoc(collection(firestore, "condominios"), {
                ...data,
                ativo: true,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Condomínio adicionado com sucesso!" });
            reset();
            setOpen(false);
        } catch (error) {
            console.error("Erro ao adicionar condomínio: ", error);
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Não foi possível adicionar o condomínio.",
            });
        }
    };


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
            Gestão de Condomínios
          </h1>
          <div className="ml-auto flex items-center gap-4">
            <form>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Pesquisar condomínios..."
                  className="w-full appearance-none bg-background pl-8 shadow-none md:w-[200px] lg:w-[320px]"
                />
              </div>
            </form>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2" />
                  Novo Condomínio
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Condomínio</DialogTitle>
                  <DialogDescription>
                    Insira as informações do novo condomínio.
                  </DialogDescription>
                </DialogHeader>
                 <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="nome-condo" className="text-right">
                          Nome
                        </Label>
                        <Input
                          id="nome-condo"
                          placeholder="Nome do Condomínio"
                          className="col-span-3"
                          {...register("nome")}
                        />
                      </div>
                      {errors.nome && <p className="col-start-2 col-span-3 text-xs text-destructive">{errors.nome.message}</p>}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="cnpj-condo" className="text-right">
                          CNPJ
                        </Label>
                        <Input
                          id="cnpj-condo"
                          placeholder="00.000.000/0001-00"
                          className="col-span-3"
                           {...register("cnpj")}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="cep-condo" className="text-right">
                          CEP
                        </Label>
                        <Input
                          id="cep-condo"
                          placeholder="00000-000"
                          className="col-span-3"
                           {...register("cep")}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="sindico-condo" className="text-right">
                          Síndico
                        </Label>
                        <Input
                          id="sindico-condo"
                          placeholder="Nome do síndico responsável"
                          className="col-span-3"
                           {...register("sindico")}
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="contato-condo" className="text-right">
                          Contato
                        </Label>
                        <Input
                          id="contato-condo"
                          placeholder="Telefone ou e-mail"
                          className="col-span-3"
                           {...register("contato")}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">Salvar</Button>
                    </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <UserNavClient />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Condomínio</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Síndico</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                 <TableRow>
                    <TableCell colSpan={5} className="text-center">Carregando...</TableCell>
                </TableRow>
              ) : (
                condominios.map((condo) => (
                    <TableRow key={condo.id}>
                    <TableCell className="font-medium">{condo.nome}</TableCell>
                    <TableCell>{condo.cnpj}</TableCell>
                    <TableCell>{condo.sindico}</TableCell>
                    <TableCell>{condo.contato}</TableCell>
                    <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="icon">
                        <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon">
                        <Trash2 className="h-4 w-4" />
                        </Button>
                    </TableCell>
                    </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}