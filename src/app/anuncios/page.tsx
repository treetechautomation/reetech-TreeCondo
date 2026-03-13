"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useSession } from "@/hooks/useSession";
import { initializeFirebase } from "@/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PlusCircle } from "lucide-react";

type BlocoOption = {
  id: string;
  nome: string;
};

type Anuncio = {
  id: string;
  titulo: string;
  mensagem: string;
  createdAt?: any;
  targetScope?: "CONDOMINIO" | "BLOCO";
  targetBlocoId?: string | null;
  targetBlocoNome?: string | null;
};

type BlocoItem = {
  id: string;
  nome: string;
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

function normalizeStr(v: any) {
  return String(v ?? "").trim();
}

function normalizeKey(v: any) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export default function AnunciosPage() {
  const { session, isSessionLoading } = useSession();
  const role = String(session?.role || "").toUpperCase();
  const canManageAnunciosByRole = ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(role);
  const canManageAnuncios = session?.menuPermissions?.anuncios === true || canManageAnunciosByRole;
  const condominioId = session?.activeCondominioId ?? null;
  const [condominioNome, setCondominioNome] = React.useState<string>("");
  const vinculoAtivo = React.useMemo(() => {
    return (session?.vinculos || []).find((v: any) => String(v?.condominioId || "") === String(condominioId || "")) ?? null;
  }, [session?.vinculos, condominioId]);
  const activeBlocoId = normalizeStr((vinculoAtivo as any)?.blocoId || "");
  const [blocos, setBlocos] = React.useState<BlocoOption[]>([]);
  const [targetScope, setTargetScope] = React.useState<"CONDOMINIO" | "BLOCO">("CONDOMINIO");
  const [targetBlocoId, setTargetBlocoId] = React.useState<string>("");

  const [anuncios, setAnuncios] = React.useState<Anuncio[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [titulo, setTitulo] = React.useState("");
  const [mensagem, setMensagem] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);



  React.useEffect(() => {
    let alive = true;

    async function loadCondominioNome() {
      if (!condominioId) {
        if (alive) setCondominioNome("");
        return;
      }

      try {
        const { firestore } = initializeFirebase();
        const snap = await getDoc(doc(firestore, "condominiosPublicos", condominioId));
        if (!alive) return;
        setCondominioNome(String((snap.data() || {})?.nome || condominioId));
      } catch (e) {
        console.error("[Anuncios] erro ao carregar nome do condomínio:", e);
        if (alive) setCondominioNome(condominioId);
      }
    }

    loadCondominioNome();

    return () => {
      alive = false;
    };
  }, [condominioId]);

  React.useEffect(() => {
    let alive = true;

    async function loadBlocos() {
      if (!condominioId) {
        if (alive) {
          setBlocos([]);
          setTargetBlocoId("");
          setTargetScope("CONDOMINIO");
        }
        return;
      }

      try {
        const { firestore } = initializeFirebase();
        const snap = await getDoc(doc(firestore, "condominios", condominioId));
        void snap;
      } catch {}

      try {
        const { firestore } = initializeFirebase();
        const membrosRef = collection(firestore, "condominios", condominioId, "membros");
        const unsub = onSnapshot(
          membrosRef,
          (snap) => {
            if (!alive) return;

            const map = new Map();

            snap.docs.forEach((d) => {
              const data = d.data() || {};
              const blocoId = normalizeStr(data?.blocoId || data?.bloco || "");
              const blocoNome = normalizeStr(data?.blocoNome || data?.blocoId || data?.bloco || "");
              const key = normalizeKey(blocoId || blocoNome);
              if (!key) return;

              if (["guarita", "a"].includes(key)) return;

              const id = blocoId || blocoNome;
              const nome = blocoNome || blocoId || id;
              if (!id) return;

              map.set(key, { id, nome });
            });

            const out = Array.from(map.values()).sort((a: any, b: any) =>
              String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
            );

            setBlocos(out);

            setTargetBlocoId((prev) => {
              if (prev && out.some((b: any) => String(b.id) === String(prev))) return prev;
              return "";
            });

            if (activeBlocoId && out.some((b: any) => normalizeKey(b.id) === normalizeKey(activeBlocoId))) {
              setTargetScope((prev) => prev || "BLOCO");
            }
          },
          (e) => {
            console.error("[Anuncios] erro ao carregar blocos:", e);
            if (!alive) return;
            setBlocos([]);
            setTargetBlocoId("");
          }
        );

        return () => unsub();
      } catch (e) {
        console.error("[Anuncios] erro ao preparar blocos:", e);
        if (alive) {
          setBlocos([]);
          setTargetBlocoId("");
        }
      }
    }

    const cleanupPromise = loadBlocos();

    return () => {
      alive = false;
      Promise.resolve(cleanupPromise).then((cleanup) => {
        if (typeof cleanup === "function") cleanup();
      }).catch(() => {});
    };
  }, [condominioId, activeBlocoId]);

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
        const raw: Anuncio[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        const list = canManageAnuncios
          ? raw
          : raw.filter((a: any) => {
              const scope = String(a?.targetScope || "CONDOMINIO").toUpperCase();
              if (scope !== "BLOCO") return true;
              return normalizeStr(a?.targetBlocoId || "") === activeBlocoId;
            });

        setAnuncios(list);
        setLoading(false);
      },
      (e) => {
        console.error(e);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [condominioId, canManageAnuncios, activeBlocoId]);

  async function createAnuncio() {
    if (!condominioId) return;
    if (!canManageAnuncios) {
      setErr("Sem permissão para criar anúncios.");
      return;
    }

    setErr(null);

    const t = titulo.trim();
    const m = mensagem.trim();
    if (!t || !m) {
      setErr("Preencha título e mensagem.");
      return;
    }

    if (targetScope === "BLOCO" && !targetBlocoId) {
      setErr("Selecione o bloco de destino.");
      return;
    }

    const blocoSel =
      targetScope === "BLOCO"
        ? blocos.find((b) => String(b.id) === String(targetBlocoId)) || null
        : null;

    setSaving(true);
    try {
      const { firestore } = initializeFirebase();
      await addDoc(collection(firestore, "condominios", condominioId, "anuncios"), {
        titulo: t,
        mensagem: m,
        createdAt: serverTimestamp(),
        createdByUid: session?.user?.uid ?? null,
        targetScope,
        targetBlocoId: blocoSel?.id ?? null,
        targetBlocoNome: blocoSel?.nome ?? null,
      });

      setTitulo("");
      setMensagem("");
      setTargetScope("CONDOMINIO");
      setTargetBlocoId((prev) => prev || blocos[0]?.id || "");
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao criar anúncio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout pageTitle="Anúncios">
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="h-[240px] rounded-[36px] bg-gradient-to-r from-emerald-200/35 via-cyan-200/25 to-emerald-100/30" />
          <div className="absolute -top-20 left-10 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute top-10 right-10 h-72 w-72 rounded-full bg-cyan-400/18 blur-3xl" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {canManageAnuncios ? (
            <GlassCard className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-slate-900">Criar anúncio</CardTitle>
                <CardDescription className="text-slate-600">
                  Publique avisos para os moradores do condomínio selecionado.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-black/5 bg-white/55 p-3 backdrop-blur-xl">
                  <div className="text-xs font-medium text-[#00d0e6]">Condomínio ativo</div>
                  <div className="mt-2 rounded-2xl border border-black/5 bg-white/70 px-4 py-3 text-slate-900">
                    {condominioNome || condominioId || "Nenhum condomínio ativo"}
                  </div>
                  <div className="mt-2 text-[11px] text-[#00d0e6]/70">
                    Em anúncios, o condomínio segue sempre o condomínio ativo da sessão.
                  </div>
                </div>


                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-700">Destino do anúncio</div>
                  <div className="grid gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={targetScope === "CONDOMINIO" ? "default" : "outline"}
                        onClick={() => {
                          setTargetScope("CONDOMINIO");
                          setTargetBlocoId("");
                        }}
                      >
                        Condomínio inteiro
                      </Button>
                      <Button
                        type="button"
                        variant={targetScope === "BLOCO" ? "default" : "outline"}
                        onClick={() => {
                          setTargetScope("BLOCO");
                          if (!targetBlocoId && activeBlocoId) setTargetBlocoId(activeBlocoId);
                        }}
                      >
                        Bloco específico
                      </Button>
                    </div>

                    {targetScope === "BLOCO" ? (
                      <div>
                        <select
                          className="h-11 w-full rounded-2xl border border-black/10 bg-white/70 px-3 text-sm text-slate-900 outline-none"
                          value={targetBlocoId}
                          onChange={(e) => setTargetBlocoId(e.target.value)}
                        >
                          <option value="">Selecione um bloco</option>
                          {blocos.map((b) => (
                            <option key={b.id} value={b.id}>{b.nome}</option>
                          ))}
                        </select>
                        <div className="mt-2 text-[11px] text-slate-500">
                          Blocos disponíveis para anúncios: {blocos.length ? blocos.map((b) => b.nome).join(" • ") : "nenhum"}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-black/5 bg-white/60 px-3 py-2 text-sm text-slate-700">
                        Este anúncio será enviado para todo o condomínio ativo.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-700">Título</div>
                  <Input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="h-11 rounded-2xl border-black/10 bg-white/70 text-slate-900 placeholder:text-slate-400 backdrop-blur"
                    placeholder="Ex: Manutenção no elevador"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-700">Mensagem</div>
                  <textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    className="min-h-[120px] w-full rounded-2xl border border-black/10 bg-white/70 p-3 text-sm text-slate-900 placeholder:text-slate-400 backdrop-blur outline-none"
                    placeholder="Escreva o aviso completo..."
                  />
                </div>

                {err && <div className="text-sm text-red-600">{err}</div>}

                <Button
                  onClick={createAnuncio}
                  disabled={saving || !condominioId || (targetScope === "BLOCO" && !targetBlocoId)}
                  className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {saving ? "Publicando..." : "Publicar anúncio"}
                </Button>

                {!condominioId && (
                  <div className="text-xs text-slate-500">
                    Selecione um condomínio para habilitar o cadastro de anúncios.
                  </div>
                )}
              </CardContent>
            </GlassCard>
          ) : (
            <div className="rounded-2xl border border-black/5 bg-white/50 p-4 text-sm text-slate-700">
              Você pode <b>ver</b> os anúncios, mas não tem permissão para <b>criar</b>. Fale com o síndico/administrador.
            </div>
          )}

          <GlassCard className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-slate-900">Últimos anúncios</CardTitle>
              <CardDescription className="text-slate-600">
                {condominioId ? "Filtrado pelo condomínio ativo." : "Selecione um condomínio para ver os anúncios."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {loading && <div className="text-sm text-slate-600">Carregando...</div>}

              {!loading && !condominioId && (
                <div className="rounded-2xl border border-black/5 bg-white/55 p-4 text-sm text-slate-600 backdrop-blur-xl">
                  Escolha um condomínio no painel ao lado.
                </div>
              )}

              {!loading && condominioId && anuncios.length === 0 && (
                <div className="rounded-2xl border border-black/5 bg-white/55 p-4 text-sm text-slate-600 backdrop-blur-xl">
                  Nenhum anúncio ainda.
                </div>
              )}

              {!loading &&
                anuncios.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-black/5 bg-white/55 p-4 backdrop-blur-xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-base font-semibold text-slate-900">{a.titulo}</div>
                      <div className="shrink-0 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs text-slate-600">
                        {String(a.targetScope || "CONDOMINIO").toUpperCase() === "BLOCO"
                          ? `Bloco: ${a.targetBlocoNome || a.targetBlocoId || "—"}`
                          : "Condomínio inteiro"}
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{a.mensagem}</div>
                  </div>
                ))}
            </CardContent>
          </GlassCard>
        </div>
      </div>
    </AppLayout>
  );
}
