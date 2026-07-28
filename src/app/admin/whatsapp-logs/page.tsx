"use client";

import React, { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, MessageSquare, Send, Calendar } from "lucide-react";
import { useCondominio } from "@/contexts/CondominioContext";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";

type WhatsappLog = {
  id: string;
  toPhone: string;
  toName: string;
  message: string;
  type: string;
  status: string;
  sentAt: any;
  metadata?: {
    encomendaId?: string;
    unidadeId?: string;
    codigo?: string;
    fotoUrl?: string | null;
  };
};

export default function WhatsappLogsPage() {
  const firestore = useFirestore();
  const { condominioAtivoId } = useCondominio();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  const logsRef = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId) return null;
    return query(
      collection(firestore, `condominios/${condominioAtivoId}/whatsappLogs`),
      orderBy("sentAt", "desc")
    );
  }, [firestore, condominioAtivoId]);

  const { data: logsRaw, isLoading } = useCollection<WhatsappLog>(logsRef);
  const logs = useMemo(() => (logsRaw || []) as WhatsappLog[], [logsRaw]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        log.toName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.toPhone.includes(searchQuery) ||
        log.message.toLowerCase().includes(searchQuery.toLowerCase());

      const matchType = filterType === "all" || log.type === filterType;

      return matchSearch && matchType;
    });
  }, [logs, searchQuery, filterType]);

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString("pt-BR");
  };

  if (!condominioAtivoId) {
    return (
      <AppLayout pageTitle="Logs de WhatsApp">
        <Card className="tc-card-signature">
          <CardHeader>
            <CardTitle>Nenhum condomínio ativo</CardTitle>
            <CardDescription>Selecione um condomínio para visualizar os logs.</CardDescription>
          </CardHeader>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Logs de WhatsApp">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Disparos de Notificações (WhatsApp)</h2>
          <p className="text-sm text-white/50">Histórico de mensagens enviadas aos moradores pelo sistema.</p>
        </div>

        {/* CONTROLES */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por destinatário, telefone ou mensagem..."
              className="pl-9 bg-slate-900/50 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-10 px-3 rounded-xl bg-slate-900/50 border border-white/10 text-white text-sm outline-none focus:border-[#00D0E6]"
            >
              <option value="all">Todos os tipos</option>
              <option value="ENCOMENDA_FOTO">Encomendas com Foto</option>
              <option value="VISITA_PORTARIA">Portaria & Visitantes</option>
              <option value="FILA_ESPERA">Fila de Espera</option>
            </select>
          </div>
        </div>

        {/* TABELA DE LOGS */}
        <Card className="bg-slate-900/40 border-white/10 text-white rounded-3xl overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <p className="py-12 text-center text-white/50">Carregando logs...</p>
            ) : filteredLogs.length === 0 ? (
              <p className="py-12 text-center text-white/50">Nenhum disparo registrado.</p>
            ) : (
              <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/50 w-[20%]">Destinatário</TableHead>
                      <TableHead className="text-white/50 w-[15%]">Tipo</TableHead>
                      <TableHead className="text-white/50 w-[45%]">Mensagem</TableHead>
                      <TableHead className="text-white/50 w-[10%]">Status</TableHead>
                      <TableHead className="text-white/50 w-[10%]">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="font-bold text-[#00D0E6]">
                          {log.toName}
                          <div className="text-xs text-white/40 font-normal">{log.toPhone}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-white/20 text-white/80">
                            {log.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-xs break-words whitespace-normal text-white/90">
                          {log.message}
                          {log.metadata?.fotoUrl && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-[11px] text-white/40">Anexo fotográfico:</span>
                              <a
                                href={log.metadata.fotoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#D3EA00] hover:underline"
                              >
                                Ver Imagem 🖼️
                              </a>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                            <Send className="h-3 w-3" /> Enviada
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-white/60 whitespace-nowrap">
                          {formatDate(log.sentAt)}
                        </TableCell>
                      </TableRow>
                    ))}
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
