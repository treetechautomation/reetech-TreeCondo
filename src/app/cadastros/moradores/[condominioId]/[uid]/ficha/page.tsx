"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useParams } from "next/navigation";


import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";

import { FichaMoradorSchema, emptyFicha, type FichaMorador } from "@/modules/ficha/validators/ficha.schema";
import { loadFicha, saveFicha } from "@/modules/ficha/services/ficha.service";
import { VeiculosSection } from "@/modules/ficha/components/VeiculosSection";

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
  const empregados = useFieldArray({ control: form.control, name: "empregados" });

  const [loading, setLoading] = React.useState(true);

  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const [condominioNome, setCondominioNome] = React.useState<string | null>(null);

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
      setMsg("✅ Ficha salva com sucesso.");
    } catch (e: any) {
      setErr(e?.message || "Falha ao salvar ficha.");
    }
  }

  return (
    <AppLayout pageTitle="Ficha Cadastral do Morador">
      <div className="max-w-5xl space-y-4">
        <Card className="tc-card">
          
<CardHeader className="space-y-2">
  <div className="space-y-1">
    <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900">
      Ficha cadastral{form.watch("perfil.nome") ? ` • ${form.watch("perfil.nome")}` : ""}
    </CardTitle>

    <CardDescription className="text-slate-700">
      {condominioNome ? (
        <span>
          Condomínio: <span className="font-semibold text-slate-900">{condominioNome}</span>
        </span>
      ) : (
        <span>
          Condomínio: <span className="font-mono text-xs text-slate-700">{condominioId}</span>
        </span>
      )}
    </CardDescription>
  </div>

  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
    <span className="rounded-full bg-white/60 px-3 py-1">
      Morador: <span className="font-medium text-slate-900">{form.watch("perfil.nome") || "—"}</span>
    </span>
    <span className="rounded-full bg-white/60 px-3 py-1">
      UID: <span className="font-mono">{uid}</span>
    </span>
  </div>
</CardHeader>

          <CardContent className="text-slate-900">
            {loading ? (
              <p className="text-sm text-slate-600">Carregando...</p>
            ) : (
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 text-slate-900 [&_h3]:text-slate-900 [&_h3]:font-bold [&_h3]:tracking-tight [&_label]:text-slate-800 [&_label]:font-semibold">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold tracking-wide text-slate-800">Identificação</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Nome</Label>
                      <Input className="tc-input" {...form.register("perfil.nome")} />
                    </div>
                    <div className="space-y-1">
                      <Label>Nascimento (AAAA-MM-DD)</Label>
                      <Input className="tc-input" placeholder="1990-01-21" {...form.register("perfil.nascimento")} />
                    </div>
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input className="tc-input" type="email" {...form.register("perfil.email")} />
                    </div>
                    <div className="space-y-1">
                      <Label>Tipo</Label>
                      <select className="w-full h-10 rounded-md px-3 tc-input" {...form.register("perfil.tipoMoradia")}>
                        <option value="CONDOMINO">Condômino</option>
                        <option value="INQUILINO">Inquilino</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Bloco</Label>
                      <Input className="tc-input" {...form.register("perfil.bloco")} />
                    </div>
                    <div className="space-y-1">
                      <Label>Unidade / Apto</Label>
                      <Input className="tc-input" {...form.register("perfil.unidade")} />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold tracking-wide text-slate-800">Telefones</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label>Fixo</Label>
                      <Input className="tc-input" {...form.register("perfil.telefones.fixo")} />
                    </div>
                    <div className="space-y-1">
                      <Label>Celular 1</Label>
                      <Input className="tc-input" {...form.register("perfil.telefones.celular1")} />
                    </div>
                    <div className="space-y-1">
                      <Label>Celular 2</Label>
                      <Input className="tc-input" {...form.register("perfil.telefones.celular2")} />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold tracking-wide text-slate-800">Filiação</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Pai</Label>
                      <Input className="tc-input" {...form.register("filiacao.pai")} />
                    </div>
                    <div className="space-y-1">
                      <Label>Mãe</Label>
                      <Input className="tc-input" {...form.register("filiacao.mae")} />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold tracking-wide text-slate-800">Cônjuge</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Nome</Label>
                      <Input className="tc-input" {...form.register("conjuge.nome")} />
                    </div>
                    <div className="space-y-1">
                      <Label>Nascimento (AAAA-MM-DD)</Label>
                      <Input className="tc-input" {...form.register("conjuge.nascimento")} />
                    </div>
                    <div className="space-y-1">
                      <Label>Pai</Label>
                      <Input className="tc-input" {...form.register("conjuge.pai")} />
                    </div>
                    <div className="space-y-1">
                      <Label>Mãe</Label>
                      <Input className="tc-input" {...form.register("conjuge.mae")} />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-wide text-slate-800">Dependentes</h3>
                    <Button type="button" variant="outline" className="tc-btn-soft" onClick={() => dependentes.append({ nome: "", nascimento: null })}>
                      + Adicionar
                    </Button>
                  </div>
                  {dependentes.fields.map((f, idx) => (
                    <div key={f.id} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1 md:col-span-2">
                        <Label>Nome</Label>
                        <Input className="tc-input" {...form.register(`dependentes.${idx}.nome` as const)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Nascimento</Label>
                        <Input className="tc-input" placeholder="2008-05-10" {...form.register(`dependentes.${idx}.nascimento` as const)} />
                      </div>
                      <div className="md:col-span-3">
                        <Button type="button" variant="destructive" onClick={() => dependentes.remove(idx)}>Remover</Button>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-wide text-slate-800">Moradores fixos</h3>
                    <Button type="button" variant="outline" className="tc-btn-soft" onClick={() => moradoresFixos.append({ nome: "", nascimento: null })}>
                      + Adicionar
                    </Button>
                  </div>
                  {moradoresFixos.fields.map((f, idx) => (
                    <div key={f.id} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1 md:col-span-2">
                        <Label>Nome</Label>
                        <Input className="tc-input" {...form.register(`moradoresFixos.${idx}.nome` as const)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Nascimento</Label>
                        <Input className="tc-input" {...form.register(`moradoresFixos.${idx}.nascimento` as const)} />
                      </div>
                      <div className="md:col-span-3">
                        <Button type="button" variant="destructive" onClick={() => moradoresFixos.remove(idx)}>Remover</Button>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-wide text-slate-800">Empregados</h3>
                    <Button type="button" variant="outline" className="tc-btn-soft" onClick={() => empregados.append({ nome: "", funcao: null, rg: null })}>
                      + Adicionar
                    </Button>
                  </div>
                  {empregados.fields.map((f, idx) => (
                    <div key={f.id} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label>Nome</Label>
                        <Input className="tc-input" {...form.register(`empregados.${idx}.nome` as const)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Função</Label>
                        <Input className="tc-input" {...form.register(`empregados.${idx}.funcao` as const)} />
                      </div>
                      <div className="space-y-1">
                        <Label>RG</Label>
                        <Input className="tc-input" {...form.register(`empregados.${idx}.rg` as const)} />
                      </div>
                      <div className="md:col-span-3">
                        <Button type="button" variant="destructive" onClick={() => empregados.remove(idx)}>Remover</Button>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold tracking-wide text-slate-800">Animais</h3>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" {...form.register("animais.possui")} />
                    <Label>Possui animais</Label>
                  </div>
                  <div className="space-y-1">
                    <Label>Qual(is)</Label>
                    <Input className="tc-input" {...form.register("animais.descricao")} placeholder="Ex: 2 cães, 1 gato" />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold tracking-wide text-slate-800">Documentos entregues</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Data (AAAA-MM-DD)</Label>
                      <Input className="tc-input" {...form.register("documentosEntregues.entregueEm")} />
                    </div>
                    <div className="space-y-1">
                      <Label>Entregue por</Label>
                      <Input className="tc-input" {...form.register("documentosEntregues.entreguePor")} />
                    </div>
                  </div>
                </section>

                {msg && <p className="text-sm text-emerald-700">{msg}</p>}
                {err && <p className="text-sm text-red-600">{err}</p>}

                <div className="flex gap-2">
                  <Button type="submit" className="tc-btn-primary">Salvar ficha</Button>
                  <Button type="button" variant="outline" className="tc-btn-soft" onClick={() => form.reset(form.getValues())}>
                    Recarregar
                  </Button>
                </div>

                  <VeiculosSection
                    condominioId={condominioId}
                    uid={uid}
                    firestore={firestore}
                    canEdit={true}
                  />

              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
