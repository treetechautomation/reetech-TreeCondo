"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";




import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useCondominio } from "@/contexts/CondominioContext";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  getDoc,
  where,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

type MembroRole = "MORADOR" | "SINDICO" | "PORTEIRO" | "ZELADOR" | "FUNCIONARIO";
type FuncionarioTipo = "SEGURANCA" | "LIMPEZA" | "MANUTENCAO";


type Membro = {
  id: string;
  nome: string;
  email: string;
  role: MembroRole;
  blocoId?: string | null;
  unidadeId?: string | null;
  tipo?: "FUNCIONARIO" | null;
  funcionarioTipo?: FuncionarioTipo | null;
  status?: "ATIVO" | "INATIVO" | "PENDENTE";
  isSuperAdmin?: boolean;
};

type CondoPublico = {
  id: string; // docId de condominiosPublicos
  condominioId: string; // id real do condomínio (pode ser o mesmo que o id)
  nome: string;
  ativo?: boolean;
};

export default function PessoasPage() {
  const { condominioAtivoId } = useCondominio();
  const { session } = useSessionCtx();
  const firestore = useFirestore();
  const { toast } = useToast();

  const canPickCondo = session?.superAdmin || (session?.vinculos ?? []).length > 0;

  const [loading, setLoading] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);

  const [abaLista, setAbaLista] = useState<
    "MORADORES" | "SINDICOS" | "PORTEIROS" | "ZELADORES" | "FUNCIONARIOS" | "TODOS"
  >("TODOS");

  

  const ABA_LISTA_ORDER = [
    "TODOS",
    "MORADORES",
    "SINDICOS",
    "PORTEIROS",
    "ZELADORES",
    "FUNCIONARIOS",
  ] as const;

  const ABA_LISTA_LABEL: Record<string, string> = {
    TODOS: "Todos",
    MORADORES: "Moradores",
    SINDICOS: "Síndicos",
    PORTEIROS: "Porteiros",
    ZELADORES: "Zeladores",
    FUNCIONARIOS: "Funcionários",
  };

  const abaListaIndex = Math.max(0, (ABA_LISTA_ORDER as any).indexOf(abaLista));
  const abaListaPrev = ABA_LISTA_ORDER[(abaListaIndex - 1 + ABA_LISTA_ORDER.length) % ABA_LISTA_ORDER.length];
  const abaListaNext = ABA_LISTA_ORDER[(abaListaIndex + 1) % ABA_LISTA_ORDER.length];
const membrosFiltrados = useMemo(() => {
    switch (abaLista) {
      case "MORADORES":
        return membros.filter((m) => m.role === "MORADOR");
      case "SINDICOS":
        return membros.filter((m) => m.role === "SINDICO");
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
    role: MembroRole;
    blocoId: string;
    unidadeId: string;
    funcionarioTipo: FuncionarioTipo;
  }>({
    nome: "",
    email: "",
    role: "MORADOR" as MembroRole,
    blocoId: "",
    unidadeId: "",
    funcionarioTipo: "SEGURANCA"
  });
  const [abaConvite, setAbaConvite] = React.useState<"dados"|"local">("dados");

  const [blocos, setBlocos] = React.useState<{ id: string; nome: string }[]>([]);
  const [loadingBlocos, setLoadingBlocos] = React.useState(false);

  
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
          ? list.map((b) => ({ id: String(b.id), nome: String(b.nome ?? b.id) }))
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
  const handleSaveAndInvite = async () => {
    if (!condominioAtivoId) {
      toast({ variant: "destructive", title: "Selecione um condomínio para continuar." });
      return;
    }
    if (!session?.user) {
      toast({ variant: "destructive", title: "Você precisa estar logado." });
      return;
    }
    if (!form.nome.trim() || !form.email.trim()) {
        toast({ variant: "destructive", title: "Preencha nome e e-mail." });
        return;
      }
    
    // ✅ validação correta para MORADOR (sempre)
      if (form.role === "MORADOR") {
        if (!form.blocoId?.trim()) {
          toast({ variant: "destructive", title: "Selecione o bloco (obrigatório para morador)." });
          return;
        }
        if (!form.unidadeId?.trim()) {
          toast({ variant: "destructive", title: "Informe a unidade/apto (obrigatório para morador)." });
          return;
        }
      }
setLoading(true);
    try {
      const idToken = await session.user.getIdToken(true);

      console.log("[INVITE payload]", {
          condominioId: condominioAtivoId,
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role === "FUNCIONARIO" ? "ZELADOR" : form.role,
          tipo: form.role === "FUNCIONARIO" ? "FUNCIONARIO" : null,
          funcionarioTipo: form.role === "FUNCIONARIO" ? form.funcionarioTipo : null,
          blocoId: form.blocoId,
          unidadeId: form.unidadeId,
        });

        const res = await fetch("/api/convites/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          condominioId: condominioAtivoId,
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role === "FUNCIONARIO" ? "ZELADOR" : form.role,
          tipo: form.role === "FUNCIONARIO" ? "FUNCIONARIO" : null,
          funcionarioTipo: form.role === "FUNCIONARIO" ? form.funcionarioTipo : null,
          blocoId: form.blocoId || null,
          unidadeId: form.unidadeId || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Falha ao criar convite.");

      setForm({ nome: "", email: "", role: "MORADOR", blocoId: "", unidadeId: "", funcionarioTipo: "SEGURANCA" });

      toast({
        title: "Convite criado!",
        description:
          data?.emailInfo?.ok === true
            ? "E-mail enviado com sucesso."
            : "Convite criado. (E-mail pode não ter sido enviado — verifique RESEND_API_KEY).",
      });
    } catch (err: any) {
      console.error("[Pessoas] erro ao criar convite:", err);
      toast({
        variant: "destructive",
        title: "Erro ao enviar convite",
        description: err?.message ?? "Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePromoverSindico = async (m: Membro) => {
    if (!firestore || !condominioAtivoId) return;

    try {
      const ref = doc(firestore, `condominios/${condominioAtivoId}/membros/${m.id}`);
      await updateDoc(ref, {
        role: "SINDICO",
        updatedAt: new Date().toISOString(),
      });
      toast({ title: `${m.nome} agora é síndico.` });
    } catch (err: any) {
      console.error("[Pessoas] erro ao promover síndico:", err);
      toast({
        variant: "destructive",
        title: "Erro ao tornar síndico",
        description: "Verifique se você é Super Admin ou Síndico do condomínio.",
      });
    }
  };

  return (
    <AppLayout pageTitle="Moradores / Síndicos" >
      <div className="space-y-8">
        {!condominioAtivoId && (
          <div className="mb-4 rounded-xl border border-dashed bg-white/55 p-6 text-center text-sm text-slate-600 backdrop-blur-xl">
            Selecione um condomínio para gerenciar as pessoas.
          </div>
        )}

        <div className="space-y-4 rounded-2xl border border-black/5 bg-white/55 p-6 shadow-sm backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-slate-900">
            Cadastrar pessoa e enviar convite
          </h2>

          
<Tabs value={abaConvite} onValueChange={(v) => setAbaConvite(v as any)} className="w-full">
  <TabsList className="grid grid-cols-2 w-full rounded-2xl bg-white/40 border border-black/5 p-1">
    <TabsTrigger className="rounded-xl" value="dados">Dados</TabsTrigger>
    <TabsTrigger className="rounded-xl" value="local">Local</TabsTrigger>
  </TabsList>

  <TabsContent value="dados" className="mt-4">
    <div className="grid gap-4 md:grid-cols-3">
            <Input
              placeholder="Nome completo"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
            <Input
              placeholder="E-mail"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
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
              <option value="PORTEIRO">Porteiro</option>
              <option value="FUNCIONARIO">Funcionário</option>
            </select>

            {form.role === "FUNCIONARIO" && (
              <div className="md:col-span-3 grid gap-2">
                <label className="text-sm text-slate-700">Tipo de funcionário</label>
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
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
                <div className="text-xs text-slate-600">
                  Funcionário usa permissões do ZELADOR, com categoria para organização.
                </div>
              </div>
            )}

            </div>
    <div className="mt-3 flex justify-end">
      <Button type="button" variant="outline" onClick={() => setAbaConvite("local")}>
        Próximo: Local
      </Button>
    </div>
  </TabsContent>

  <TabsContent value="local" className="mt-4">
    <div className="grid gap-4 md:grid-cols-2">
      {/* BLOCO */}
      <div className="space-y-1.5">
        <label className="text-sm text-slate-700">Bloco</label>
        <select
          className="h-11 w-full rounded-xl border bg-white/30 px-3 text-sm"
          value={form.blocoId}
          onChange={(e) => setForm((f) => ({ ...f, blocoId: e.target.value, unidadeId: "" }))}
          disabled={!condominioAtivoId || loadingBlocos}
        >
          <option value="">{loadingBlocos ? "Carregando..." : "Selecione o bloco"}</option>
          {blocos.map((b) => (
            <option key={b.id} value={b.id}>{b.nome}</option>
          ))}
        </select>
        {form.role === "MORADOR" ? (
          <div className="text-xs text-slate-600">Obrigatório para morador.</div>
        ) : (
          <div className="text-xs text-slate-600">Opcional para síndico/porteiro/funcionário.</div>
        )}
      </div>

      {/* UNIDADE/APTO (somente MORADOR) */}
      {form.role === "MORADOR" && (
        <div className="space-y-1.5">
          <label className="text-sm text-slate-700">Unidade / Apto</label>
          <input
            value={form.unidadeId}
            onChange={(e) => setForm((f) => ({ ...f, unidadeId: e.target.value }))}
            className="h-11 w-full rounded-xl border bg-white/30 px-3 text-sm"
            placeholder="Ex: 101, 12B, Casa 3..."
          />
          <div className="text-xs text-slate-600">Obrigatório para morador.</div>
        </div>
      )}
    </div>

    <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <Button type="button" variant="outline" onClick={() => setAbaConvite("dados")}>
        Voltar
      </Button>
      <Button onClick={handleSaveAndInvite} disabled={!condominioAtivoId || loading}>
              {loading ? "Enviando..." : "Salvar e enviar"}
            </Button>
    </div>
  </TabsContent>
</Tabs>
</div>

        <div className="rounded-2xl border border-black/5 bg-white/55 p-6 shadow-sm backdrop-blur-xl">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Pessoas cadastradas</h2>

            <Tabs value={abaLista} onValueChange={(v) => setAbaLista(v as any)} className="space-y-4">
              <div className="md:hidden flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl border-white/15 bg-slate-950/35 text-white/80 backdrop-blur hover:bg-slate-950/45"
                    onClick={() => setAbaLista(abaListaPrev as any)}
                    aria-label="Filtro anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="flex-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-center text-sm font-semibold text-white/85 backdrop-blur">
                    {ABA_LISTA_LABEL[abaLista] ?? "Todos"}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl border-white/15 bg-slate-950/35 text-white/80 backdrop-blur hover:bg-slate-950/45"
                    onClick={() => setAbaLista(abaListaNext as any)}
                    aria-label="Próximo filtro"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <TabsList className="hidden md:flex w-full justify-start flex-wrap gap-2">
                  <TabsTrigger value="MORADORES">Moradores</TabsTrigger>
                  <TabsTrigger value="SINDICOS">Síndicos</TabsTrigger>
                  <TabsTrigger value="PORTEIROS">Porteiros</TabsTrigger>
                  <TabsTrigger value="ZELADORES">Zeladores</TabsTrigger>
                  <TabsTrigger value="FUNCIONARIOS">Funcionários</TabsTrigger>
                  <TabsTrigger value="TODOS">Todos</TabsTrigger>
                </TabsList>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Tipo</TableHead>
                  <TableHead>Ficha</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : membrosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center">
                    Nenhuma pessoa cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                membrosFiltrados.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>
                      {m.isSuperAdmin
                        ? "Super Admin"
                        : m.role === "MORADOR"
                        ? "Morador"
                        : m.role === "SINDICO"
                        ? "Síndico"
                        : m.role === "PORTEIRO"
                        ? "Porteiro"
                          
                        : m.role === "ZELADOR" && m.tipo === "FUNCIONARIO"
                        ? `Funcionário (${m.funcionarioTipo === "SEGURANCA" ? "Segurança" : m.funcionarioTipo === "LIMPEZA" ? "Limpeza" : m.funcionarioTipo === "MANUTENCAO" ? "Manutenção" : "—"})`
                        : m.role === "ZELADOR"
                        ? "Zelador"
                        : "Funcionário"}
                    </TableCell>
                      <TableCell>
                        {m.role === "MORADOR" && condominioAtivoId ? (
                          <Button
                              size="sm"
                              asChild
                              className="h-9 rounded-xl px-4 font-semibold text-slate-900 shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
                              style={{ background: "linear-gradient(135deg, hsl(var(--tc-cyan)), hsl(var(--tc-lime)))" }}
                            >
                              <Link href={`/cadastros/moradores/${condominioAtivoId}/${m.id}/ficha`}>Abrir</Link>
                            </Button>
                        ) : (
                          <Button variant="outline" size="sm" disabled>—</Button>
                        )}
                      </TableCell>
                    <TableCell>{m.status ?? "—"}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      {m.role !== "SINDICO" && (
                        <Button variant="outline" size="sm" onClick={() => handlePromoverSindico(m)}>
                          Tornar síndico
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
            </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}

    
