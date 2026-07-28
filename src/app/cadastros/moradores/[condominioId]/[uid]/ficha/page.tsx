"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/layout/EmptyState";
import BackButton from "@/components/navigation/BackButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useParams } from "next/navigation";
import { ArrowLeft, Save, Copy, User, Building2, Home, Car, Link } from "lucide-react";

import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { FichaMoradorSchema, emptyFicha, type FichaMorador } from "@/modules/ficha/validators/ficha.schema";
import { loadFicha, saveFicha } from "@/modules/ficha/services/ficha.service";
import { VeiculosSection } from "@/modules/ficha/components/VeiculosSection";

type TabKey = "dados" | "familia" | "moradores" | "veiculos" | "animais" | "info" | "unidades";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "dados",     label: "Dados pessoais",       icon: <User className="h-4 w-4" /> },
  { key: "familia",   label: "Família e dependentes", icon: <Users className="h-4 w-4" /> },
  { key: "moradores", label: "Moradores e empregados", icon: <Building2 className="h-4 w-4" /> },
  { key: "veiculos",  label: "Veículos",              icon: <Car className="h-4 w-4" /> },
  { key: "animais",   label: "Animais",               icon: <PawPrint className="h-4 w-4" /> },
  { key: "info",      label: "Informações técnicas",   icon: <Info className="h-4 w-4" /> },
  { key: "unidades",  label: "Unidades vinculadas",    icon: <Home className="h-4 w-4" /> },
];

export default function FichaMoradorPage() {
  const firestore = useFirestore();
  const { session } = useSessionCtx();

  const params = useParams<{ condominioId: string; uid: string }>();

  const condominioId = String(params?.condominioId ?? "");
  const uid = String(params?.uid ?? "");

  const form = useForm<FichaMorador>({
    resolver: zodResolver(FichaMoradorSchema),
    defaultValues: emptyFicha(),
    mode: "onBlur",
  });

  const dependentes = useFieldArray({ control: form.control, name: "dependentes" });
  const moradoresFixos = useFieldArray({ control: form.control, name: "moradoresFixos" });
  const moradoresTemporarios = useFieldArray({ control: form.control, name: "moradoresTemporarios" });
  const empregados = useFieldArray({ control: form.control, name: "empregados" });

  const [loading, setLoading] = React.useState(true);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [condominioNome, setCondominioNome] = React.useState<string | null>(null);
  const [membroData, setMembroData] = React.useState<any>(null);
  const [activeTab, setActiveTab] = React.useState<TabKey>("dados");
  const [copied, setCopied] = React.useState(false);
  const [vinculos, setVinculos] = React.useState<any[]>([]);
  const [loadingVinculos, setLoadingVinculos] = React.useState(false);

  // UN.5: Load vinculos when unidades tab is selected
  React.useEffect(() => {
    if (activeTab !== "unidades" || !condominioId) return;
    async function load() {
      setLoadingVinculos(true);
      try {
        const token = await session?.user?.getIdToken();
        // Find pessoaId from member or person
        const memberPersonId = membroData?.personId;
        if (!memberPersonId) { setVinculos([]); setLoadingVinculos(false); return; }
        const res = await fetch(`/api/vinculos-unidades?condominioId=${encodeURIComponent(condominioId)}&pessoaId=${encodeURIComponent(memberPersonId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.ok) setVinculos(data.vinculos || []);
        else setVinculos([]);
      } catch { setVinculos([]); }
      setLoadingVinculos(false);
    }
    load();
  }, [activeTab, condominioId, membroData, session]);

  const VINC_TIPOS_LABEL: Record<string, string> = { PROPRIETARIO: "Proprietário", INQUILINO: "Inquilino", MORADOR: "Morador", DEPENDENTE: "Dependente", RESPONSAVEL: "Responsável" };

  function pickCondoName(data: any): string | null {
    if (!data || typeof data !== "object") return null;
    return (
      data.nome ||
      data.nomeFantasia ||
      data.titulo ||
      data.razaoSocial ||
      data.displayName ||
      null
    );
  }

  React.useEffect(() => {
    (async () => {
      try {
        if (!firestore || !condominioId) {
          setCondominioNome(null);
          return;
        }
        const snap = await getDoc(doc(firestore, "condominios", condominioId));
        const nm = pickCondoName(snap.exists() ? snap.data() : null);
        setCondominioNome(nm);
      } catch {
        setCondominioNome(null);
      }
    })();
  }, [firestore, condominioId]);

  React.useEffect(() => {
    (async () => {
      setMsg(null);
      setErr(null);
      if (!firestore) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { ficha, membro } = await loadFicha({ firestore, condominioId, uid });
        const next = ficha ?? emptyFicha();

        if (membro?.nome && !next.perfil.nome) next.perfil.nome = membro.nome;
        if (membro?.email && !next.perfil.email) next.perfil.email = membro.email;
        if (membro?.bloco && !next.perfil.bloco) next.perfil.bloco = membro.bloco;
        if (membro?.apartamento && !next.perfil.unidade) next.perfil.unidade = membro.apartamento;

        setMembroData(membro);
        form.reset(next);
      } catch (e: any) {
        setErr(e?.message || "Falha ao carregar ficha.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, condominioId, uid]);

  async function onSubmit(values: FichaMorador) {
    setMsg(null);
    setErr(null);
    if (!firestore) return;

    try {
      await saveFicha({
        firestore,
        condominioId,
        uid,
        ficha: values,
        updatedByUid: session?.user?.uid ?? null,
      });
      setMsg("Ficha salva com sucesso.");
    } catch (e: any) {
      setErr(e?.message || "Falha ao salvar ficha.");
    }
  }

  function copyUid() {
    navigator.clipboard.writeText(uid).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  const roleLabel: Record<string, string> = {
    MORADOR: "Morador",
    SINDICO: "Síndico",
    PORTEIRO: "Porteiro",
    ZELADOR: "Zelador",
    FUNCIONARIO: "Funcionário",
    ADMIN_CONDOMINIO: "Administrador",
  };

  const statusLabel: Record<string, string> = {
    ATIVO: "Ativo",
    INATIVO: "Inativo",
    PENDENTE: "Pendente",
  };

  const role = membroData?.role ?? null;
  const status = membroData?.status ?? null;
  const bloco = form.watch("perfil.bloco");
  const unidade = form.watch("perfil.unidade");

  const nome = form.watch("perfil.nome") || "";
  const initials = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
  const email = form.watch("perfil.email");
  const celular1 = form.watch("perfil.telefones.celular1");
  const fixo = form.watch("perfil.telefones.fixo");
  const contato = celular1 || fixo || email || null;
  const localLabel = [bloco ? `Bloco ${bloco}` : null, unidade ? `Apto ${unidade}` : null]
    .filter(Boolean)
    .join(" • ") || "—";

  return (
    <AppLayout pageTitle="Ficha Cadastral">
      <div className="w-full max-w-6xl mx-auto space-y-6 pb-4">
        {/* ========== HEADER CRM ========== */}
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col gap-4">
              <BackButton />

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Avatar + dados */}
                <div className="flex items-start gap-4 min-w-0">
                  <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                    <span className="text-xl sm:text-2xl font-bold text-primary">{initials}</span>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words leading-tight">
                      {nome || "—"}
                    </h1>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {role && (
                        <Badge variant="default" className="text-xs">{roleLabel[role] || role}</Badge>
                      )}
                      {status && (
                        <StatusBadge tone={status === "ATIVO" ? "success" : status === "PENDENTE" ? "warning" : "neutral"}>
                          {statusLabel[status] || status}
                        </StatusBadge>
                      )}
                      {(bloco || unidade) && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Home className="h-3 w-3" />
                          {bloco ? `Bloco ${bloco}` : ""}
                          {bloco && unidade ? " • " : ""}
                          {unidade ? `Apto ${unidade}` : ""}
                        </Badge>
                      )}
                      {condominioNome && (
                        <Badge variant="neutral" className="text-xs gap-1 max-w-[200px] truncate">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{condominioNome}</span>
                        </Badge>
                      )}
                    </div>
                    {membroData?.fichaUpdatedAt && (
                      <p className="text-xs text-muted-foreground">
                        Atualizado em {new Date(membroData.fichaUpdatedAt.seconds ? membroData.fichaUpdatedAt.seconds * 1000 : membroData.fichaUpdatedAt).toLocaleDateString("pt-BR")} às {new Date(membroData.fichaUpdatedAt.seconds ? membroData.fichaUpdatedAt.seconds * 1000 : membroData.fichaUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="default"
                  className="gap-2 w-full sm:w-auto shrink-0"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={loading}
                >
                  <Save className="h-4 w-4" />
                  Salvar alterações
                </Button>
              </div>

              {/* ===== RESUMO ===== */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Perfil</p>
                  <p className="text-sm font-medium text-foreground">
                    {form.watch("perfil.tipoMoradia") === "INQUILINO" ? "Inquilino" : "Condômino"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-medium text-foreground">
                    {statusLabel[status || ""] || "—"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Local</p>
                  <p className="text-sm font-medium text-foreground truncate">{localLabel}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Contato</p>
                  <p className="text-sm font-medium text-foreground truncate">{contato || "—"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ========== TABS ========== */}
        <Card className="bg-card border-border shadow-sm overflow-hidden">
          {loading ? (
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Carregando...</p>
            </CardContent>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {/* Tab navigation */}
              <div className="border-b border-border">
                <div className="flex overflow-x-auto -mb-px px-2 sm:px-4">
                  {TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      tabIndex={0}
                      onClick={() => setActiveTab(tab.key)}
                      className={
                        "flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-w-max focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50"
                        + (activeTab === tab.key
                          ? " border-primary text-primary"
                          : " border-transparent text-muted-foreground hover:text-foreground hover:border-border")
                      }
                      aria-selected={activeTab === tab.key}
                      role="tab"
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="px-4 sm:px-6 pt-4 space-y-2">
                {msg && (
                  <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    {msg}
                  </p>
                )}
                {err && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {err}
                  </p>
                )}
              </div>

              <CardContent className="px-4 sm:px-6 pt-6 pb-28 space-y-8">

                {/* ===== TAB: DADOS PESSOAIS ===== */}
                {activeTab === "dados" && (
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Identificação</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Nome</Label>
                          <Input className="tc-input" {...form.register("perfil.nome")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Nascimento (AAAA-MM-DD)</Label>
                          <Input className="tc-input" placeholder="1990-01-21" {...form.register("perfil.nascimento")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Email</Label>
                          <Input className="tc-input" type="email" {...form.register("perfil.email")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Tipo</Label>
                          <select className="w-full h-10 rounded-md px-3 border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" {...form.register("perfil.tipoMoradia")}>
                            <option value="CONDOMINO">Condômino</option>
                            <option value="INQUILINO">Inquilino</option>
                          </select>
                        </div>
                      </div>
                    </section>

                    <div className="border-t border-border" />

                    <section>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Localização</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Bloco</Label>
                          <Input className="tc-input" {...form.register("perfil.bloco")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Unidade / Apto</Label>
                          <Input className="tc-input" {...form.register("perfil.unidade")} />
                        </div>
                      </div>
                    </section>

                    <div className="border-t border-border" />

                    <section>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Contato</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 [&>*]:min-w-0">
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Fixo</Label>
                          <Input className="tc-input" {...form.register("perfil.telefones.fixo")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Celular 1</Label>
                          <Input className="tc-input" {...form.register("perfil.telefones.celular1")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Celular 2</Label>
                          <Input className="tc-input" {...form.register("perfil.telefones.celular2")} />
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {/* ===== TAB: FAMÍLIA E DEPENDENTES ===== */}
                {activeTab === "familia" && (
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Filiação</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Pai</Label>
                          <Input className="tc-input" {...form.register("filiacao.pai")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Mãe</Label>
                          <Input className="tc-input" {...form.register("filiacao.mae")} />
                        </div>
                      </div>
                    </section>

                    <div className="border-t border-border" />

                    <section>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Cônjuge</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Nome</Label>
                          <Input className="tc-input" {...form.register("conjuge.nome")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Nascimento (AAAA-MM-DD)</Label>
                          <Input className="tc-input" {...form.register("conjuge.nascimento")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Pai</Label>
                          <Input className="tc-input" {...form.register("conjuge.pai")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Mãe</Label>
                          <Input className="tc-input" {...form.register("conjuge.mae")} />
                        </div>
                      </div>
                    </section>

                    <div className="border-t border-border" />

                    <section>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Dependentes ({dependentes.fields.length})
                        </h3>
                        <Button type="button" variant="outline" size="sm" className="tc-btn-soft" onClick={() => dependentes.append({ nome: "", nascimento: null })}>
                          + Novo dependente
                        </Button>
                      </div>
                      {dependentes.fields.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">Nenhum dependente cadastrado.</p>
                      )}
                      <div className="space-y-3">
                        {dependentes.fields.map((f, idx) => (
                          <div key={f.id} className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 [&>*]:min-w-0">
                              <div className="space-y-1.5 md:col-span-2">
                                <Label className="text-foreground">Nome</Label>
                                <Input className="tc-input" {...form.register(`dependentes.${idx}.nome` as const)} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-foreground">Nascimento</Label>
                                <Input className="tc-input" placeholder="2008-05-10" {...form.register(`dependentes.${idx}.nascimento` as const)} />
                              </div>
                            </div>
                            <Button type="button" variant="destructive" size="sm" onClick={() => dependentes.remove(idx)}>Remover</Button>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}

                {/* ===== TAB: MORADORES E EMPREGADOS ===== */}
                {activeTab === "moradores" && (
                  <div className="space-y-6">
                    <section>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Moradores fixos ({moradoresFixos.fields.length})
                        </h3>
                        <Button type="button" variant="outline" size="sm" className="tc-btn-soft" onClick={() => moradoresFixos.append({ nome: "", nascimento: null })}>
                          + Novo morador
                        </Button>
                      </div>
                      {moradoresFixos.fields.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">Nenhum morador fixo cadastrado.</p>
                      )}
                      <div className="space-y-3">
                        {moradoresFixos.fields.map((f, idx) => (
                          <div key={f.id} className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 [&>*]:min-w-0">
                              <div className="space-y-1.5 md:col-span-2">
                                <Label className="text-foreground">Nome</Label>
                                <Input className="tc-input" {...form.register(`moradoresFixos.${idx}.nome` as const)} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-foreground">Nascimento</Label>
                                <Input className="tc-input" {...form.register(`moradoresFixos.${idx}.nascimento` as const)} />
                              </div>
                            </div>
                            <Button type="button" variant="destructive" size="sm" onClick={() => moradoresFixos.remove(idx)}>Remover</Button>
                          </div>
                        ))}
                      </div>
                    </section>

                    <div className="border-t border-border" />

                    <section>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Moradores Temporários ({moradoresTemporarios.fields.length})
                        </h3>
                        <Button type="button" variant="outline" size="sm" className="tc-btn-soft" onClick={() => moradoresTemporarios.append({ nome: "", rgOuCpf: null, dataInicio: null, dataFim: null, qrCodeToken: null })}>
                          + Novo morador temporário
                        </Button>
                      </div>
                      {moradoresTemporarios.fields.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">Nenhum morador temporário cadastrado.</p>
                      )}
                      <div className="space-y-3">
                        {moradoresTemporarios.fields.map((f, idx) => (
                          <div key={f.id} className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 [&>*]:min-w-0">
                              <div className="space-y-1.5 md:col-span-2">
                                <Label className="text-foreground">Nome</Label>
                                <Input className="tc-input" {...form.register(`moradoresTemporarios.${idx}.nome` as const)} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-foreground">RG / CPF</Label>
                                <Input className="tc-input" placeholder="000.000.000-00" {...form.register(`moradoresTemporarios.${idx}.rgOuCpf` as const)} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-foreground">Início (AAAA-MM-DD)</Label>
                                <Input className="tc-input" placeholder="2026-07-01" {...form.register(`moradoresTemporarios.${idx}.dataInicio` as const)} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-foreground">Fim (AAAA-MM-DD)</Label>
                                <Input className="tc-input" placeholder="2026-07-31" {...form.register(`moradoresTemporarios.${idx}.dataFim` as const)} />
                              </div>
                            </div>
                            <Button type="button" variant="destructive" size="sm" onClick={() => moradoresTemporarios.remove(idx)}>Remover</Button>
                          </div>
                        ))}
                      </div>
                    </section>

                    <div className="border-t border-border" />

                    <section>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Empregados ({empregados.fields.length})
                        </h3>
                        <Button type="button" variant="outline" size="sm" className="tc-btn-soft" onClick={() => empregados.append({ nome: "", funcao: null, rg: null })}>
                          + Novo empregado
                        </Button>
                      </div>
                      {empregados.fields.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">Nenhum empregado cadastrado.</p>
                      )}
                      <div className="space-y-3">
                        {empregados.fields.map((f, idx) => (
                          <div key={f.id} className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 [&>*]:min-w-0">
                              <div className="space-y-1.5">
                                <Label className="text-foreground">Nome</Label>
                                <Input className="tc-input" {...form.register(`empregados.${idx}.nome` as const)} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-foreground">Função</Label>
                                <Input className="tc-input" {...form.register(`empregados.${idx}.funcao` as const)} />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-foreground">RG</Label>
                                <Input className="tc-input" {...form.register(`empregados.${idx}.rg` as const)} />
                              </div>
                            </div>
                            <Button type="button" variant="destructive" size="sm" onClick={() => empregados.remove(idx)}>Remover</Button>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}

                {/* ===== TAB: VEÍCULOS ===== */}
                {activeTab === "veiculos" && (
                  <div className="space-y-6">
                    <section>
                      <VeiculosSection
                        condominioId={condominioId}
                        uid={uid}
                        firestore={firestore}
                        canEdit={true}
                      />
                    </section>
                  </div>
                )}

                {/* ===== TAB: ANIMAIS ===== */}
                {activeTab === "animais" && (
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Animais</h3>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="animais-possui"
                            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                            {...form.register("animais.possui")}
                          />
                          <Label htmlFor="animais-possui" className="text-foreground cursor-pointer">Possui animais</Label>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Qual(is)</Label>
                          <Input className="tc-input" {...form.register("animais.descricao")} placeholder="Ex: 2 cães, 1 gato" />
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {/* ===== TAB: INFORMAÇÕES TÉCNICAS ===== */}
                {activeTab === "info" && (
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Documentos entregues</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 [&>*]:min-w-0">
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Data (AAAA-MM-DD)</Label>
                          <Input className="tc-input" {...form.register("documentosEntregues.entregueEm")} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-foreground">Entregue por</Label>
                          <Input className="tc-input" {...form.register("documentosEntregues.entreguePor")} />
                        </div>
                      </div>
                    </section>

                    <div className="border-t border-border" />

                    <section>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Identificadores</h3>
                      <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm [&>*]:min-w-0">
                          <div>
                            <span className="text-muted-foreground">UID do membro:</span>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-foreground break-all">{uid}</code>
                              <button
                                type="button"
                                onClick={copyUid}
                                className="text-primary hover:text-primary/80 transition-colors shrink-0"
                                aria-label="Copiar UID"
                                title="Copiar UID"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              {copied && <span className="text-xs text-emerald-600 shrink-0">Copiado!</span>}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Condomínio ID:</span>
                            <p className="text-xs font-mono text-foreground mt-1 break-all">{condominioId}</p>
                          </div>
                          {membroData?.personId && (
                            <div>
                              <span className="text-muted-foreground">Pessoa ID:</span>
                              <p className="text-xs font-mono text-foreground mt-1 break-all">{membroData.personId}</p>
                            </div>
                          )}
                          {membroData?.role && (
                            <div>
                              <span className="text-muted-foreground">Função:</span>
                              <p className="text-sm text-foreground mt-1">{roleLabel[membroData.role] || membroData.role}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === "unidades" && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unidades vinculadas</h3>
                    {loadingVinculos ? (
                      <p className="text-sm text-muted-foreground">Carregando...</p>
                    ) : vinculos.length === 0 ? (
                      <EmptyState
                        icon={Home}
                        title="Nenhuma unidade vinculada"
                        description="Cadastre a pessoa em uma unidade pelo módulo de Cadastros → Pessoas."
                      />
                    ) : (
                      <div className="space-y-2">
                        {vinculos.map((v: any) => (
                          <div key={v.id} className="tc-glass-card p-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">
                                <Link className="h-3 w-3 inline mr-1" />
                                {v.blocoNome || "—"} • {v.unidadeNumero || "—"}
                                {v.principal && <Badge className="ml-2 text-[10px]" variant="default">Principal</Badge>}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {(v.tiposVinculo || []).map((t: string) => VINC_TIPOS_LABEL[t] || t).join(" • ")}
                                {v.resideNaUnidade ? " • Reside" : " • Não residente"}
                              </p>
                            </div>
                            <Badge variant={v.status === "ATIVO" ? "default" : "secondary"}>
                              {v.status === "ATIVO" ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </CardContent>

              {/* ========== FOOTER ACTIONS ========== */}
              <div className="sticky bottom-0 border-t border-border bg-card shadow-sm px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-b-2xl">
                <div className="flex items-center gap-2 order-2 sm:order-1">
                  <BackButton />
                  <Button type="button" variant="outline" className="tc-btn-soft" onClick={() => form.reset(form.getValues())}>
                    Recarregar
                  </Button>
                </div>
                <div className="flex-1 sm:flex sm:justify-end order-1 sm:order-2">
                  <Button type="submit" className="tc-btn-primary gap-2 w-full sm:w-auto">
                    <Save className="h-4 w-4" />
                    Salvar alterações
                  </Button>
                </div>
              </div>
            </form>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

function Users({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PawPrint({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="14" r="3" />
      <circle cx="6" cy="10" r="2" />
      <circle cx="18" cy="10" r="2" />
      <circle cx="8" cy="5" r="1.5" />
      <circle cx="16" cy="5" r="1.5" />
    </svg>
  );
}

function Info({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
