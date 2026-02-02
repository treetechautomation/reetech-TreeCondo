"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import { hasRole } from "@/lib/acl";

import {
  type Enquete,
  type EnqueteOpcao,
  type MeuVoto,
  listenEnquetes,
  listenOpcoes,
  listenMeuVoto,
  votar,
  criarEnquete,
  encerrarEnquete,
} from "@/services/enquetes";

function toDateMaybe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  return null;
}

function daysDiff(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 0, 0, 0, 0).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export default function EnquetesPage() {
  const firestore = useFirestore();
  const { session } = useSessionCtx();
  const { toast } = useToast();
  
  const condId = session?.activeCondominioId ?? null;
  const uid = session?.user?.uid ?? null;

  const canManage = hasRole(session, ["SUPER_ADMIN", "ADMIN", "SINDICO", "ADMIN_CONDOMINIO"]);

  const [enquetes, setEnquetes] = React.useState<Enquete[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [opcoesById, setOpcoesById] = React.useState<Record<string, EnqueteOpcao[]>>({});
  const [meuVotoById, setMeuVotoById] = React.useState<Record<string, MeuVoto | null>>({});

  // Dialog Nova Enquete
  const [openNew, setOpenNew] = React.useState(false);
  const [newTitulo, setNewTitulo] = React.useState("");
  const [newDescricao, setNewDescricao] = React.useState("");
  const [newTipo, setNewTipo] = React.useState<"VOTACAO" | "PESQUISA" | "COLETA_TEMAS">("VOTACAO");
  const [newOp1, setNewOp1] = React.useState("");
  const [newOp2, setNewOp2] = React.useState("");
  const [newOp3, setNewOp3] = React.useState("");

  React.useEffect(() => {
    if (!firestore || !condId) {
      setEnquetes([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsub = listenEnquetes(firestore, condId, (items) => {
      setEnquetes(items);
      setLoading(false);
    }, (e) => {
      console.error("[enquetes] erro:", e);
      toast({ variant: "destructive", title: "Erro ao carregar enquetes." });
      setEnquetes([]);
      setLoading(false);
    });

    return unsub;
  }, [firestore, condId, toast]);
  
  // listeners por enquete: opções + meu voto
  React.useEffect(() => {
    if (!firestore || !condId) return;

    const unsubs: Array<() => void> = [];
    const activeListeners = new Set<string>();

    const ids = new Set(enquetes.map(e => e.id));
    setOpcoesById(prev => {
        const next:any = {};
        Object.keys(prev).forEach(k => { if(ids.has(k)) next[k] = prev[k]; });
        return next;
    });
    setMeuVotoById(prev => {
        const next:any = {};
        Object.keys(prev).forEach(k => { if(ids.has(k)) next[k] = prev[k]; });
        return next;
    });

    for (const e of enquetes) {
      if (activeListeners.has(e.id)) continue;
      activeListeners.add(e.id);

      unsubs.push(
        listenOpcoes(firestore, condId, e.id, (ops) => {
          setOpcoesById(p => ({ ...p, [e.id]: ops }));
        })
      );
      
      if (uid) {
        unsubs.push(
          listenMeuVoto(firestore, condId, e.id, uid, (vote) => {
            setMeuVotoById(p => ({ ...p, [e.id]: vote }));
          })
        );
      }
    }

    return () => unsubs.forEach(fn => fn());
  }, [firestore, condId, uid, enquetes]);

  async function handleVotar(enqueteId: string, opcaoId: string) {
    if (!firestore || !condId || !uid) {
        toast({ variant: "destructive", title: "Sem sessão", description: "Você precisa estar logado." });
        return;
    }
    try {
      await votar(firestore, condId, enqueteId, uid, opcaoId);
      toast({ title: "Voto registrado!" });
    } catch(e: any) {
      toast({ variant: "destructive", title: "Erro ao votar", description: e?.message || String(e) });
    }
  }

  async function handleEncerrar(enqueteId: string) {
    if (!firestore || !condId) return;
    try {
        await encerrarEnquete(firestore, condId, enqueteId);
        toast({ title: "Enquete encerrada." });
    } catch(e: any) {
        toast({ variant: "destructive", title: "Erro ao encerrar", description: e?.message || String(e) });
    }
  }

  async function handleCriarEnquete() {
      if (!firestore || !condId) return;
      
      const titulo = newTitulo.trim();
      if (titulo.length < 3) {
          toast({ variant: "destructive", title: "Título inválido" });
          return;
      }
      
      const opcoes = [
          { titulo: newOp1.trim() },
          { titulo: newOp2.trim() },
          { titulo: newOp3.trim() },
      ].filter(o => o.titulo.length > 0);

      if (newTipo === "VOTACAO" && opcoes.length < 2) {
          toast({ variant: "destructive", title: "Coloque pelo menos 2 opções de voto." });
          return;
      }
      
      try {
          await criarEnquete(firestore, condId, {
              titulo,
              descricao: newDescricao.trim(),
              tipo: newTipo,
              encerraEm: null,
              createdByUid: uid || undefined,
              opcoes,
          });

          setOpenNew(false);
          setNewTitulo("");
          setNewDescricao("");
          setNewTipo("VOTACAO");
          setNewOp1("");
          setNewOp2("");
          setNewOp3("");

          toast({ title: "Enquete criada com sucesso!" });
      } catch (e: any) {
          toast({ variant: "destructive", title: "Erro ao criar enquete", description: e?.message || String(e) });
      }
  }

  return (
    <AppLayout pageTitle="Enquetes e Votações" headerActions={
      canManage && (
        <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
                <Button>+ Nova Enquete</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Nova Enquete / Votação</DialogTitle>
                    <DialogDescription>
                        Crie uma nova pesquisa ou votação para os moradores.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label className="text-sm font-medium mb-1">Título</Label>
                        <Input value={newTitulo} onChange={(e) => setNewTitulo(e.target.value)} placeholder="Ex: Nova pintura para a fachada"/>
                    </div>

                    <div>
                        <Label className="text-sm font-medium mb-1">Descrição (opcional)</Label>
                        <Textarea value={newDescricao} onChange={(e) => setNewDescricao(e.target.value)} placeholder="Explique o objetivo da enquete ou votação."/>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                        <Button type="button" variant={newTipo === "VOTACAO" ? "default" : "outline"} onClick={() => setNewTipo("VOTACAO")}>Votação</Button>
                        <Button type="button" variant={newTipo === "PESQUISA" ? "default" : "outline"} onClick={() => setNewTipo("PESQUISA")}>Pesquisa</Button>
                        <Button type="button" variant={newTipo === "COLETA_TEMAS" ? "default" : "outline"} onClick={() => setNewTipo("COLETA_TEMAS")}>Coleta de temas</Button>
                    </div>

                    {newTipo === "VOTACAO" && (
                        <div className="space-y-2 rounded-md border p-4">
                            <Label className="text-sm font-medium">Opções de Voto</Label>
                            <Input value={newOp1} onChange={(e) => setNewOp1(e.target.value)} placeholder="Opção 1 (obrigatório)" />
                            <Input value={newOp2} onChange={(e) => setNewOp2(e.target.value)} placeholder="Opção 2 (obrigatório)" />
                            <Input value={newOp3} onChange={(e) => setNewOp3(e.target.value)} placeholder="Opção 3 (opcional)" />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
                    <Button onClick={handleCriarEnquete}>Criar Enquete</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )
    }>
        {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : enquetes.length === 0 ? (
            <div className="text-center py-8">
                <p className="text-muted-foreground">Nenhuma enquete ou votação encontrada para este condomínio.</p>
                {canManage && <Button onClick={() => setOpenNew(true)} className="mt-4">Criar primeira enquete</Button>}
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {enquetes.map((poll) => {
                    const opcoes = opcoesById[poll.id] || [];
                    const meuVoto = meuVotoById[poll.id] || null;

                    const totalVotes = Number(poll.totalVotos || 0);
                    const encerraEm = toDateMaybe(poll.encerraEm);
                    const status = String(poll.status || "").toUpperCase();

                    let footerText = "";
                    if (encerraEm) {
                        const diff = daysDiff(new Date(), encerraEm);
                        if (diff > 0) footerText = `Encerra em ${diff} dia${diff === 1 ? '' : 's'}`;
                        else if (diff === 0) footerText = "Encerra hoje";
                        else footerText = `Encerrada há ${Math.abs(diff)} dia${Math.abs(diff) === 1 ? '' : 's'}`;
                    } else {
                        footerText = status === "ENCERRADA" ? "Encerrada" : "Aberta";
                    }

                    const canVote = status === "ABERTA" && !!uid && !meuVoto && poll.tipo === "VOTACAO";
                    const showResults = poll.tipo === "VOTACAO";

                    return (
                        <Card key={poll.id} className="overflow-hidden flex flex-col">
                            <CardHeader className="space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <CardTitle className="truncate">{poll.titulo}</CardTitle>
                                        <CardDescription className="truncate">{poll.tipo === "VOTACAO" ? "Votação oficial" : poll.tipo}</CardDescription>
                                    </div>
                                    <Badge variant={status === "ABERTA" ? "default" : "secondary"}>
                                        {status === "ABERTA" ? "Aberta" : "Encerrada"}
                                    </Badge>
                                </div>
                                
                                {poll.descricao ? <p className="text-sm text-muted-foreground">{poll.descricao}</p> : null}
                            </CardHeader>
                            <CardContent className="space-y-4 flex-1">
                                {showResults && opcoes.length > 0 ? (
                                    <div className="space-y-4">
                                        {opcoes.map((option) => {
                                            const votes = Number(option.votos || 0);
                                            const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                                            
                                            return (
                                                <div key={option.id} className="space-y-1">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="font-medium">{option.titulo}</span>
                                                        <span className="text-muted-foreground">{Math.round(percentage)}% ({votes} voto{votes === 1 ? "" : "s"})</span>
                                                    </div>
                                                    <Progress value={percentage} />
                                                    {canVote && (
                                                        <div className="pt-2">
                                                            <Button size="sm" variant="outline" onClick={() => handleVotar(poll.id, option.id)}>Votar</Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        {poll.tipo === "VOTACAO" ? "Sem opções ainda." : "Esse tipo de enquete não possui opções de voto."}
                                    </p>
                                )}
                            </CardContent>
                            <CardFooter className="flex-col items-start gap-3 pt-4">
                                <div className="flex items-center justify-between w-full">
                                    <span className="text-sm text-muted-foreground">{footerText}</span>

                                    <div className="flex items-center gap-2">
                                        {canManage && status === "ABERTA" && (
                                            <Button size="sm" variant="outline" onClick={() => handleEncerrar(poll.id)}>Encerrar</Button>
                                        )}
                                    </div>
                                </div>
                                {meuVoto && poll.tipo === 'VOTACAO' && (
                                    <p className="text-xs text-muted-foreground">
                                      Você já votou nesta enquete.
                                    </p>
                                )}
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        )}
    </AppLayout>
  );
}
