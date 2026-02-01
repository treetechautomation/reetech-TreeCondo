"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

type Rotina = {
  id: string;
  titulo: string;
  descricao?: string;
  categoria: string;
  recorrencia: string;
  dataInicio?: any;
  responsavelTipo: string;
  fornecedorNome?: string;
  status: string;
  createdAt?: any;
  updatedAt?: any;
};

function toISODateInput(v: any) {
  const d =
    v?.toDate ? v.toDate() :
    v instanceof Date ? v :
    null;
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateBR(v: any) {
  const d =
    v?.toDate ? v.toDate() :
    v instanceof Date ? v :
    null;
  if (!d) return "-";
  return d.toLocaleDateString("pt-BR");
}

const STATUS_COLORS: Record<string, string> = {
  ATIVA: "bg-green-100 text-green-800",
  ATRASADA: "bg-red-100 text-red-800",
  PAUSADA: "bg-yellow-100 text-yellow-800",
  ENCERRADA: "bg-gray-100 text-gray-800",
};

export default function RotinasManutencaoPage() {
  const { session } = useSessionCtx();
  const firestore = useFirestore();
  const condominioId = session?.activeCondominioId ?? null;

  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [rotinas, setRotinas] = React.useState<Rotina[]>([]);

  // form
  const [titulo, setTitulo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [categoria, setCategoria] = React.useState<string>("");
  const [recorrencia, setRecorrencia] = React.useState<string>("");
  const [dataInicio, setDataInicio] = React.useState<string>("");
  const [responsavelTipo, setResponsavelTipo] = React.useState<string>("");
  const [fornecedorNome, setFornecedorNome] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("ATIVA");

  React.useEffect(() => {
    if (!firestore || !condominioId) {
      setRotinas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = collection(firestore, "condominios", condominioId, "manutencoesPreventivas");
    const qy = query(ref, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const items: Rotina[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setRotinas(items);
        setLoading(false);
      },
      (err) => {
        console.error("Erro ao buscar rotinas:", err);
        setRotinas([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, condominioId]);

  async function handleCreate() {
    if (!firestore || !condominioId) return;

    if (!titulo.trim()) return alert("Informe o título.");
    if (!categoria) return alert("Selecione a categoria.");
    if (!recorrencia) return alert("Selecione a recorrência.");
    if (!dataInicio) return alert("Selecione a data de início.");
    if (!responsavelTipo) return alert("Selecione o responsável.");

    const [y, m, d] = dataInicio.split("-").map(Number);
    const dt = new Date(y || 2000, (m ? m - 1 : 0), d || 1, 12, 0, 0, 0);

    await addDoc(collection(firestore, "condominios", condominioId, "manutencoesPreventivas"), {
      titulo: titulo.trim(),
      descricao: descricao.trim() || "",
      categoria,
      recorrencia,
      dataInicio: Timestamp.fromDate(dt),
      responsavelTipo,
      fornecedorNome: fornecedorNome.trim() || "",
      status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // reset
    setTitulo("");
    setDescricao("");
    setCategoria("");
    setRecorrencia("");
    setDataInicio("");
    setResponsavelTipo("");
    setFornecedorNome("");
    setStatus("ATIVA");
    setOpen(false);
  }

  return (
    <AppLayout
      pageTitle="Rotinas de Manutenção"
      headerActions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Nova Rotina</Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[640px]" aria-describedby="nova-rotina-desc">
            <DialogHeader>
              <DialogTitle>Nova Rotina de Manutenção</DialogTitle>
              <DialogDescription id="nova-rotina-desc">
                Crie uma tarefa de manutenção preventiva recorrente.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="titulo">Título</Label>
                <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Limpeza Semestral da Caixa d'água" />
              </div>

              <div className="space-y-1">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes sobre a tarefa..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEDETIZACAO">Dedetização</SelectItem>
                      <SelectItem value="CAIXA_DAGUA">Caixa d'água</SelectItem>
                      <SelectItem value="ELEVADOR">Elevador</SelectItem>
                      <SelectItem value="EXTINTORES">Extintores</SelectItem>
                      <SelectItem value="OUTROS">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Recorrência</Label>
                  <Select value={recorrencia} onValueChange={setRecorrencia}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEMANAL">Semanal</SelectItem>
                      <SelectItem value="MENSAL">Mensal</SelectItem>
                      <SelectItem value="TRIMESTRAL">Trimestral</SelectItem>
                      <SelectItem value="SEMESTRAL">Semestral</SelectItem>
                      <SelectItem value="ANUAL">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="dataInicio">Data de Início</Label>
                  <Input id="dataInicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </div>

                <div className="space-y-1">
                  <Label>Responsável</Label>
                  <Select value={responsavelTipo} onValueChange={setResponsavelTipo}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SINDICO">Síndico</SelectItem>
                      <SelectItem value="ZELADOR">Zelador</SelectItem>
                      <SelectItem value="TERCEIRO">Terceiro (Fornecedor)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="fornecedorNome">Fornecedor (opcional)</Label>
                  <Input id="fornecedorNome" value={fornecedorNome} onChange={(e) => setFornecedorNome(e.target.value)} placeholder="Ex: Pest Control" />
                </div>

                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ATIVA">ATIVA</SelectItem>
                      <SelectItem value="PAUSADA">PAUSADA</SelectItem>
                      <SelectItem value="ENCERRADA">ENCERRADA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" onClick={handleCreate}>Salvar Rotina</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
        <CardHeader>
          <CardTitle>Rotinas</CardTitle>
          <CardDescription>Gerencie as rotinas de manutenção preventiva do condomínio.</CardDescription>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando rotinas...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rotinas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Nenhuma rotina cadastrada.
                    </TableCell>
                  </TableRow>
                ) : rotinas.map((rotina) => (
                  <TableRow key={rotina.id}>
                    <TableCell className="font-medium">{rotina.titulo}</TableCell>
                    <TableCell><Badge variant="secondary">{rotina.categoria}</Badge></TableCell>
                    <TableCell>{formatDateBR(rotina.dataInicio)}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[rotina.status] || "bg-gray-100 text-gray-800"}>
                        {rotina.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{rotina.fornecedorNome || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/manutencao-preventiva/rotinas/${rotina.id}`}>Ver</Link>
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
