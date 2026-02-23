"use client";

import * as React from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

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
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { useCondominio } from "@/contexts/CondominioContext";

type Fornecedor = {
  id: string;
  nome: string;
  servico: string;
  telefone?: string;
  email?: string;
};

export default function FornecedoresPage() {
  const firestore = useFirestore();
  const { condominioAtivoId } = useCondominio();
  const { toast } = useToast();

  const [fornecedores, setFornecedores] = React.useState<Fornecedor[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [current, setCurrent] = React.useState<Fornecedor | null>(null);

  const [nome, setNome] = React.useState("");
  const [servico, setServico] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [email, setEmail] = React.useState("");
  
  React.useEffect(() => {
    if (!firestore || !condominioAtivoId) {
      setFornecedores([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = collection(firestore, `condominios/${condominioAtivoId}/manutencaoFornecedores`);
    const q = query(ref, orderBy("nome", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setFornecedores(snap.docs.map(d => ({ id: d.id, ...d.data() } as Fornecedor)));
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast({ variant: "destructive", title: "Erro ao carregar fornecedores." });
      setLoading(false);
    });
    return unsub;
  }, [firestore, condominioAtivoId, toast]);

  const openDialog = (item: Fornecedor | null) => {
    setCurrent(item);
    setNome(item?.nome ?? "");
    setServico(item?.servico ?? "");
    setTelefone(item?.telefone ?? "");
    setEmail(item?.email ?? "");
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
      const collectionRef = collection(firestore, `condominios/${condominioAtivoId}/manutencaoFornecedores`);
      if (current) {
        const docRef = doc(collectionRef, current.id);
        await updateDoc(docRef, { nome, servico, telefone, email, updatedAt: serverTimestamp() });
        toast({ title: "Fornecedor atualizado!" });
      } else {
        await addDoc(collectionRef, { nome, servico, telefone, email, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
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
      await deleteDoc(doc(firestore, `condominios/${condominioAtivoId}/manutencaoFornecedores`, id));
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
      pageTitle="Fornecedores de Manutenção"
      headerActions={
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={() => openDialog(null)}>Novo Fornecedor</Button>
      }
    >
      <Card className="border-white/20 bg-white/20 backdrop-blur-2xl shadow-[0_18px_55px_rgba(2,6,23,0.14)] text-white">
        <CardHeader>
          <CardTitle className="text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.30)]">Gestão de Fornecedores</CardTitle>
          <CardDescription className="text-white/70">
            Cadastre e gerencie os fornecedores para as rotinas de manutenção.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!condominioAtivoId ? (
            <p className="text-white/75">Selecione um condomínio para ver os fornecedores.</p>
          ) : loading ? (
            <p className="text-white/75">Carregando...</p>
          ) : (
            <Table className="text-white">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-white/70">Nome</TableHead>
                  <TableHead className="text-white/70">Serviço</TableHead>
                  <TableHead className="text-white/70">Telefone</TableHead>
                  <TableHead className="text-white/70">Email</TableHead>
                  <TableHead className="text-right text-white/70">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-white/75">
                      Nenhum fornecedor cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  fornecedores.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.nome}</TableCell>
                      <TableCell>{item.servico}</TableCell>
                      <TableCell>{item.telefone || "-"}</TableCell>
                      <TableCell>{item.email || "-"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline" className="border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25 text-white"
                          size="sm"
                          onClick={() => openDialog(item)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="destructive" size="sm" className="bg-red-600 hover:bg-red-700 text-white shadow-sm"
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
        <DialogContent className="tc-dialog-center">
          <DialogHeader>
            <DialogTitle>
              {current ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do fornecedor de manutenção.
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
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
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
