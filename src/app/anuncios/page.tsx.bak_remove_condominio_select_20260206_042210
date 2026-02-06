"use client";

import * as React from "react";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { PlusCircle } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import AppLayout from "@/components/layout/AppLayout";
import CondominioSelect from "@/components/condominios/CondominioSelect";
import { useCondominio } from "@/contexts/CondominioContext";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MensagensSection } from "@/modules/comunicacao/components/MensagensSection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hasRole } from "@/lib/acl";

type Anuncio = {
  id: string;
  titulo: string;
  mensagem: string;
  createdAt?: {
    toDate: () => Date;
  };
  createdByUid?: string;
};

function GlassCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "rounded-3xl border border-black/5 bg-white/65 text-slate-900 shadow-sm backdrop-blur-xl",
        className
      )}
      {...props}
    />
  );
}

// Componente para criar anúncios, visível apenas para admins.
function CreateAnuncioForm() {
  const { session } = useSessionCtx();
  const firestore = useFirestore();
  const { condominioAtivoId } = useCondominio();

  const [titulo, setTitulo] = React.useState("");
  const [mensagem, setMensagem] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function createAnuncio() {
    if (!condominioAtivoId) {
      setErr("Selecione um condomínio para criar um anúncio.");
      return;
    }

    const t = titulo.trim();
    const m = mensagem.trim();
    if (!t || !m) {
      setErr("Preencha título e mensagem.");
      return;
    }

    setSaving(true);
    setErr(null);

    try {
      await addDoc(collection(firestore, "condominios", condominioAtivoId, "anuncios"), {
        titulo: t,
        mensagem: m,
        createdAt: serverTimestamp(),
        createdByUid: session?.user?.uid ?? null,
      });
      setTitulo("");
      setMensagem("");
    } catch(e: any) {
        setErr(e?.message || "Ocorreu um erro ao publicar.")
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="lg:col-span-1">
      <CardHeader>
        <CardTitle>Criar anúncio</CardTitle>
        <CardDescription>Publicar avisos para os moradores.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!condominioAtivoId && <p className="text-sm text-amber-700">Selecione um condomínio para criar um anúncio.</p>}
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do anúncio" disabled={!condominioAtivoId} />
        <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} className="min-h-[120px] w-full rounded-xl border p-3 disabled:opacity-50" placeholder="Mensagem" disabled={!condominioAtivoId} />
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <Button onClick={createAnuncio} disabled={saving || !condominioAtivoId}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {saving ? 'Publicando...' : 'Publicar'}
        </Button>
      </CardContent>
    </GlassCard>
  );
}

// Componente para listar anúncios, visível para todos.
function AnnouncementsList() {
  const { condominioAtivoId } = useCondominio();
  const firestore = useFirestore();

  const anunciosQuery = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId) return null;
    return query(collection(firestore, "condominios", condominioAtivoId, "anuncios"), orderBy("createdAt", "desc"));
  }, [firestore, condominioAtivoId]);

  const { data: anuncios, isLoading, error } = useCollection<Anuncio>(anunciosQuery);

  return (
    <GlassCard className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Últimos anúncios</CardTitle>
        <CardDescription>Avisos importantes para todos os moradores.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <div>Carregando anúncios...</div>}
        {error && <div className="text-red-600 text-sm">{error.message}</div>}
        {!isLoading && !condominioAtivoId && (
            <div className="text-sm text-slate-600">Selecione um condomínio para ver os anúncios.</div>
        )}
        {!isLoading && condominioAtivoId && anuncios && anuncios.length === 0 && (
          <div className="text-sm text-slate-600">Nenhum anúncio encontrado para este condomínio.</div>
        )}
        {!isLoading && anuncios && anuncios.map((a) => (
          <div key={a.id} className="rounded-xl border p-4">
            <div className="flex justify-between items-baseline">
                <div className="font-semibold">{a.titulo}</div>
                {a.createdAt && (
                    <div className="text-xs text-slate-500">
                        {formatDistanceToNow(a.createdAt.toDate(), { addSuffix: true, locale: ptBR })}
                    </div>
                )}
            </div>
            <div className="text-sm mt-1 whitespace-pre-wrap">{a.mensagem}</div>
          </div>
        ))}
      </CardContent>
    </GlassCard>
  );
}


export default function AnunciosPage() {
  const { session } = useSessionCtx();
  const { condominioAtivoId, setCondominioAtivoId } = useCondominio();
  
  const canManage = hasRole(session, ["SUPER_ADMIN", "ADMIN", "SINDICO"]);

  const [aba, setAba] = React.useState<"ANUNCIOS" | "MENSAGENS">("ANUNCIOS");


  return (
    <AppLayout pageTitle="Comunicação">
      {canManage && (
        <div
          className="mb-8 p-4 rounded-3xl"
          style={{
            background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(13,148,136,0.15))",
          }}
        >
          <CondominioSelect
            value={condominioAtivoId}
            onChange={(id) => setCondominioAtivoId(id)}
            label="Condomínio ativo"
          />
        </div>
      )}
      
        <Tabs value={aba} onValueChange={(v) => setAba(v as any)} className="space-y-6">
          <TabsList className="w-full justify-start flex flex-wrap gap-2">
            <TabsTrigger value="ANUNCIOS">Anúncios</TabsTrigger>
            <TabsTrigger value="MENSAGENS">Mensagens</TabsTrigger>
          </TabsList>

          <TabsContent value="ANUNCIOS" className="space-y-6">
            <div className={cn("grid gap-6", canManage ? "lg:grid-cols-3" : "lg:grid-cols-1")}>
              {canManage ? (
                <>
                  <CreateAnuncioForm />
                  <AnnouncementsList />
                </>
              ) : (
                <AnnouncementsList />
              )}
            </div>
          </TabsContent>

          <TabsContent value="MENSAGENS" className="space-y-6">
              <MensagensSection />
            </TabsContent>
        </Tabs>
    </AppLayout>
  );
}
