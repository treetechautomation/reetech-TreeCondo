"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, TcPill } from "@/components/ui/tc-badges";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  increment,
  type Firestore,
} from "firebase/firestore";

type Enquete = {
  id: string;
  titulo: string;
  descricao?: string;
  status: "ABERTA" | "ENCERRADA";
  totalVotes?: number;
  createdAt?: any;
  updatedAt?: any;
  createdByUid?: string;
  createdByNome?: string;
};

type Opcao = {
  id: string;
  texto: string;
  votes?: number;
  order?: number;
};

function isOperator(role?: string | null) {
  const r = String(role || "").toUpperCase();
  return ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"].includes(r);
}

export default function EnquetesPage() {
  const firestore = useFirestore();
  const { session } = useSessionCtx();
  const { toast } = useToast();

  const condominioId = session?.activeCondominioId ?? null;
  const uid = session?.user?.uid ?? null;
  const role = session?.role ?? null;

  const canManage = isOperator(role);

  const [loading, setLoading] = React.useState(true);
  const [enquetes, setEnquetes] = React.useState<Enquete[]>([]);
  const [opcoesByEnquete, setOpcoesByEnquete] = React.useState<Record<string, Opcao[]>>({});
  const [myVoteByEnquete, setMyVoteByEnquete] = React.useState<Record<string, string | null>>({});

  // dialog nova enquete
  const [openNew, setOpenNew] = React.useState(false);
  const [titulo, setTitulo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [opcoes, setOpcoes] = React.useState<string[]>(["", ""]);

  // ========= LISTA ENQUETES =========
  React.useEffect(() => {
    if (!firestore || !condominioId) {
      setEnquetes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const ref = collection(firestore, `condominios/${condominioId}/enquetes`);
    const qy = query(ref, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Enquete[];
        setEnquetes(list);
        setLoading(false);
      },
      (err) => {
        console.error("[enquetes] erro onSnapshot:", err);
        setEnquetes([]);
        setLoading(false);
      }
    );

    return unsub;
  }, [firestore, condominioId]);

  // ========= OPTIONS + MEU VOTO (listeners por enquete) =========
  React.useEffect(() => {
    if (!firestore || !condominioId) {
      setOpcoesByEnquete({});
      setMyVoteByEnquete({});
      return;
    }

    const unsubs: Array<() => void> = [];

    // limpa estados quando lista muda muito
    // (mantém o que tiver id igual)
    setOpcoesByEnquete((prev) => {
      const next: Record<string, Opcao[]> = {};
      for (const e of enquetes) next[e.id] = prev[e.id] || [];
      return next;
    });

    setMyVoteByEnquete((prev) => {
      const next: Record<string, string | null> = {};
      for (const e of enquetes) next[e.id] = prev[e.id] ?? null;
      return next;
    });

    for (const e of enquetes) {
      // opções
      const opRef = collection(firestore, `condominios/${condominioId}/enquetes/${e.id}/opcoes`);
      const opQ = query(opRef, orderBy("order", "asc"));
      unsubs.push(
        onSnapshot(opQ, (snap) => {
          const ops = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Opcao[];
          setOpcoesByEnquete((prev) => ({ ...prev, [e.id]: ops }));
        })
      );

      // meu voto
      if (uid) {
        const vRef = doc(firestore, `condominios/${condominioId}/enquetes/${e.id}/votos/${uid}`);
        unsubs.push(
          onSnapshot(vRef, (snap) => {
            const voted = snap.exists() ? (snap.data() as any)?.opcaoId : null;
            setMyVoteByEnquete((prev) => ({ ...prev, [e.id]: voted || null }));
          })
        );
      }
    }

    return () => {
      for (const u of unsubs) {
        try { u(); } catch {}
      }
    };
  }, [firestore, condominioId, uid, enquetes]);

  // ========= CRIAR ENQUETE =========
  async function handleCreateEnquete() {
    if (!firestore || !condominioId || !uid) return;

    const tituloOk = titulo.trim();
    const descricaoOk = descricao.trim();
    const ops = opcoes.map((s) => s.trim()).filter(Boolean);

    if (!tituloOk) {
      toast({ variant: "destructive", title: "Título obrigatório" });
      return;
    }
    if (ops.length < 2) {
      toast({ variant: "destructive", title: "Coloque pelo menos 2 opções" });
      return;
    }
    if (!canManage) {
      toast({ variant: "destructive", title: "Sem permissão para criar enquete" });
      return;
    }

    try {
      const enqueteRef = await addDoc(collection(firestore, `condominios/${condominioId}/enquetes`), {
        titulo: tituloOk,
        descricao: descricaoOk || "",
        status: "ABERTA",
        totalVotes: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByUid: uid,
                createdByNome: ((session as any)?.user?.nome || (session as any)?.user?.displayName || session?.user?.email || ""),
        allowMultiple: false,
      });

      // cria opções
      const base = collection(firestore, `condominios/${condominioId}/enquetes/${enqueteRef.id}/opcoes`);
      await Promise.all(
        ops.map((texto, idx) =>
          addDoc(base, { texto, votes: 0, order: idx })
        )
      );

      toast({ title: "Enquete criada!" });
      setOpenNew(false);
      setTitulo("");
      setDescricao("");
      setOpcoes(["", ""]);
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Erro ao criar enquete", description: e?.message || String(e) });
    }
  }

  // ========= VOTAR (TRANSACTION / VOTO ÚNICO) =========
  async function handleVotar(enqueteId: string, opcaoId: string) {
    if (!firestore || !condominioId || !uid) return;

    try {
      await runTransaction(firestore, async (tx) => {
        const votoRef = doc(firestore, `condominios/${condominioId}/enquetes/${enqueteId}/votos/${uid}`);
        const enqueteRef = doc(firestore, `condominios/${condominioId}/enquetes/${enqueteId}`);
        const opcaoRef = doc(firestore, `condominios/${condominioId}/enquetes/${enqueteId}/opcoes/${opcaoId}`);

        const votoSnap = await tx.get(votoRef);
        if (votoSnap.exists()) {
          throw new Error("Você já votou nesta enquete.");
        }

        const enqueteSnap = await tx.get(enqueteRef);
        if (!enqueteSnap.exists()) throw new Error("Enquete não encontrada.");
        const enquete = enqueteSnap.data() as any;
        if (String(enquete?.status || "").toUpperCase() !== "ABERTA") {
          throw new Error("Esta enquete está encerrada.");
        }

        const opcaoSnap = await tx.get(opcaoRef);
        if (!opcaoSnap.exists()) throw new Error("Opção inválida.");

        tx.set(votoRef, { opcaoId, createdAt: serverTimestamp() });
        tx.update(opcaoRef, { votes: increment(1) });
        tx.update(enqueteRef, { totalVotes: increment(1), updatedAt: serverTimestamp() });
      });

      toast({ title: "Voto registrado!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Não foi possível votar", description: e?.message || String(e) });
    }
  }

  // ========= ENCERRAR =========
  async function handleEncerrar(enqueteId: string) {
    if (!firestore || !condominioId) return;
    if (!canManage) {
      toast({ variant: "destructive", title: "Sem permissão" });
      return;
    }
    try {
      await updateDoc(doc(firestore, `condominios/${condominioId}/enquetes/${enqueteId}`), {
        status: "ENCERRADA",
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Enquete encerrada." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao encerrar", description: e?.message || String(e) });
    }
  }

  return (
    <AppLayout pageTitle="Enquetes e Votações" headerActions={
      canManage ? (
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button>Nova Enquete</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[650px] tc-dialog-center">
            <DialogHeader>
              <DialogTitle>Nova Enquete</DialogTitle>
              <DialogDescription>Crie uma enquete para os moradores votarem.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="titulo">Título</Label>
                <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Reforma da portaria" />
              </div>

              <div className="space-y-1">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes da votação..." />
              </div>

              <div className="space-y-2">
                <Label>Opções</Label>
                <div className="grid gap-2">
                  {opcoes.map((v, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={v}
                        onChange={(e) => {
                          const next = [...opcoes];
                          next[idx] = e.target.value;
                          setOpcoes(next);
                        }}
                        placeholder={`Opção ${idx + 1}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpcoes((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={opcoes.length <= 2}
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="secondary" onClick={() => setOpcoes((prev) => [...prev, ""])}>
                    + Adicionar opção
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleCreateEnquete}>Salvar Enquete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null
    }>
      <Card className="border-white/20 bg-white/28 backdrop-blur-2xl shadow-[0_18px_55px_rgba(2,6,23,0.12)]">
        <CardHeader>
          <CardTitle className="text-white">Enquetes</CardTitle>
          <CardDescription className="text-white/75">Votações do condomínio (dados em tempo real).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-white/70">Carregando...</p>
          ) : enquetes.length === 0 ? (
            <p className="text-sm text-white/70">Nenhuma enquete criada ainda.</p>
          ) : (
            <div className="grid gap-4">
              {enquetes.map((poll) => {
                const ops = opcoesByEnquete[poll.id] || [];
                const totalVotes = Number(poll.totalVotes || 0);
                const myVote = myVoteByEnquete[poll.id] || null;
                const aberta = poll.status === "ABERTA";

                return (
                  <Card key={poll.id} className="rounded-2xl border-white/20 bg-white/28 backdrop-blur-2xl shadow-[0_18px_55px_rgba(2,6,23,0.12)] w-full overflow-hidden">
                    <CardHeader className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-white text-lg sm:text-xl leading-tight break-words">{poll.titulo}</CardTitle>
                        {poll.descricao ? (
                          <CardDescription className="mt-1 text-white/75 text-sm leading-snug break-words">{poll.descricao}</CardDescription>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <StatusBadge status={poll.status} />
                          <Badge variant="outline" className="text-white/90 border-white/25">{totalVotes} voto(s)</Badge>
                          {myVote ? <Badge variant="secondary">Você já votou</Badge> : null}
                        </div>
                      </div>

                      {canManage ? (
                        <div className="flex gap-2">
                          {aberta ? (
                            <Button variant="outline" onClick={() => handleEncerrar(poll.id)}>
                              Encerrar
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </CardHeader>

                    <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
                      {ops.length === 0 ? (
                        <p className="text-sm text-white/70">Carregando opções...</p>
                      ) : (
                        ops.map((option) => {
                          const votes = Number(option.votes || 0);
                          const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                          const votedThis = myVote === option.id;

                          return (
                            <div key={option.id} className="rounded-xl border border-white/15 p-3 sm:p-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium text-white leading-snug break-words">
                                    {option.texto} {votedThis ? "✅" : ""}
                                  </p>
                                  <p className="text-xs text-white/80 mt-1">
                                    {Math.round(percentage)}% ({votes} voto(s))
                                  </p>
                                </div>

                                {aberta ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleVotar(poll.id, option.id)}
                                    disabled={!!myVote}
                                  >
                                    Votar
                                  </Button>
                                ) : null}
                              </div>

                              <div className="mt-2">
                                <Progress value={percentage} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
