"use client";

import Link from "next/link";
import { MoreVertical, ArrowRight, Building2, UserPlus } from "lucide-react";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { SectionCard } from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import { useCondominio } from "@/contexts/CondominioContext";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { upsertBlocoEspecial } from "@/firebase/firestore/blocos.service";
import { upsertUnidadeEspecial } from "@/firebase/firestore/unidades.service";

type MembroRole = "MORADOR" | "SINDICO" | "PORTEIRO" | "ZELADOR" | "FUNCIONARIO" | "ADMIN_CONDOMINIO";
type FuncionarioTipo = "SEGURANCA" | "LIMPEZA" | "MANUTENCAO";
type TipoVinculoPessoa = "PROPRIETARIO" | "INQUILINO" | "MORADOR_PERMANENTE" | "DEPENDENTE";

type Membro = {
  id: string;
  nome: string;
  email: string;
  role: MembroRole;
  blocoId?: string | null;
  unidadeId?: string | null;
  unitDocId?: string | null;
  tipo?: "FUNCIONARIO" | null;
  funcionarioTipo?: FuncionarioTipo | null;
  status?: "ATIVO" | "INATIVO" | "PENDENTE";
  isSuperAdmin?: boolean;
  personId?: string | null;
};

type CondoPublico = {
  id: string;
  condominioId: string;
  nome: string;
  ativo?: boolean;
};

export default function PessoasPage() {
  const { condominioAtivoId } = useCondominio();
  const { session } = useSessionCtx();
  const firestore = useFirestore();
  const { toast } = useToast();

  const canPickCondo = session?.superAdmin || (session?.vinculos ?? []).length > 0;
  const roleUp = String(session?.role || "").toUpperCase();
  const canManageEstruturaAdm =
    !!session?.superAdmin ||
    roleUp === "SINDICO" ||
    roleUp === "ADMIN" ||
    roleUp === "ADMIN_CONDOMINIO";

  const [loading, setLoading] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);

  const [abaLista, setAbaLista] = useState<
    "MORADORES" | "SINDICOS" | "ADMINISTRADORES" | "PORTEIROS" | "ZELADORES" | "FUNCIONARIOS" | "TODOS"
  >("TODOS");

  const ABA_LISTA_ORDER = [
    "TODOS",
    "MORADORES",
    "SINDICOS",
    "ADMINISTRADORES",
    "PORTEIROS",
    "ZELADORES",
    "FUNCIONARIOS",
  ] as const;

  const ABA_LISTA_LABEL: Record<string, string> = {
    TODOS: "Todos",
    MORADORES: "Moradores",
    SINDICOS: "Síndicos",
    ADMINISTRADORES: "Administradores",
    PORTEIROS: "Porteiros",
    ZELADORES: "Zeladores",
    FUNCIONARIOS: "Funcionários",
  };

  const membrosFiltrados = useMemo(() => {
    switch (abaLista) {
      case "MORADORES":
        return membros.filter((m) => m.role === "MORADOR");
      case "SINDICOS":
        return membros.filter((m) => m.role === "SINDICO");
      case "ADMINISTRADORES":
        return membros.filter((m) => m.role === "ADMIN_CONDOMINIO");
      case "PORTEIROS":
        return membros.filter((m) => m.role === "PORTEIRO");
      case "ZELADORES":
        return membros.filter((m) => m.role === "ZELADOR");
      case "FUNCIONARIOS":
        return membros.filter((m) => m.role === "FUNCIONARIO" || (m.role === "ZELADOR" && m.tipo === "FUNCIONARIO"));
      case "TODOS":
      default:
        return membros;
    }
  }, [membros, abaLista]);

  const [form, setForm] = useState<{
    nome: string;
    email: string;
    telefone: string;
    role: MembroRole;
    blocoId: string;
    unidadeId: string;
    unitDocId: string;
    tipoVinculo: TipoVinculoPessoa;
    funcionarioTipo: FuncionarioTipo;
    permitirAcessoApp: boolean;
    modoAcesso: "SELF_ONBOARDING" | "CONVITE_CODIGO";
  }>({
    nome: "",
    email: "",
    telefone: "",
    role: "MORADOR" as MembroRole,
    blocoId: "",
    unidadeId: "",
    unitDocId: "",
    tipoVinculo: "PROPRIETARIO",
    funcionarioTipo: "SEGURANCA",
    permitirAcessoApp: true,
    modoAcesso: "SELF_ONBOARDING",
  });
  const [abaConvite, setAbaConvite] = React.useState<"dados" | "local">("dados");

  const [blocos, setBlocos] = React.useState<{ id: string; nome: string }[]>([]);
  const [loadingBlocos, setLoadingBlocos] = React.useState(false);

  const [unidadesDoBloco, setUnidadesDoBloco] = React.useState<{ id: string; numero: string }[]>([]);
  const [loadingUnidades, setLoadingUnidades] = React.useState(false);

  // Carrega blocos do condomínio ativo
  useEffect(() => {
    let alive = true;

    async function loadBlocos() {
      try {
        if (!condominioAtivoId) {
          if (alive) setBlocos([]);
          return;
        }

        setLoadingBlocos(true);

        const r = await fetch(`/api/condominios/${condominioAtivoId}/blocos`, {
          cache: "no-store",
        });

        const j = await r.json();
        const list = (j?.blocos ?? j?.data ?? []) as any[];

        if (!alive) return;

        setBlocos(
          Array.isArray(list)
            ? list
                .filter((b: any) => b.ativo !== false)
                .map((b) => ({ id: String(b.id), nome: String(b.nome ?? b.id) }))
            : []
        );
      } catch (e) {
        console.error("[Pessoas] erro ao carregar blocos:", e);
        if (alive) setBlocos([]);
      } finally {
        if (alive) setLoadingBlocos(false);
      }
    }

    loadBlocos();
    return () => {
      alive = false;
    };
  }, [condominioAtivoId]);

  // Carrega unidades do bloco selecionado (catálogo canônico UN.3)
  useEffect(() => {
    let alive = true;

    async function loadUnidades() {
      try {
        if (!condominioAtivoId || !form.blocoId) {
          if (alive) setUnidadesDoBloco([]);
          return;
        }

        setLoadingUnidades(true);

        const params = new URLSearchParams({
          condominioId: condominioAtivoId,
          blocoId: form.blocoId,
          apenasAtivas: "true",
        });
        const r = await fetch(`/api/unidades?${params.toString()}`, { cache: "no-store" });

        const j = await r.json();
        const list = (j?.unidades ?? j?.data ?? []) as any[];

        if (!alive) return;

        setUnidadesDoBloco(
          Array.isArray(list)
            ? list.map((u) => ({ id: String(u.id), numero: String(u.numero ?? u.id) }))
            : []
        );
      } catch (e) {
        console.error("[Pessoas] erro ao carregar unidades:", e);
        if (alive) setUnidadesDoBloco([]);
      } finally {
        if (alive) setLoadingUnidades(false);
      }
    }

    loadUnidades();
    return () => {
      alive = false;
    };
  }, [condominioAtivoId, form.blocoId]);

  // --- Membros do condomínio ativo ---
  useEffect(() => {
    if (!firestore || !condominioAtivoId) {
      setMembros([]);
      return;
    }

    setLoading(true);

    const colRef = collection(firestore, `condominios/${condominioAtivoId}/membros`);
    const q = query(colRef, orderBy("nome"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: Membro[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            nome: data.nome ?? "",
            email: data.email ?? "",
            role: (data.role ?? "MORADOR") as MembroRole,
            blocoId: data.blocoId ?? data.bloco ?? null,
            unidadeId: data.unidadeId ?? data.apartamento ?? null,
            tipo: (data.tipo ?? null) as any,
            funcionarioTipo: (data.funcionarioTipo ?? null) as any,
            status: (data.status ?? (data.ativo === true ? "ATIVO" : undefined)) as any,
            personId: (data.personId ?? null) as any,
          };
        });
        setMembros(items);
        setLoading(false);
      },
      (err) => {
        console.error("[Pessoas] erro ao ouvir membros:", err);
        toast({
          variant: "destructive",
          title: "Erro ao carregar pessoas",
          description: "Verifique suas permissões de acesso.",
        });
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, condominioAtivoId, toast]);

  // --- Criar convite + membro PENDENTE (API Route) ---
  const handleSave = async () => {
    if (!condominioAtivoId) {
      toast({ variant: "destructive", title: "Selecione um condomínio para continuar." });
      return;
    }
    if (!session?.user) {
      toast({ variant: "destructive", title: "Você precisa estar logado." });
      return;
    }
    if (!form.nome.trim()) {
      toast({ variant: "destructive", title: "Preencha o nome." });
      return;
    }
    if (form.permitirAcessoApp && !form.email.trim()) {
      toast({ variant: "destructive", title: "E-mail é obrigatório para acesso ao app." });
      return;
    }
    if (form.role === "MORADOR" && form.permitirAcessoApp) {
      if (!form.blocoId?.trim()) {
        toast({ variant: "destructive", title: "Selecione o bloco." });
        return;
      }
      if (!form.unitDocId?.trim()) {
        toast({ variant: "destructive", title: "Selecione a unidade." });
        return;
      }
    }

    setLoading(true);
    try {
      const idToken = await session.user.getIdToken(true);

      if (form.permitirAcessoApp && form.modoAcesso === "CONVITE_CODIGO") {
        const res = await fetch("/api/convites/create", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            condominioId: condominioAtivoId,
            nome: form.nome.trim(),
            email: form.email.trim().toLowerCase(),
            role: form.role === "FUNCIONARIO" ? "ZELADOR" : form.role,
            tipo: form.role === "FUNCIONARIO" ? "FUNCIONARIO" : null,
            funcionarioTipo: form.role === "FUNCIONARIO" ? form.funcionarioTipo : null,
            blocoId: form.blocoId || null,
            unidadeId: form.unidadeId || null,
            unitDocId: form.unitDocId || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Falha ao criar convite.");
        toast({ title: "Convite criado!", description: data?.emailInfo?.ok ? "E-mail enviado." : "Convite criado." });
      } else {
        const res = await fetch("/api/pessoas/create-or-update", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            condominioId: condominioAtivoId,
            nome: form.nome.trim(),
            email: form.email.trim().toLowerCase() || null,
            telefone: form.telefone.trim() || null,
            blocoId: form.blocoId || null,
            unitDocId: form.unitDocId || null,
            tipoVinculo: form.permitirAcessoApp ? form.tipoVinculo : null,
            permitirAcessoApp: form.permitirAcessoApp,
            modoAcesso: form.permitirAcessoApp ? form.modoAcesso : null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Falha ao salvar.");

        if (data.mode === "SELF_ONBOARDING") {
          toast({ title: "Pessoa cadastrada!", description: "O morador poderá criar sua conta e vincular-se ao condomínio." });
        } else if (data.mode === "PERSON_ONLY") {
          toast({ title: "Pessoa cadastrada!", description: "Cadastro salvo sem acesso ao aplicativo." });
        } else {
          toast({ title: "Pessoa cadastrada!", description: "Operação concluída." });
        }

        // UN.5: Criar VinculoUnidade se bloco/unidade selecionados
        if (data.personId && form.blocoId && form.unitDocId) {
          try {
            const tipos: string[] = [];
            if (form.tipoVinculo === "PROPRIETARIO") tipos.push("PROPRIETARIO");
            if (form.tipoVinculo === "INQUILINO") tipos.push("INQUILINO");
            if (form.tipoVinculo === "MORADOR_PERMANENTE") tipos.push("MORADOR");
            if (form.tipoVinculo === "DEPENDENTE") tipos.push("DEPENDENTE");
            if (tipos.length === 0) tipos.push("MORADOR");
            tipos.push("MORADOR"); // Always adds MORADOR for residents

            await fetch("/api/vinculos-unidades", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
              body: JSON.stringify({
                condominioId: condominioAtivoId,
                pessoaId: data.personId,
                blocoId: form.blocoId,
                unitDocId: form.unitDocId,
                tiposVinculo: [...new Set(tipos)],
                resideNaUnidade: true,
                principal: true,
              }),
            });
          } catch { /* non-blocking */ }
        }
      }

      setForm({
        nome: "", email: "", telefone: "", role: "MORADOR", blocoId: "", unidadeId: "", unitDocId: "",
        tipoVinculo: "PROPRIETARIO", funcionarioTipo: "SEGURANCA", permitirAcessoApp: true, modoAcesso: "SELF_ONBOARDING",
      });
    } catch (err: any) {
      console.error("[Pessoas] erro ao salvar:", err);
      toast({ variant: "destructive", title: "Erro", description: err?.message ?? "Tente novamente." });
    } finally {
      setLoading(false);
    }
  };

  const handleCriarEstruturaAdministrativa = async () => {
    if (!firestore || !condominioAtivoId) {
      toast({
        variant: "destructive",
        title: "Selecione um condomínio antes de continuar.",
      });
      return;
    }

    if (!canManageEstruturaAdm) {
      toast({
        variant: "destructive",
        title: "Sem permissão para criar a estrutura administrativa.",
      });
      return;
    }

    setLoading(true);
    try {
      await upsertBlocoEspecial(firestore, condominioAtivoId, "ADM", {
        nome: "ADM",
        ordem: 0,
      });

      await upsertUnidadeEspecial(
        firestore,
        condominioAtivoId,
        "ADM",
        "ADMINISTRACAO",
        {
          numero: "Administração",
          andar: 0,
        }
      );

      toast({
        title: "Estrutura administrativa pronta",
        description: "Bloco ADM e unidade ADMINISTRACAO criados/atualizados com sucesso.",
      });
    } catch (err: any) {
      console.error("[Pessoas] erro ao criar estrutura administrativa:", err);
      toast({
        variant: "destructive",
        title: "Erro ao criar estrutura administrativa",
        description: err?.message || "Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePromoverSindico = async (m: Membro) => {
    if (!firestore || !condominioAtivoId || !session?.user) return;

    try {
      const idToken = await session.user.getIdToken(true);
      const res = await fetch("/api/membros/promote-sindico", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          condominioId: condominioAtivoId,
          novoUid: m.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Falha ao promover síndico.");
      toast({ title: `${m.nome} agora é síndico.` });
    } catch (err: any) {
      console.error("[Pessoas] erro ao promover síndico:", err);
      toast({
        variant: "destructive",
        title: "Erro ao tornar síndico",
        description: err?.message || "Verifique suas permissões.",
      });
    }
  };

  return (
    <AppLayout
      pageTitle={
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Pessoas e Moradores</h1>
          <p className="mt-0.5 text-xs text-muted-foreground max-w-prose">
            Cadastre moradores, síndicos, funcionários e demais vínculos do condomínio.
          </p>
        </div>
      }
    >
      <div className="space-y-8">
          {!condominioAtivoId && (
            <div className="rounded-xl border border-dashed border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
              Selecione um condomínio para gerenciar as pessoas.
            </div>
          )}

          {canManageEstruturaAdm && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Ações administrativas</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCriarEstruturaAdministrativa}
                disabled={!condominioAtivoId || loading}
              >
                <Building2 className="h-4 w-4" />
                Criar estrutura ADM
              </Button>
            </div>
          )}

          {/* Card de cadastro */}
          <SectionCard title="Nova pessoa" description="Preencha os dados e defina o local e o tipo de acesso.">

            {/* Indicador de etapas */}
            <div className="mb-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAbaConvite("dados")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  abaConvite === "dados"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <span className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  abaConvite === "dados" ? "bg-white/20" : "bg-slate-300/60"
                )}>1</span>
                Dados pessoais
              </button>
              <button
                type="button"
                onClick={() => setAbaConvite("local")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  abaConvite === "local"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <span className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  abaConvite === "local" ? "bg-white/20" : "bg-slate-300/60"
                )}>2</span>
                Local e acesso
              </button>
            </div>

            {/* Etapa 1: Dados */}
            {abaConvite === "dados" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome">Nome completo</Label>
                    <Input
                      id="nome"
                      placeholder="Nome completo"
                      value={form.nome}
                      onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      placeholder="E-mail"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      placeholder="Telefone (opcional)"
                      type="text"
                      value={form.telefone}
                      onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="role">Perfil da pessoa</Label>
                    <select
                      id="role"
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      value={form.role}
                      onChange={(e) => {
                        const role = e.target.value as MembroRole;
                        setForm((f) => ({
                          ...f,
                          role,
                          ...(role === "MORADOR" ? {} : { blocoId: "", unidadeId: "" }),
                        }));
                      }}
                    >
                      <option value="MORADOR">Morador</option>
                      <option value="SINDICO">Síndico</option>
                      <option value="ADMIN_CONDOMINIO">Administrador</option>
                      <option value="PORTEIRO">Porteiro</option>
                      <option value="FUNCIONARIO">Funcionário</option>
                    </select>
                  </div>

                  {form.role === "FUNCIONARIO" && (
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                      <Label htmlFor="funcionarioTipo">Tipo de funcionário</Label>
                      <select
                        id="funcionarioTipo"
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                        value={form.funcionarioTipo}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            funcionarioTipo: e.target.value as any,
                          }))
                        }
                      >
                        <option value="SEGURANCA">Segurança</option>
                        <option value="LIMPEZA">Limpeza</option>
                        <option value="MANUTENCAO">Manutenção</option>
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Funcionário usa permissões do ZELADOR, com categoria para organização.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <Button type="button" className="w-full sm:w-auto" onClick={() => setAbaConvite("local")}>
                    Próximo: Local
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              /* Etapa 2: Local */
              <>
                {/* Seção: Localização */}
                <div className="mb-5">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Localização</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="bloco">Bloco</Label>
                      <select
                        id="bloco"
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                        value={form.blocoId}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, blocoId: e.target.value, unitDocId: "", unidadeId: "" }))
                        }
                        disabled={!condominioAtivoId || loadingBlocos}
                      >
                        <option value="">
                          {loadingBlocos ? "Carregando..." : "Selecione o bloco"}
                        </option>
                        {blocos.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.nome}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">
                        {form.role === "MORADOR"
                          ? "Obrigatório para morador."
                          : "Opcional para síndico/porteiro/funcionário."}
                      </p>
                    </div>

                    {form.role === "MORADOR" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="unidade">Unidade / Apartamento</Label>
                        {blocos.length > 0 && form.blocoId ? (
                          <select
                            id="unidade"
                            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                            value={form.unitDocId}
                            onChange={(e) => {
                              const selId = e.target.value;
                              const sel = unidadesDoBloco.find((u) => u.id === selId);
                              setForm((f) => ({
                                ...f,
                                unitDocId: selId,
                                unidadeId: sel ? sel.numero : "",
                              }));
                            }}
                            disabled={loadingUnidades}
                          >
                            <option value="">
                              {loadingUnidades ? "Carregando..." : "Selecione a unidade"}
                            </option>
                            {unidadesDoBloco.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.numero}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                            value=""
                            disabled
                          >
                            <option value="">Selecione o bloco primeiro</option>
                          </select>
                        )}
                        <p className="text-xs text-muted-foreground">Obrigatório para morador.</p>
                      </div>
                    )}
                  </div>

                  {form.permitirAcessoApp && (
                    <div className="mt-4 space-y-1.5">
                      <Label htmlFor="tipoVinculo">Tipo de vínculo</Label>
                      <select
                        id="tipoVinculo"
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                        value={form.tipoVinculo}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, tipoVinculo: e.target.value as TipoVinculoPessoa }))
                        }
                      >
                        <option value="PROPRIETARIO">Proprietário</option>
                        <option value="INQUILINO">Inquilino</option>
                        <option value="MORADOR_PERMANENTE">Morador permanente</option>
                        <option value="DEPENDENTE">Dependente</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Seção: Acesso ao aplicativo */}
                <div className="border-t pt-5">
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Acesso ao aplicativo</h3>

                  <label className="mb-4 flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.permitirAcessoApp}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, permitirAcessoApp: e.target.checked }))
                      }
                      className="mt-0.5 h-5 w-5 rounded border-black/20 text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        Permitir acesso ao aplicativo
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {form.permitirAcessoApp
                          ? "A pessoa poderá acessar o TreeCondo após confirmar seu e-mail."
                          : "Apenas cadastro interno, sem acesso ao app."}
                      </div>
                    </div>
                  </label>

                  {form.permitirAcessoApp && (
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <div className="mb-3 text-xs font-semibold text-muted-foreground">
                        Como a pessoa receberá acesso?
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                            form.modoAcesso === "SELF_ONBOARDING"
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border hover:border-slate-300"
                          )}
                        >
                          <input
                            type="radio"
                            name="modoAcesso"
                            value="SELF_ONBOARDING"
                            checked={form.modoAcesso === "SELF_ONBOARDING"}
                            onChange={() =>
                              setForm((f) => ({ ...f, modoAcesso: "SELF_ONBOARDING" }))
                            }
                            className="mt-0.5 h-4 w-4 text-primary focus:ring-primary"
                          />
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              Criará a própria conta
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Recomendado para moradores
                            </div>
                          </div>
                        </label>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                            form.modoAcesso === "CONVITE_CODIGO"
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border hover:border-slate-300"
                          )}
                        >
                          <input
                            type="radio"
                            name="modoAcesso"
                            value="CONVITE_CODIGO"
                            checked={form.modoAcesso === "CONVITE_CODIGO"}
                            onChange={() =>
                              setForm((f) => ({ ...f, modoAcesso: "CONVITE_CODIGO" }))
                            }
                            className="mt-0.5 h-4 w-4 text-primary focus:ring-primary"
                          />
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              Receberá um convite com código
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Fluxo tradicional
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <Button type="button" variant="outline" onClick={() => setAbaConvite("dados")}>
                    Voltar
                  </Button>
                  <Button onClick={handleSave} disabled={!condominioAtivoId || loading}>
                    {loading ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </>
            )}
          </SectionCard>

          {/* Listagem de pessoas */}
          <SectionCard title="Pessoas cadastradas" description="Gerencie perfis, vínculos e fichas cadastrais.">

            {/* Chips de filtro */}
            <div className="-mx-1 mb-4 flex flex-nowrap gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {ABA_LISTA_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAbaLista(key)}
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    abaLista === key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                  aria-pressed={abaLista === key}
                >
                  {ABA_LISTA_LABEL[key]}
                </button>
              ))}
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold text-foreground">Nome</TableHead>
                    <TableHead className="font-semibold text-foreground">E-mail</TableHead>
                    <TableHead className="font-semibold text-foreground">Tipo</TableHead>
                    <TableHead className="font-semibold text-foreground">Ficha</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="text-right font-semibold text-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : membrosFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Nenhuma pessoa cadastrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    membrosFiltrados.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.nome}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={m.email}>
                          {m.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="neutral">
                            {m.isSuperAdmin
                              ? "Super Admin"
                              : m.role === "MORADOR"
                              ? "Morador"
                              : m.role === "SINDICO"
                              ? "Síndico"
                              : m.role === "ADMIN_CONDOMINIO"
                              ? "Administrador"
                              : m.role === "PORTEIRO"
                              ? "Porteiro"
                              : m.role === "ZELADOR" && m.tipo === "FUNCIONARIO"
                              ? `Func. (${
                                  m.funcionarioTipo === "SEGURANCA"
                                    ? "Segurança"
                                    : m.funcionarioTipo === "LIMPEZA"
                                    ? "Limpeza"
                                    : m.funcionarioTipo === "MANUTENCAO"
                                    ? "Manutenção"
                                    : "—"
                                })`
                              : m.role === "ZELADOR"
                              ? "Zelador"
                              : "Funcionário"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {m.role === "MORADOR" && condominioAtivoId ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link
                                href={`/cadastros/moradores/${condominioAtivoId}/${m.id}/ficha`}
                              >
                                Abrir
                              </Link>
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled>
                              —
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          {m.status ? (
                            <Badge
                              variant={
                                m.status === "ATIVO"
                                  ? "success"
                                  : m.status === "PENDENTE"
                                  ? "warning"
                                  : m.status === "INATIVO"
                                  ? "neutral"
                                  : "neutral"
                              }
                            >
                              {m.status}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`Ações para ${m.nome}`}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {m.role === "MORADOR" && condominioAtivoId && (
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/cadastros/moradores/${condominioAtivoId}/${m.id}/ficha`}
                                  >
                                    Abrir ficha
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              {m.role !== "SINDICO" && (
                                <DropdownMenuItem
                                  onClick={() => handlePromoverSindico(m)}
                                >
                                  Tornar síndico
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        </div>
    </AppLayout>
  );
}
