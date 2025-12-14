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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useMemo, useState } from "react";
import { useCondominios } from "@/hooks/useCondominios";
import {
  criarCondominio,
  deletarCondominio,
} from "@/firebase/firestore/condominios.service";
import { useFirestore, useUser, useClaims } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

export default function CondominiosPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { claims, isClaimsLoading } = useClaims();
  const { toast } = useToast();

  const isSuperAdmin = claims?.super_admin === true;

  const { data: condominios, loading } = useCondominios();

  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cep, setCep] = useState("");
  const [saving, setSaving] = useState(false);

  const canRender = useMemo(() => {
    if (isUserLoading || isClaimsLoading) return false;
    if (!user) return false;
    if (!isSuperAdmin) return false;
    return true;
  }, [isUserLoading, isClaimsLoading, user, isSuperAdmin]);

  const handleCreate = () => {
    if (!user) return;

    if (!nome.trim()) {
      toast({ title: "Informe o nome do condomínio." });
      return;
    }

    setSaving(true);

    const payload = {
      nome: nome.trim(),
      cnpj: cnpj.trim() || undefined,
      cep: cep.trim() || undefined,
    };

    criarCondominio(firestore, user.uid, payload)
      .then(() => {
        toast({ title: "Condomínio criado com sucesso!" });
        setNome("");
        setCnpj("");
        setCep("");
        setOpen(false);
      })
      .catch((e: any) => {
        // O erro de permissão já é tratado pelo emitter,
        // mas podemos exibir um erro genérico para outras falhas.
        console.error(e);
        toast({
          variant: "destructive",
          title: "Erro ao criar condomínio",
          description: e?.message || "Tente novamente.",
        });
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const handleDelete = (condominioId: string) => {
    deletarCondominio(firestore, condominioId)
      .then(() => {
        toast({ title: "Condomínio excluído." });
      })
      .catch((e: any) => {
        console.error(e);
        toast({
          variant: "destructive",
          title: "Erro ao excluir",
          description: e?.message || "Tente novamente.",
        });
      });
  };

  if (!canRender) return null;

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
                    Insira as informações do novo condomínio. A estrutura inicial (bloco, unidade, síndico) será criada automaticamente.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="nome-condo" className="text-right">
                      Nome
                    </Label>
                    <Input
                      id="nome-condo"
                      placeholder="Nome do Condomínio"
                      className="col-span-3"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="cnpj-condo" className="text-right">
                      CNPJ
                    </Label>
                    <Input
                      id="cnpj-condo"
                      placeholder="00.000.000/0001-00"
                      className="col-span-3"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
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
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" onClick={handleCreate} disabled={saving}>
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
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
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : condominios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4">
                    Nenhum condomínio cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                condominios.map((condo) => (
                  <TableRow key={condo.id}>
                    <TableCell className="font-medium">{condo.nome}</TableCell>
                    <TableCell>{condo.cnpj ?? "-"}</TableCell>
                    <TableCell>{condo.ativo ? "Sim" : "Não"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="icon" disabled>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Você tem certeza?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Essa ação não pode ser desfeita. Isso excluirá
                              permanentemente o condomínio e removerá seus dados
                              de nossos servidores.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(condo.id)}
                            >
                              Continuar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
