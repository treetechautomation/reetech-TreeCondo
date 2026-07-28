"use client";

import React, { useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, XCircle, AlertTriangle } from "lucide-react";
import { useCondominio } from "@/contexts/CondominioContext";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

type Procuracao = {
  id: string;
  outorganteUid: string;
  outorganteNome: string;
  outorganteUnidade?: string;
  outorgadoNome: string;
  outorgadoUnidade: string;
  status: string;
  expiresAt: any;
  createdAt: any;
};

export default function AdminProcuracoesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { condominioAtivoId } = useCondominio();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const procRef = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId) return null;
    return query(
      collection(firestore, `condominios/${condominioAtivoId}/procuracoes`),
      orderBy("createdAt", "desc")
    );
  }, [firestore, condominioAtivoId]);

  const { data: procRaw, isLoading } = useCollection<Procuracao>(procRef);
  const procuracoes = useMemo(() => (procRaw || []) as Procuracao[], [procRaw]);

  const filteredProcuracoes = useMemo(() => {
    const today = new Date();
    return procuracoes.filter((p) => {
      const isExpired = p.expiresAt ? (p.expiresAt.toDate ? p.expiresAt.toDate() : new Date(p.expiresAt)) < today : false;
      const statusLabel = p.status === "ATIVA" && !isExpired ? "ATIVA" : isExpired ? "EXPIRADA" : "REVOGADA";

      const matchSearch =
        p.outorganteNome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.outorgadoNome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.outorganteUnidade && p.outorganteUnidade.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.outorgadoUnidade.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = filterStatus === "all" || statusLabel === filterStatus;

      return matchSearch && matchStatus;
    });
  }, [procuracoes, searchQuery, filterStatus]);

  const handleRevogar = async (id: string) => {
    if (!firestore || !condominioAtivoId) return;
    if (!confirm("Confirmar a revogação administrativa desta procuração?")) return;

    setRevokingId(id);
    try {
      await updateDoc(doc(firestore, `condominios/${condominioAtivoId}/procuracoes`, id), {
        status: "REVOGADA",
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Sucesso", description: "Procuração revogada administrativamente." });
    } catch (err: any) {
      console.error("Erro ao revogar:", err);
      toast({ variant: "destructive", title: "Erro", description: err.message || "Não foi possível revogar a procuração." });
    } finally {
      setRevokingId(null);
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString("pt-BR");
  };

  if (!condominioAtivoId) {
    return (
      <AppLayout pageTitle="Gestão de Procurações">
        <Card className="tc-card-signature">
          <CardHeader>
            <CardTitle>Nenhum condomínio ativo</CardTitle>
            <CardDescription>Selecione um condomínio para gerenciar procurações.</CardDescription>
          </CardHeader>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Gestão de Procurações">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="text-[#00D0E6] h-6 w-6" /> Procurações Digitais Ativas
          </h2>
          <p className="text-sm text-white/50">
            Monitore e audite todas as delegações de poder de voto outorgadas por moradores para assembleias.
          </p>
        </div>

        {/* CONTROLES */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por outorgante, outorgado, bloco ou apartamento..."
              className="pl-9 bg-slate-900/50 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 px-3 rounded-xl bg-slate-900/50 border border-white/10 text-white text-sm outline-none focus:border-[#00D0E6]"
            >
              <option value="all">Todos os status</option>
              <option value="ATIVA">Ativas</option>
              <option value="EXPIRADA">Expiradas</option>
              <option value="REVOGADA">Revogadas</option>
            </select>
          </div>
        </div>

        {/* TABELA DE PROCURAÇÕES */}
        <Card className="bg-slate-900/40 border-white/10 text-white rounded-3xl overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <p className="py-12 text-center text-white/50">Carregando procurações...</p>
            ) : filteredProcuracoes.length === 0 ? (
              <p className="py-12 text-center text-white/50">Nenhuma procuração cadastrada.</p>
            ) : (
              <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/50">Outorgante (Quem delegou)</TableHead>
                      <TableHead className="text-white/50">Outorgado (Quem representa)</TableHead>
                      <TableHead className="text-white/50">Unidade Destino</TableHead>
                      <TableHead className="text-white/50">Data Outorga</TableHead>
                      <TableHead className="text-white/50">Válido Até</TableHead>
                      <TableHead className="text-white/50">Status</TableHead>
                      <TableHead className="text-white/50 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProcuracoes.map((p) => {
                      const today = new Date();
                      const isExpired = p.expiresAt ? (p.expiresAt.toDate ? p.expiresAt.toDate() : new Date(p.expiresAt)) < today : false;
                      const isActive = p.status === "ATIVA" && !isExpired;

                      return (
                        <TableRow key={p.id} className="border-white/5 hover:bg-white/5">
                          <TableCell className="font-bold text-white">
                            {p.outorganteNome}
                            <div className="text-xs text-white/40 font-normal">
                              {p.outorganteUnidade || "Unidade não informada"}
                            </div>
                          </TableCell>
                          <TableCell className="font-bold text-[#00D0E6]">
                            {p.outorgadoNome}
                          </TableCell>
                          <TableCell className="text-sm">
                            {p.outorgadoUnidade}
                          </TableCell>
                          <TableCell className="text-xs text-white/60">
                            {formatDate(p.createdAt)}
                          </TableCell>
                          <TableCell className="text-xs text-white/60">
                            {formatDate(p.expiresAt)}
                          </TableCell>
                          <TableCell>
                            {isActive ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30">
                                Ativa
                              </Badge>
                            ) : isExpired ? (
                              <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30">
                                Expirada
                              </Badge>
                            ) : (
                              <Badge className="bg-white/10 text-white/50 hover:bg-white/10 border border-white/20">
                                Revogada
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isActive && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-xl flex items-center gap-1.5 ml-auto"
                                disabled={revokingId === p.id}
                                onClick={() => handleRevogar(p.id)}
                              >
                                <XCircle className="h-4 w-4" /> Revogar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
