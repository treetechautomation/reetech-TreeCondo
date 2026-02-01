"use client";

import * as React from "react";
import {
  useFornecedores,
  criarFornecedor,
  atualizarFornecedor,
  deletarFornecedor,
  type Fornecedor,
  type NewFornecedorPayload,
  type UpdateFornecedorPayload,
} from "@/firebase/firestore/fornecedores.service";
import { useFirestore } from "@/firebase";
import { useCondominio } from "@/contexts/CondominioContext";
import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function FornecedoresPage() {
  const firestore = useFirestore();
  const { condominioAtivoId } = useCondominio();
  const { toast } = useToast();

  const {
    data: fornecedores,
    loading,
    error,
  } = useFornecedores(condominioAtivoId);

  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [current, setCurrent] = React.useState<Fornecedor | null>(null);

  const [nome, setNome] = React.useState("");
  const [servico, setServico] = React.useState("");
  const [contato, setContato] = React.useState("");
  const [ativo, setAtivo] = React.useState(true);

  const openDialog = (item: Fornecedor | null) => {
    setCurrent(item);
    setNome(item?.nome ?? "");
    setServico(item?.servico ?? "");
    setContato(item?.contato ?? "");
    setAtivo(item ? item.ativo : true);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !condominioAtivoId) return;
    if (!nome.trim() || !servico.trim()) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Nome e serviço são obrigatórios.",
      });
      return;
    }
    setSaving(true);
    try {
      if (current) {
        const payload: UpdateFornecedorPayload = { nome, servico, contato, ativo };
        await atualizarFornecedor(firestore, condominioAtivoId, current.id, payload);
        toast({ title: "Fornecedor atualizado!" });
      } else {
        const payload: NewFornecedorPayload = { nome, servico, contato, ativo };
        await criarFornecedor(firestore, condominioAtivoId, payload);
        toast({ title: "Fornecedor criado com sucesso!" });
      }
      setOpen(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: e.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore || !condominioAtivoId) return;
    if (!confirm("Tem certeza que deseja excluir este fornecedor?")) return;
    try {
      await deletarFornecedor(firestore, condominioAtivoId, id);
      toast({ title: "Fornecedor excluído." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: e.message,
      });
    }
  };

  return (
    <AppLayout
      pageTitle="Fornecedores"
      headerActions={
        <Button onClick={() => openDialog(null)}>Novo Fornecedor</Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Gestão de Fornecedores</CardTitle>
          <CardDescription>
            Cadastre e gerencie os fornecedores de serviço do condomínio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!condominioAtivoId ? (
            <p>Selecione um condomínio para ver os fornecedores.</p>
          ) : loading ? (
            <p>Carregando...</p>
          ) : error ? (
            <p className="text-destructive">Erro: {error.message}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Nenhum fornecedor cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  fornecedores.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.nome}</TableCell>
                      <TableCell>{item.servico}</TableCell>
                      <TableCell>{item.contato || "-"}</TableCell>
                      <TableCell>{item.ativo ? "Ativo" : "Inativo"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDialog(item)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                        >
                          Excluir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {current ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do fornecedor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="servico">Serviço Prestado</Label>
              <Input
                id="servico"
                value={servico}
                onChange={(e) => setServico(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contato">Contato (Telefone/Email)</Label>
              <Input
                id="contato"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
              <Label htmlFor="ativo">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
