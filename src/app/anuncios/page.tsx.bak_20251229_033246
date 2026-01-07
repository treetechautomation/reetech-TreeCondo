"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import CondominioSelect from "@/components/condominios/CondominioSelect";
import { useSession } from "@/hooks/useSession";
import { initializeFirebase } from "@/firebase";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PlusCircle } from "lucide-react";

type Anuncio = {
  id: string;
  titulo: string;
  mensagem: string;
  createdAt?: any;
};

function GlassCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "border-white/10 bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)] backdrop-blur rounded-3xl",
        className
      )}
      {...props}
    />
  );
}

export default function AnunciosPage() {
  const { session, isSessionLoading, setActiveCondominioId } = useSession();
  const [condominioId, setCondominioId] = React.useState<string | null>(null);

  const [anuncios, setAnuncios] = React.useState<Anuncio[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [titulo, setTitulo] = React.useState("");
  const [mensagem, setMensagem] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // resolve condomínio ativo (session -> localStorage fallback)
  React.useEffect(() => {
    if (isSessionLoading) return;

    const fromSession = session?.activeCondominioId ?? null;
    const fromLocal = typeof window !== "undefined" ? window.localStorage.getItem("treecondo_condominioId") : null;

    const resolved = fromSession ?? fromLocal;
    setCondominioId(resolved);

    if (!fromSession && resolved) {
      // se veio do localStorage, sincroniza sessão também
      setActiveCondominioId(resolved);
    }
  }, [isSessionLoading, session?.activeCondominioId, setActiveCondominioId]);

  // listener anuncios por condomínio
  React.useEffect(() => {
    if (!condominioId) {
      setAnuncios([]);
      return;
    }

    const { firestore } = initializeFirebase();
    setLoading(true);

    const colRef = collection(firestore, "condominios", condominioId, "anuncios");
    const q = query(colRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Anuncio[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setAnuncios(list);
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [condominioId]);

  function onPickCondo(id: string) {
    setCondominioId(id);
    setActiveCondominioId(id);
    if (typeof window !== "undefined") window.localStorage.setItem("treecondo_condominioId", id);
  }

  async function createAnuncio() {
    if (!condominioId) return;
    setErr(null);

    const t = titulo.trim();
    const m = mensagem.trim();
    if (!t || !m) {
      setErr("Preencha título e mensagem.");
      return;
    }

    setSaving(true);
    try {
      const { firestore } = initializeFirebase();
      await addDoc(collection(firestore, "condominios", condominioId, "anuncios"), {
        titulo: t,
        mensagem: m,
        createdAt: serverTimestamp(),
        createdByUid: session?.user?.uid ?? null,
      });
      setTitulo("");
      setMensagem("");
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao criar anúncio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout pageTitle="Anúncios">
      {/* Fundo premium da página (glass vibe) */}
      <div className="relative">
        <div className="absolute inset-0 -z-10">
          <div className="h-[260px] rounded-[36px] bg-gradient-to-r from-[#0b1220] via-[#050a14] to-[#070b12]" />
          <div className="absolute -top-16 left-10 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="absolute top-10 right-10 h-72 w-72 rounded-full bg-cyan-500/12 blur-3xl" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Coluna esquerda: criar anúncio */}
          <GlassCard className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-white">Criar anúncio</CardTitle>
              <CardDescription className="text-white/60">
                Publique avisos para os moradores do condomínio selecionado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CondominioSelect value={condominioId} onChange={onPickCondo} />

              <div className="space-y-2">
                <div className="text-xs font-medium text-white/70">Título</div>
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="h-11 rounded-2xl border-white/15 bg-white/10 text-white placeholder:text-white/35 backdrop-blur"
                  placeholder="Ex: Manutenção no elevador"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-white/70">Mensagem</div>
                <textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  className="min-h-[120px] w-full rounded-2xl border border-white/15 bg-white/10 p-3 text-sm text-white placeholder:text-white/35 backdrop-blur outline-none"
                  placeholder="Escreva o aviso completo..."
                />
              </div>

              {err && <div className="text-sm text-red-300">{err}</div>}

              <Button
                onClick={createAnuncio}
                disabled={saving || !condominioId}
                className="w-full rounded-2xl bg-emerald-500/80 hover:bg-emerald-500 text-white"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                {saving ? "Publicando..." : "Publicar anúncio"}
              </Button>

              {!condominioId && (
                <div className="text-xs text-white/45">
                  Selecione um condomínio para habilitar o cadastro de anúncios.
                </div>
              )}
            </CardContent>
          </GlassCard>

          {/* Coluna direita: lista */}
          <GlassCard className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-white">Últimos anúncios</CardTitle>
              <CardDescription className="text-white/60">
                {condominioId ? "Filtrado pelo condomínio ativo." : "Selecione um condomínio para ver os anúncios."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {loading && <div className="text-sm text-white/60">Carregando...</div>}

              {!loading && !condominioId && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                  Escolha um condomínio no painel ao lado.
                </div>
              )}

              {!loading && condominioId && anuncios.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                  Nenhum anúncio ainda. Publique o primeiro.
                </div>
              )}

              {!loading && anuncios.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
                >
                  <div className="text-base font-semibold text-white">{a.titulo}</div>
                  <div className="mt-1 text-sm text-white/70 whitespace-pre-wrap">{a.mensagem}</div>
                </div>
              ))}
            </CardContent>
          </GlassCard>
        </div>
      </div>
    </AppLayout>
  );
}
