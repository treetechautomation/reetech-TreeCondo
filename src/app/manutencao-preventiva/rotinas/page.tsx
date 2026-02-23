"use client";

import * as React from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

type Rotina = {
  id: string;
  titulo: string;
  categoria: string;
  dataInicio?: any;
  status: string;
  fornecedorNome?: string;
};

function formatDateBR(v: any) {
  if (!v?.toDate) return "-";
  return v.toDate().toLocaleDateString("pt-BR");
}

export default function RotinasManutencaoPage() {
  const { session } = useSessionCtx();
  const firestore = useFirestore();
  const { toast } = useToast();
  const condominioId = session?.activeCondominioId ?? null;
  const uid = session?.user?.uid;

  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [rotinas, setRotinas] = React.useState<Rotina[]>([]);

  // form state
  const [titulo, setTitulo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [categoria, setCategoria] = React.useState("");
  const [recorrencia, setRecorrencia] = React.useState("");
  const [dataInicio, setDataInicio] = React.useState("");
  const [responsavelTipo, setResponsavelTipo] = React.useState("");
  const [fornecedorNome, setFornecedorNome] = React.useState("");
  const [status, setStatus] = React.useState("ATIVA");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!firestore || !condominioId) {
      setRotinas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = collection(firestore, `condominios/${condominioId}/manutencaoRotinas`);
    const qy = query(ref, orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        setRotinas(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        );
        setLoading(false);
      },
      (err) => {
        console.error("Erro ao buscar rotinas:", err);
        toast({ variant: "destructive", title: "Erro ao carregar rotinas." });
        setLoading(false);
      }
    );
    return unsub;
  }, [firestore, condominioId, toast]);

  const handleCreate = async () => {
    if (!firestore || !condominioId || !uid) return;
    if (!titulo || !categoria || !recorrencia || !dataInicio || !responsavelTipo) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios." });
      return;
    }
    setSaving(true);
    try {
      const [y, m, d] = dataInicio.split("-").map(Number);
      const dtInicio = Timestamp.fromDate(new Date(y, m - 1, d));
      
      const rotinaPayload = {
        titulo, descricao, categoria, recorrenciaTipo: recorrencia, dataInicio: dtInicio,
        responsavel: responsavelTipo, fornecedorNome, status,
        alertasDiasAntes: [30, 15, 7],
        proximaExecucaoEm: dtInicio, // Primeira execução é na data de início
        createdByUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const rotinaRef = await addDoc(collection(firestore, `condominios/${condominioId}/manutencaoRotinas`), rotinaPayload);
      
      // Cria a primeira execução
      await addDoc(collection(firestore, `condominios/${condominioId}/manutencaoExecucoes`), {
        rotinaId: rotinaRef.id,
        titulo,
        categoria,
        fornecedorNome,
        status: "PROGRAMADA",
        dataProgramada: dtInicio,
        createdAt: serverTimestamp(),
      });
      
      toast({ title: "Rotina criada com sucesso!" });
      setOpen(false);
      // Reset form
      setTitulo(""); setDescricao(""); setCategoria(""); setRecorrencia(""); setDataInicio(""); setResponsavelTipo(""); setFornecedorNome(""); setStatus("ATIVA");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao criar rotina", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout
      pageTitle="Rotinas de Manutenção"
      headerActions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">Nova Rotina</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[640px] tc-dialog-center" aria-describedby="nova-rotina-desc">
            <DialogHeader>
              <DialogTitle>Nova Rotina de Manutenção</DialogTitle>
              <DialogDescription id="nova-rotina-desc">Crie uma tarefa de manutenção preventiva recorrente.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (Ex: Limpeza Semestral da Caixa d'água)" />
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição (opcional)" />
              <div className="grid grid-cols-2 gap-4">
                <Select value={categoria} onValueChange={setCategoria}><SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="DEDETIZACAO">Dedetização</SelectItem><SelectItem value="CAIXA_DAGUA">Caixa d'água</SelectItem><SelectItem value="ELEVADOR">Elevador</SelectItem><SelectItem value="EXTINTORES">Extintores</SelectItem><SelectItem value="OUTROS">Outros</SelectItem></SelectContent></Select>
                <Select value={recorrencia} onValueChange={setRecorrencia}><SelectTrigger><SelectValue placeholder="Recorrência" /></SelectTrigger><SelectContent><SelectItem value="SEMANAL">Semanal</SelectItem><SelectItem value="MENSAL">Mensal</SelectItem><SelectItem value="TRIMESTRAL">Trimestral</SelectItem><SelectItem value="SEMESTRAL">Semestral</SelectItem><SelectItem value="ANUAL">Anual</SelectItem></SelectContent></Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Data de Início</Label><Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
                <Select value={responsavelTipo} onValueChange={setResponsavelTipo}><SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger><SelectContent><SelectItem value="SINDICO">Síndico</SelectItem><SelectItem value="ZELADOR">Zelador</SelectItem><SelectItem value="TERCEIRO">Terceiro (Fornecedor)</SelectItem></SelectContent></Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input value={fornecedorNome} onChange={(e) => setFornecedorNome(e.target.value)} placeholder="Fornecedor (opcional)" />
                <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ATIVA">ATIVA</SelectItem><SelectItem value="PAUSADA">PAUSADA</SelectItem><SelectItem value="ENCERRADA">ENCERRADA</SelectItem></SelectContent></Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleCreate} disabled={saving}>{saving ? "Salvando..." : "Salvar Rotina"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Card className="border-white/20 bg-white/28 backdrop-blur-xl shadow-[0_18px_55px_rgba(2,6,23,0.12)]">
        <CardHeader>
          <CardTitle className="text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]">Rotinas</CardTitle>
          <CardDescription className="text-white/70">Gerencie as rotinas de manutenção preventiva do condomínio.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p>Carregando...</p> : (
            <Table className="text-white">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-white/75">Título</TableHead>
                  <TableHead className="text-white/75">Categoria</TableHead>
                  <TableHead className="text-white/75">Início</TableHead>
                  <TableHead className="text-white/75">Status</TableHead>
                  <TableHead className="text-white/75">Fornecedor</TableHead>
                  <TableHead className="text-right text-white/75">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rotinas.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-white/80">Nenhuma rotina cadastrada.</TableCell></TableRow>
                ) : rotinas.map((rotina) => (
                  <TableRow key={rotina.id} className="hover:bg-white/5 transition-colors">
                    <TableCell className="text-white font-semibold">{rotina.titulo}</TableCell>
                    <TableCell><Badge className="bg-sky-600 text-white border border-sky-500 shadow-sm">{rotina.categoria}</Badge></TableCell>
                    <TableCell className="text-white/85">{formatDateBR(rotina.dataInicio)}</TableCell>
                    <TableCell><Badge className="bg-emerald-600 text-white border border-emerald-500 shadow-sm">{rotina.status}</Badge></TableCell>
                    <TableCell className="text-white/85">{rotina.fornecedorNome || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all" asChild>
                        <Link className="font-semibold text-white" href={`/manutencao-preventiva/rotinas/${rotina.id}`}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
