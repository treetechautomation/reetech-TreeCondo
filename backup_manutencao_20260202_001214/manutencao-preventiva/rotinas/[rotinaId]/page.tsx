"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { File } from "lucide-react";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

type Rotina = {
  id: string;
  titulo: string;
  descricao?: string;
  categoria: string;
  recorrenciaTipo: string;
  status: string;
  responsavel: string;
  fornecedorNome?: string;
  dataInicio?: any;
};

type Execucao = {
  id: string;
  rotinaId: string;
  status: string;
  dataProgramada?: any;
  dataConcluida?: any;
  responsavelNome?: string;
  fornecedorNome?: string;
  titulo?: string;
  categoria?: string;
};

function formatDateBR(v: any) {
  if (!v?.toDate) return "-";
  return v.toDate().toLocaleDateString("pt-BR");
}

function calculateNextExecution(startDate: Date, recurrence: string): Date {
  const nextDate = new Date(startDate);
  switch (recurrence) {
    case "SEMANAL": nextDate.setDate(nextDate.getDate() + 7); break;
    case "MENSAL": nextDate.setMonth(nextDate.getMonth() + 1); break;
    case "TRIMESTRAL": nextDate.setMonth(nextDate.getMonth() + 3); break;
    case "SEMESTRAL": nextDate.setMonth(nextDate.getMonth() + 6); break;
    case "ANUAL": nextDate.setFullYear(nextDate.getFullYear() + 1); break;
  }
  return nextDate;
}

export default function RotinaDetalhePage() {
  const params = useParams<{ rotinaId: string }>();
  const rotinaId = params?.rotinaId;
  const { session } = useSessionCtx();
  const firestore = useFirestore();
  const { toast } = useToast();
  const condominioId = session?.activeCondominioId ?? null;

  const [rotina, setRotina] = React.useState<Rotina | null>(null);
  const [loadingRotina, setLoadingRotina] = React.useState(true);
  const [execucoes, setExecucoes] = React.useState<Execucao[]>([]);
  const [loadingExec, setLoadingExec] = React.useState(true);

  React.useEffect(() => {
    if (!firestore || !condominioId || !rotinaId) return;
    const unsub = onSnapshot(doc(firestore, `condominios/${condominioId}/manutencaoRotinas`, rotinaId), (snap) => {
      setRotina(snap.exists() ? { id: snap.id, ...snap.data() } as Rotina : null);
      setLoadingRotina(false);
    });
    return unsub;
  }, [firestore, condominioId, rotinaId]);

  React.useEffect(() => {
    if (!firestore || !condominioId || !rotinaId) return;
    const q = query(
      collection(firestore, `condominios/${condominioId}/manutencaoExecucoes`),
      where("rotinaId", "==", rotinaId),
      orderBy("dataProgramada", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setExecucoes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Execucao)));
      setLoadingExec(false);
    });
    return unsub;
  }, [firestore, condominioId, rotinaId]);

  const handleConcluir = async (execucao: Execucao) => {
    if (!firestore || !condominioId || !rotina) return;
    try {
      // 1. Marca execução como concluída
      const execRef = doc(firestore, `condominios/${condominioId}/manutencaoExecucoes`, execucao.id);
      await updateDoc(execRef, { status: "CONCLUIDA", dataConcluida: serverTimestamp() });

      // 2. Calcula e cria a próxima execução
      const dataBase = execucao.dataProgramada?.toDate() ?? new Date();
      const proximaData = calculateNextExecution(dataBase, rotina.recorrenciaTipo);
      
      const proximaExecPayload = {
        rotinaId: rotina.id,
        titulo: rotina.titulo,
        categoria: rotina.categoria,
        fornecedorNome: rotina.fornecedorNome,
        status: "PROGRAMADA",
        dataProgramada: Timestamp.fromDate(proximaData),
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(firestore, `condominios/${condominioId}/manutencaoExecucoes`), proximaExecPayload);
      
      // 3. Atualiza a próxima data na rotina principal
      const rotinaRef = doc(firestore, `condominios/${condominioId}/manutencaoRotinas`, rotina.id);
      await updateDoc(rotinaRef, { proximaExecucaoEm: Timestamp.fromDate(proximaData), updatedAt: serverTimestamp() });

      toast({ title: "Execução concluída e próxima agendada!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao concluir execução", description: e.message });
    }
  };

  return (
    <AppLayout pageTitle="Detalhe da Rotina">
      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="execucoes">Execuções</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="fornecedor">Fornecedor</TabsTrigger>
        </TabsList>
        <TabsContent value="resumo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{loadingRotina ? "Carregando..." : (rotina?.titulo || "Rotina não encontrada")}</CardTitle>
              <CardDescription>Rotina ID: {rotinaId}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!rotina ? <p>Nenhuma rotina encontrada.</p> : (
                <>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div><span className="font-semibold">Categoria:</span> <Badge variant="secondary">{rotina.categoria}</Badge></div>
                    <div><span className="font-semibold">Status:</span> <Badge>{rotina.status}</Badge></div>
                    <div><span className="font-semibold">Recorrência:</span> {rotina.recorrenciaTipo}</div>
                    <div><span className="font-semibold">Início:</span> {formatDateBR(rotina.dataInicio)}</div>
                    <div><span className="font-semibold">Responsável:</span> {rotina.responsavel}</div>
                    <div><span className="font-semibold">Fornecedor:</span> {rotina.fornecedorNome || "-"}</div>
                  </div>
                  {rotina.descricao && <div><h4 className="font-semibold">Descrição</h4><p>{rotina.descricao}</p></div>}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="execucoes">
          <Card>
            <CardHeader><CardTitle>Histórico de Execuções</CardTitle></CardHeader>
            <CardContent>
              {loadingExec ? <p>Carregando...</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Data Programada</TableHead><TableHead>Data Conclusão</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {execucoes.length === 0 ? <TableRow><TableCell colSpan={4}>Nenhuma execução.</TableCell></TableRow> : execucoes.map((ex) => (
                      <TableRow key={ex.id}>
                        <TableCell>{formatDateBR(ex.dataProgramada)}</TableCell>
                        <TableCell>{formatDateBR(ex.dataConcluida)}</TableCell>
                        <TableCell><Badge variant={ex.status === "CONCLUIDA" ? "default" : "secondary"}>{ex.status}</Badge></TableCell>
                        <TableCell>
                          {ex.status !== "CONCLUIDA" && <Button size="sm" onClick={() => handleConcluir(ex)}>Marcar como concluída</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="documentos">
          <Card>
            <CardHeader><CardTitle>Documentos</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground"><File className="inline-block mr-2" /> (Em breve)</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="fornecedor">
          <Card>
            <CardHeader><CardTitle>Fornecedor Associado</CardTitle></CardHeader>
            <CardContent>{rotina?.fornecedorNome || "Nenhum fornecedor associado."}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
