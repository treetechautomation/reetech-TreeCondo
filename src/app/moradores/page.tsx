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
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

import { useCondominio } from "@/contexts/CondominioContext";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

type Morador = {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  role?:
    | "MORADOR"
    | "SINDICO"
    | "PORTEIRO"
    | "FUNCIONARIO"
    | "SUB_SINDICO";
  status?: "ATIVO" | "INATIVO";
};

export default function MoradoresPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { session } = useSessionCtx();

  const {
    condominioAtivoId,
    vinculoAtivo,
    blocoAtivoId,
    unidadeAtivaId,
    blocos,
    unidades,
    isLoadingBlocos,
    isLoadingUnidades,
  } = useCondominio();

  const canManage =
    !!session?.isSuperAdmin ||
    vinculoAtivo?.role === "SINDICO" ||
    vinculoAtivo?.role === "ADMIN_CONDOMINIO";

  const blocosMap = useMemo(
    () => new Map(blocos.map((b) => [b.id, b.nome])),
    [blocos]
  );

  const unidadesMap = useMemo(
    () => new Map(unidades.map((u) => [u.id, u.numero])),
    [unidades]
  );

  const moradoresRef = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId || !blocoAtivoId || !unidadeAtivaId)
      return null;
    return query(
      collection(
        firestore,
        `condominios/${condominioAtivoId}/blocos/${blocoAtivoId}/unidades/${unidadeAtivaId}/moradores`
      ),
      orderBy("nome")
    );
  }, [firestore, condominioAtivoId, blocoAtivoId, unidadeAtivaId]);

  const {
    data: moradoresRaw,
    isLoading: isLoadingMoradores,
    error: moradoresError,
  } = useCollection<Morador>(moradoresRef);

  const moradores: Morador[] = useMemo(
    () => ((moradoresRaw as any) || []) as Morador[],
    [moradoresRaw]
  );

  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [role, setRole] = useState<Morador["role"]>("MORADOR");
  const [saving, setSaving] = useState(false);

  const blocoNome = blocoAtivoId
    ? blocosMap.get(blocoAtivoId) ?? blocoAtivoId
    : "-";
  const unidadeNumero = unidadeAtivaId
    ? unidadesMap.get(unidadeAtivaId) ?? unidadeAtivaId
    : "-";

  async function handleCreate() {
    if (!firestore) return;
    if (!condominioAtivoId || !blocoAtivoId || !unidadeAtivaId) {
      toast({
        variant: "destructive",
        title: "Selecione condomínio, bloco e unidade",
        description:
          "Use os seletores na barra lateral antes de cadastrar um morador.",
      });
      return;
    }

    if (!nome.trim()) {
      toast({
        variant: "destructive",
        title: "Nome obrigatório",
        description: "Informe o nome do morador.",
      });
      return;
    }

    setSaving(true);
    try {
      await addDoc(
        collection(
          firestore,
          `condominios/${condominioAtivoId}/blocos/${blocoAtivoId}/unidades/${unidadeAtivaId}/moradores`
        ),
        {
          nome: nome.trim(),
          email: email.trim() || null,
          telefone: telefone.trim() || null,
          role: role ?? "MORADOR",
          status: "ATIVO",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      toast({ title: "Morador cadastrado com sucesso!" });
      setNome("");
      setEmail("");
      setTelefone("");
      setRole("MORADOR");
      setOpen(false);
    } catch (e: any) {
      console.error("Erro ao criar morador:", e);
      toast({
        variant: "destructive",
        title: "Erro ao cadastrar morador",
        description: e?.message || "Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!condominioAtivoId) {
    return (
      <AppLayout pageTitle="Moradores">
        <Card>
          <CardHeader>
            <CardTitle>Nenhum condomínio ativo</CardTitle>
            <CardDescription>
              Faça login e selecione um condomínio para gerenciar os moradores.
            </CardDescription>
          </CardHeader>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Moradores da Unidade">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Contexto atual</CardTitle>
            <CardDescription>
              Condomínio ativo:{" "}
              <span className="font-medium">
                {vinculoAtivo?.condominioNome ?? condominioAtivoId}
              </span>
              <br />
              Bloco: <span className="font-medium">{blocoNome}</span> — Unidade:{" "}
              <span className="font-medium">{unidadeNumero}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use o seletor de <strong>Bloco/Unidade</strong> na barra lateral
            para alterar a unidade que você está gerenciando.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Moradores</CardTitle>
              <CardDescription>
                Lista de moradores vinculados à unidade selecionada.
              </CardDescription>
            </div>

            {canManage && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>Novo morador</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[520px]">
                  <DialogHeader>
                    <DialogTitle>Cadastrar morador</DialogTitle>
                    <DialogDescription>
                      Preencha os dados do morador para vinculá-lo à unidade
                      atual.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome</Label>
                      <Input
                        id="nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Nome completo"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail (opcional)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone (opcional)</Label>
                      <Input
                        id="telefone"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        placeholder="(00) 00000-0000"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Cargo / tipo</Label>
                      <Select
                        value={role || "MORADOR"}
                        onValueChange={(v) => setRole(v as Morador["role"])}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MORADOR">Morador</SelectItem>
                          <SelectItem value="SINDICO">Síndico</SelectItem>
                          <SelectItem value="SUB_SINDICO">
                            Subsíndico
                          </SelectItem>
                          <SelectItem value="PORTEIRO">Porteiro</SelectItem>
                          <SelectItem value="FUNCIONARIO">
                            Funcionário
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button onClick={handleCreate} disabled={saving}>
                      {saving ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>

          <CardContent>
            {moradoresError && (
              <div className="mb-3 text-sm text-destructive">
                Erro ao carregar moradores: {String(moradoresError)}
              </div>
            )}

            {isLoadingBlocos || isLoadingUnidades || isLoadingMoradores ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Carregando moradores...
              </div>
            ) : !blocoAtivoId || !unidadeAtivaId ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Selecione um <strong>bloco</strong> e uma{" "}
                <strong>unidade</strong> na barra lateral para visualizar os
                moradores.
              </div>
            ) : moradores.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum morador cadastrado para esta unidade.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moradores.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {m.nome}
                      </TableCell>
                      <TableCell>{m.email || "-"}</TableCell>
                      <TableCell>{m.telefone || "-"}</TableCell>
                      <TableCell>{m.role || "MORADOR"}</TableCell>
                      <TableCell>{m.status || "ATIVO"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {!canManage && (
              <p className="mt-4 text-xs text-muted-foreground">
                Você não possui permissão para cadastrar moradores. Apenas
                Síndicos e Super Admin podem cadastrar.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
