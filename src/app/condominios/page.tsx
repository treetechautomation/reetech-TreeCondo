"use client";

import {
  PlusCircle,
  Edit,
  Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
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
import { Input } from "@/components/ui/input";

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

  const HeaderActions = () => (
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
  );

  if (!canRender) return <AppLayout pageTitle="Condomínios">Acesso negado.</AppLayout>;

  return (
    <AppLayout pageTitle="Gestão de Condomínios" headerActions={<HeaderActions />}>
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
    </AppLayout>
  );
}
