"use client";

import * as React from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";


const MOCK_ROTINAS = [
    { id: "rot1", titulo: "Dedetização Mensal", categoria: "DEDETIZACAO", proximaExecucaoEm: "15/08/2024", status: "ATIVA", fornecedor: "Pest Control" },
    { id: "rot2", titulo: "Limpeza Caixa D'água", categoria: "CAIXA_DAGUA", proximaExecucaoEm: "01/09/2024", status: "ATIVA", fornecedor: "Hidro Limpa" },
    { id: "rot3", titulo: "Manutenção Elevador", categoria: "ELEVADOR", proximaExecucaoEm: "10/08/2024", status: "ATRASADA", fornecedor: "Atlas" },
    { id: "rot4", titulo: "Recarga de Extintores", categoria: "EXTINTORES", proximaExecucaoEm: "20/12/2024", status: "PAUSADA", fornecedor: "Fogo Zero" },
]

const STATUS_COLORS: Record<string, string> = {
    ATIVA: "bg-green-100 text-green-800",
    ATRASADA: "bg-red-100 text-red-800",
    PAUSADA: "bg-yellow-100 text-yellow-800",
    ENCERRADA: "bg-gray-100 text-gray-800",
}

export default function RotinasManutencaoPage() {
  return (
    <AppLayout pageTitle="Rotinas de Manutenção" headerActions={
         <Dialog>
            <DialogTrigger asChild>
                <Button>Nova Rotina</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Nova Rotina de Manutenção</DialogTitle>
                    <DialogDescription>
                        Crie uma nova tarefa de manutenção preventiva recorrente.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-1">
                        <Label htmlFor="titulo">Título</Label>
                        <Input id="titulo" placeholder="Ex: Limpeza Semestral da Caixa d'água" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="descricao">Descrição</Label>
                        <Textarea id="descricao" placeholder="Detalhes sobre a tarefa, o que inclui, etc." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <Label htmlFor="categoria">Categoria</Label>
                            <Select>
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
                            <Label htmlFor="recorrencia">Recorrência</Label>
                             <Select>
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
                            <Input id="dataInicio" type="date" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="responsavel">Responsável</Label>
                             <Select>
                                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SINDICO">Síndico</SelectItem>
                                    <SelectItem value="ZELADOR">Zelador</SelectItem>
                                    <SelectItem value="TERCEIRO">Terceiro (Fornecedor)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit">Salvar Rotina</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    }>
      <Card>
        <CardHeader>
          <CardTitle>Rotinas</CardTitle>
          <CardDescription>
            Gerencie as rotinas de manutenção preventiva do condomínio.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Próxima Execução</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_ROTINAS.map(rotina => (
                    <TableRow key={rotina.id}>
                        <TableCell className="font-medium">{rotina.titulo}</TableCell>
                        <TableCell><Badge variant="secondary">{rotina.categoria}</Badge></TableCell>
                        <TableCell>{rotina.proximaExecucaoEm}</TableCell>
                        <TableCell><Badge className={STATUS_COLORS[rotina.status]}>{rotina.status}</Badge></TableCell>
                        <TableCell>{rotina.fornecedor}</TableCell>
                        <TableCell className="text-right">
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/manutencao-preventiva/rotinas/${rotina.id}`}>Ver</Link>
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
