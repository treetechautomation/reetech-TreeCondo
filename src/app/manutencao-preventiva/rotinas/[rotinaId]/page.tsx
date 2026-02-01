"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { File } from "lucide-react";

import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
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
  where,
} from "firebase/firestore";

function formatDateBR(v: any) {
  const d =
    v?.toDate ? v.toDate() :
    v instanceof Date ? v :
    null;
  if (!d) return "-";
  return d.toLocaleDateString("pt-BR");
}

type Rotina = {
  titulo: string;
  descricao?: string;
  categoria: string;
  recorrencia: string;
  status: string;
  responsavelTipo: string;
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

export default function RotinaDetalhePage() {
  const params = useParams<{ rotinaId: string }>();
  const rotinaId = params?.rotinaId;

  const { session } = useSessionCtx();
  const firestore = useFirestore();
  const condominioId = session?.activeCondominioId ?? null;

  const [rotina, setRotina] = React.useState<Rotina | null>(null);
  const [loadingRotina, setLoadingRotina] = React.useState(true);

  const [execucoes, setExecucoes] = React.useState<Execucao[]>([]);
  const [loadingExec, setLoadingExec] = React.useState(true);

  // carrega rotina
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!firestore || !condominioId || !rotinaId) {
        setRotina(null);
        setLoadingRotina(false);
        return;
      }
      setLoadingRotina(true);
      try {
        const ref = doc(firestore, "condominios", condominioId, "manutencaoRotinas", String(rotinaId));
        const snap = await getDoc(ref);
        if (!cancelled) setRotina(snap.exists() ? (snap.data() as any) : null);
      } catch (e) {
        console.error("Erro ao carregar rotina:", e);
        if (!cancelled) setRotina(null);
      } finally {
        if (!cancelled) setLoadingRotina(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [firestore, condominioId, rotinaId]);

  // lista execuções
  React.useEffect(() => {
    if (!firestore || !condominioId || !rotinaId) {
      setExecucoes([]);
      setLoadingExec(false);
      return;
    }

    setLoadingExec(true);
    const ref = collection(firestore, "condominios", condominioId, "manutencaoExecucoes");
    const qy = query(
      ref,
      where("rotinaId", "==", String(rotinaId)),
      orderBy("dataProgramada", "desc")
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const items: Execucao[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setExecucoes(items);
        setLoadingExec(false);
      },
      (err) => {
        console.error("Erro ao buscar execuções:", err);
        setExecucoes([]);
        setLoadingExec(false);
      }
    );

    return () => unsub();
  }, [firestore, condominioId, rotinaId]);

  // ação rápida: criar execução (para testar calendário)
  async function criarExecucaoTeste() {
    if (!firestore || !condominioId || !rotinaId || !rotina) return;

    const dt = new Date();
    dt.setHours(12, 0, 0, 0);

    await addDoc(collection(firestore, "condominios", condominioId, "manutencaoExecucoes"), {
      rotinaId: String(rotinaId),
      titulo: rotina.titulo,
      categoria: rotina.categoria,
      fornecedorNome: rotina.fornecedorNome || "",
      status: "AGENDADA",
      dataProgramada: Timestamp.fromDate(dt),
      createdAt: serverTimestamp(),
    });
  }

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
              <CardDescription>Rotina ID: {String(rotinaId)}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {!rotina ? (
                <div className="text-sm text-muted-foreground">Nenhuma rotina encontrada.</div>
              ) : (
                <>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div><span className="font-semibold text-muted-foreground">Categoria:</span> <Badge variant="secondary">{rotina.categoria}</Badge></div>
                    <div><span className="font-semibold text-muted-foreground">Status:</span> <Badge variant="outline">{rotina.status}</Badge></div>
                    <div><span className="font-semibold text-muted-foreground">Recorrência:</span> {rotina.recorrencia}</div>
                    <div><span className="font-semibold text-muted-foreground">Início:</span> {formatDateBR(rotina.dataInicio)}</div>
                    <div><span className="font-semibold text-muted-foreground">Responsável:</span> {rotina.responsavelTipo}</div>
                    <div><span className="font-semibold text-muted-foreground">Fornecedor:</span> {rotina.fornecedorNome || "-"}</div>
                  </div>

                  {rotina.descricao ? (
                    <div>
                      <h4 className="font-semibold text-muted-foreground">Descrição</h4>
                      <p>{rotina.descricao}</p>
                    </div>
                  ) : null}

                  <div>
                    <Button variant="secondary" onClick={criarExecucaoTeste}>
                      Criar execução de teste (hoje)
                    </Button>
                    <div className="mt-2 text-xs text-muted-foreground">
                      (Use isso só pra validar calendário; depois removemos ou trocamos por “Agendar execução”.)
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="execucoes">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Execuções</CardTitle>
              <CardDescription>Acompanhe as manutenções realizadas.</CardDescription>
            </CardHeader>

            <CardContent>
              {loadingExec ? (
                <div className="text-sm text-muted-foreground">Carregando execuções...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data Programada</TableHead>
                      <TableHead>Data Conclusão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {execucoes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-sm text-muted-foreground">
                          Nenhuma execução registrada.
                        </TableCell>
                      </TableRow>
                    ) : execucoes.map((ex) => (
                      <TableRow key={ex.id}>
                        <TableCell>{formatDateBR(ex.dataProgramada)}</TableCell>
                        <TableCell>{formatDateBR(ex.dataConcluida)}</TableCell>
                        <TableCell>
                          <Badge variant={ex.status === "CONCLUIDA" ? "default" : "secondary"}>{ex.status}</Badge>
                        </TableCell>
                        <TableCell>{ex.responsavelNome || ex.fornecedorNome || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" disabled>Ver detalhes</Button>
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
            <CardHeader>
              <CardTitle>Documentos e Anexos</CardTitle>
              <CardDescription>Vamos ligar essa aba no Firestore/Storage depois (upload + lista).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <File className="h-5 w-5" />
                Ainda não implementado (sem mocks).
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fornecedor">
          <Card>
            <CardHeader>
              <CardTitle>Fornecedor Associado</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p><span className="font-semibold text-muted-foreground">Nome:</span> {rotina?.fornecedorNome || "-"}</p>
              <p className="text-xs text-muted-foreground mt-2">Depois ligamos isso ao módulo /fornecedores.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
