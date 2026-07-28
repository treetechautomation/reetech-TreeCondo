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
  doc,
  updateDoc,
  onSnapshot,
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
    !!session?.superAdmin ||
    vinculoAtivo?.role === "SINDICO" ||
    vinculoAtivo?.role === "ADMIN";

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

  const [fracaoIdeal, setFracaoIdeal] = useState("");
  const [savingFracao, setSavingFracao] = useState(false);

  // Consumo States
  const [aguaConsumo, setAguaConsumo] = useState("");
  const [gasConsumo, setGasConsumo] = useState("");
  const [mesConsumo, setMesConsumo] = useState(String(new Date().getMonth() + 1));
  const [anoConsumo, setAnoConsumo] = useState(String(new Date().getFullYear()));
  const [savingConsumo, setSavingConsumo] = useState(false);

  async function handleSaveConsumo() {
    if (!firestore || !condominioAtivoId || !blocoAtivoId || !unidadeAtivaId) return;
    const agua = parseFloat(aguaConsumo);
    const gas = parseFloat(gasConsumo);
    const mes = parseInt(mesConsumo);
    const ano = parseInt(anoConsumo);

    if (isNaN(agua) || agua < 0 || isNaN(gas) || gas < 0) {
      toast({
        variant: "destructive",
        title: "Erro nos valores",
        description: "Os consumos de água e gás devem ser números válidos.",
      });
      return;
    }

    setSavingConsumo(true);
    try {
      const colRef = collection(
        firestore,
        `condominios/${condominioAtivoId}/blocos/${blocoAtivoId}/unidades/${unidadeAtivaId}/consumo`
      );
      await addDoc(colRef, {
        agua,
        gas,
        mes,
        ano,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Leitura de Consumo salva com sucesso!" });
      setAguaConsumo("");
      setGasConsumo("");
    } catch (e: any) {
      console.error("Erro ao salvar consumo:", e);
      toast({
        variant: "destructive",
        title: "Erro ao salvar consumo",
        description: e.message || String(e),
      });
    } finally {
      setSavingConsumo(false);
    }
  }

  // Carregar fração ideal
  React.useEffect(() => {
    if (!firestore || !condominioAtivoId || !blocoAtivoId || !unidadeAtivaId) {
      setFracaoIdeal("");
      return;
    }
    const unitRef = doc(firestore, `condominios/${condominioAtivoId}/blocos/${blocoAtivoId}/unidades/${unidadeAtivaId}`);
    const unsub = onSnapshot(unitRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setFracaoIdeal(data.fracaoIdeal !== undefined ? String(data.fracaoIdeal) : "");
      } else {
        setFracaoIdeal("");
      }
    }, (err) => {
      console.error("Erro ao ler unidade:", err);
    });
    return unsub;
  }, [firestore, condominioAtivoId, blocoAtivoId, unidadeAtivaId]);

  async function handleSaveFracaoIdeal() {
    if (!firestore || !condominioAtivoId || !blocoAtivoId || !unidadeAtivaId) return;
    const value = parseFloat(fracaoIdeal);
    if (isNaN(value) || value < 0) {
      toast({
        variant: "destructive",
        title: "Valor inválido",
        description: "A fração ideal deve ser um número decimal válido (ex: 0.0035).",
      });
      return;
    }

    setSavingFracao(true);
    try {
      const unitRef = doc(firestore, `condominios/${condominioAtivoId}/blocos/${blocoAtivoId}/unidades/${unidadeAtivaId}`);
      await updateDoc(unitRef, {
        fracaoIdeal: value,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Fração ideal atualizada com sucesso!" });
    } catch (e: any) {
      console.error("Erro ao salvar fração ideal:", e);
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message || String(e) });
    } finally {
      setSavingFracao(false);
    }
  }

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
        <Card className="bg-slate-900/40 border-white/10 text-white rounded-3xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-white text-lg">Unidade Selecionada & Configuração</CardTitle>
            <CardDescription className="text-white/60">
              Condomínio ativo: <span className="text-white font-bold">{(vinculoAtivo as any)?.condominioNome ?? condominioAtivoId}</span>
              <br />
              Bloco: <span className="text-white font-bold">{blocoNome}</span> — Unidade: <span className="text-white font-bold">{unidadeNumero}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-white/50">
              Use o seletor de <strong>Bloco/Unidade</strong> na barra lateral para trocar de unidade.
            </p>
            {blocoAtivoId && unidadeAtivaId && (
              <>
                <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-end gap-3 max-w-md">
                  <div className="space-y-1.5 flex-1">
                    <Label htmlFor="fracaoIdeal" className="text-white">Fração Ideal da Unidade</Label>
                    <Input
                      id="fracaoIdeal"
                      type="number"
                      step="0.000001"
                      disabled={!canManage}
                      value={fracaoIdeal}
                      onChange={(e) => setFracaoIdeal(e.target.value)}
                      placeholder="Ex: 0.0025"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                    />
                  </div>
                  {canManage && (
                    <Button 
                      onClick={handleSaveFracaoIdeal} 
                      disabled={savingFracao}
                      className="bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none"
                    >
                      {savingFracao ? "Salvando..." : "Salvar Fração"}
                    </Button>
                  )}
                </div>

                {canManage && (
                  <div className="pt-4 mt-4 border-t border-white/10 space-y-4 max-w-xl">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Lançar Consumos da Unidade (Leitura Mensal)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="mesConsumo" className="text-white text-xs">Mês</Label>
                        <Select value={mesConsumo} onValueChange={setMesConsumo}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-950 text-white border-white/15">
                            {Array.from({ length: 12 }, (_, i) => (
                              <SelectItem key={i + 1} value={String(i + 1)}>
                                {String(i + 1).padStart(2, "0")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="anoConsumo" className="text-white text-xs">Ano</Label>
                        <Input
                          id="anoConsumo"
                          type="number"
                          value={anoConsumo}
                          onChange={(e) => setAnoConsumo(e.target.value)}
                          className="bg-white/5 border-white/10 text-white text-xs h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="aguaConsumo" className="text-white text-xs">Água (m³)</Label>
                        <Input
                          id="aguaConsumo"
                          type="number"
                          step="0.01"
                          placeholder="Ex: 12.5"
                          value={aguaConsumo}
                          onChange={(e) => setAguaConsumo(e.target.value)}
                          className="bg-white/5 border-white/10 text-white text-xs h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="gasConsumo" className="text-white text-xs">Gás (kg)</Label>
                        <Input
                          id="gasConsumo"
                          type="number"
                          step="0.01"
                          placeholder="Ex: 8.2"
                          value={gasConsumo}
                          onChange={(e) => setGasConsumo(e.target.value)}
                          className="bg-white/5 border-white/10 text-white text-xs h-9"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleSaveConsumo}
                      disabled={savingConsumo}
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none h-9 text-xs"
                    >
                      {savingConsumo ? "Registrando..." : "Registrar Leitura"}
                    </Button>
                  </div>
                )}
              </>
            )}
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
              <div className="overflow-x-auto w-full">
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
              </div>
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
