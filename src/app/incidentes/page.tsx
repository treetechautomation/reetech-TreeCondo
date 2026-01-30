
"use client";

import * as React from "react";
import { PlusCircle, Paperclip, Send, Star, MessageSquare } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore, initializeFirebase } from "@/firebase";
import { collection, onSnapshot, orderBy, query, where, type DocumentData } from "firebase/firestore";
import { hasRole } from "@/lib/acl";
import { cn } from "@/lib/utils";

type Incidente = {
  id: string;
  titulo: string;
  descricao: string;
  tipo: "MANUTENCAO" | "RECLAMACAO" | "DUVIDA_SUGESTAO";
  status: "ABERTO" | "EM_ANDAMENTO" | "RESOLVIDO" | "FINALIZADO";
  criadoPorUid: string;
  criadoPorNome: string;
  createdAt: any;
  updatedAt: any;
  avaliacao?: number;
};

type Historico = {
  id: string;
  tipo: "SISTEMA" | "COMENTARIO";
  mensagem: string;
  autorUid?: string;
  autorNome?: string;
  createdAt: any;
};

function formatTimestamp(ts: any) {
  if (!ts?.toDate) return "data inválida";
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(ts.toDate());
}

async function apiPost(path: string, body: any) {
  const { auth } = initializeFirebase();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Usuário não autenticado");

  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro na requisição');
  }
  return data;
}

const IncidenteItem = ({ incidente, session }: { incidente: Incidente; session: any }) => {
  const [historico, setHistorico] = React.useState<Historico[]>([]);
  const [loadingHistorico, setLoadingHistorico] = React.useState(true);
  const [commentOpen, setCommentOpen] = React.useState(false);
  const [rateOpen, setRateOpen] = React.useState(false);

  const firestore = useFirestore();
  const condominioAtivoId = session?.activeCondominioId;

  const isOwner = session?.user?.uid === incidente.criadoPorUid;
  const isOperator = hasRole(session, ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "SINDICO", "PORTEIRO", "ZELADOR"]);
  const canRate = isOwner && (incidente.status === 'RESOLVIDO' || incidente.status === 'FINALIZADO') && !incidente.avaliacao;
  
  React.useEffect(() => {
    if (!firestore || !condominioAtivoId) return;
    const historicoRef = collection(firestore, `condominios/${condominioAtivoId}/incidentes/${incidente.id}/historico`);
    const q = query(historicoRef, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() } as Historico)));
      setLoadingHistorico(false);
    });
    return () => unsub();
  }, [firestore, condominioAtivoId, incidente.id]);

  return (
    <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{incidente.titulo}</CardTitle>
            <CardDescription>Aberto por {incidente.criadoPorNome} - {formatTimestamp(incidente.createdAt)}</CardDescription>
          </div>
          <Badge variant={incidente.tipo === 'MANUTENCAO' ? 'destructive' : incidente.tipo === 'RECLAMACAO' ? 'secondary' : 'default'}>
            {incidente.tipo.replace('_', '/')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{incidente.descricao}</p>
        <Separator className="my-4" />
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Histórico</h4>
          {loadingHistorico ? <p className="text-xs text-muted-foreground">Carregando histórico...</p> : (
            historico.map(h => (
              <p key={h.id} className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground">{h.autorNome}:</span> "{h.mensagem}" ({formatTimestamp(h.createdAt)})
              </p>
            ))
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-wrap gap-2 justify-between">
        <div className="flex items-center gap-2">
            <Badge variant={incidente.status === 'ABERTO' ? 'default' : 'outline'}>{incidente.status}</Badge>
            {isOperator && (
                <Select
                    value={incidente.status}
                    onValueChange={async (newStatus) => {
                        try {
                            await apiPost('/api/incidentes/status', { condominioId: condominioAtivoId, incidenteId: incidente.id, status: newStatus });
                        } catch (e: any) {
                            alert(e.message);
                        }
                    }}
                >
                    <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ABERTO">Aberto</SelectItem>
                        <SelectItem value="EM_ANDAMENTO">Em Andamento</SelectItem>
                        <SelectItem value="RESOLVIDO">Resolvido</SelectItem>
                        <SelectItem value="FINALIZADO">Finalizado</SelectItem>
                    </SelectContent>
                </Select>
            )}
        </div>
        <div className="flex items-center gap-2">
            {canRate ? <RateDialog incidente={incidente} /> : (incidente.avaliacao && 
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    Avaliação: {[...Array(5)].map((_, i) => <Star key={i} className={cn(i < incidente.avaliacao! ? "text-yellow-400 fill-yellow-400" : "", "h-4 w-4")} />)}
                </div>
            )}
            <CommentDialog incidente={incidente} />
        </div>
      </CardFooter>
    </Card>
  );
};

const CreateIncidenteDialog = () => {
    const { session } = useSessionCtx();
    const condominioAtivoId = session?.activeCondominioId;
    const [open, setOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [titulo, setTitulo] = React.useState("");
    const [descricao, setDescricao] = React.useState("");
    const [tipo, setTipo] = React.useState<Incidente['tipo'] | ''>('');

    const handleCreate = async () => {
        if (!condominioAtivoId || !titulo || !descricao || !tipo) {
            alert("Preencha todos os campos.");
            return;
        }
        setSaving(true);
        try {
            await apiPost('/api/incidentes/create', { condominioId: condominioAtivoId, titulo, descricao, tipo });
            setOpen(false);
            setTitulo(''); setDescricao(''); setTipo('');
        } catch (error: any) {
            alert(`Erro: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm"><PlusCircle /> <span className="hidden sm:inline-block ml-2">Abrir Chamado</span></Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Abrir Novo Chamado</DialogTitle>
                    <DialogDescription>Descreva o seu problema ou sugestão. O gestor será notificado.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="tipo" className="text-right">Tipo</Label>
                        <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                            <SelectTrigger className="col-span-3"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="RECLAMACAO">Reclamação</SelectItem>
                                <SelectItem value="MANUTENCAO">Manutenção</SelectItem>
                                <SelectItem value="DUVIDA_SUGESTAO">Dúvida/Sugestão</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="titulo" className="text-right">Título</Label>
                        <Input id="titulo" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Lâmpada queimada" className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="descricao" className="text-right">Descrição</Label>
                        <Textarea id="descricao" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhe o que está acontecendo." className="col-span-3" />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleCreate} disabled={saving}>{saving ? "Enviando..." : <><Send className="mr-2" /> Enviar Chamado</>}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const CommentDialog = ({ incidente }: { incidente: Incidente }) => {
    const { session } = useSessionCtx();
    const condominioAtivoId = session?.activeCondominioId;
    const [open, setOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [texto, setTexto] = React.useState("");

    const handleComment = async () => {
        if (!condominioAtivoId || !texto) return;
        setSaving(true);
        try {
            await apiPost('/api/incidentes/comment', { condominioId: condominioAtivoId, incidenteId: incidente.id, texto });
            setOpen(false);
            setTexto('');
        } catch (error: any) {
            alert(`Erro: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><MessageSquare className="mr-2" /> Comentar</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Adicionar Comentário</DialogTitle></DialogHeader>
                <Textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Digite seu comentário..." />
                <DialogFooter>
                    <Button onClick={handleComment} disabled={saving}>{saving ? 'Enviando...' : 'Enviar'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const RateDialog = ({ incidente }: { incidente: Incidente }) => {
    const { session } = useSessionCtx();
    const condominioAtivoId = session?.activeCondominioId;
    const [open, setOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [rating, setRating] = React.useState(0);

    const handleRate = async () => {
        if (!condominioAtivoId || rating === 0) return;
        setSaving(true);
        try {
            await apiPost('/api/incidentes/rate', { condominioId: condominioAtivoId, incidenteId: incidente.id, avaliacao: rating });
            setOpen(false);
        } catch (error: any) {
            alert(`Erro: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><Star className="mr-2" /> Avaliar</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Avaliar Atendimento</DialogTitle></DialogHeader>
                <div className="flex justify-center py-4">
                    {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} onClick={() => setRating(star)}>
                            <Star className={cn("h-8 w-8 text-gray-300", star <= rating && "text-yellow-400 fill-yellow-400")} />
                        </button>
                    ))}
                </div>
                <DialogFooter>
                    <Button onClick={handleRate} disabled={saving || rating === 0}>{saving ? 'Avaliando...' : 'Confirmar Avaliação'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function IncidentesPage() {
    const { session } = useSessionCtx();
    const firestore = useFirestore();
    const condominioAtivoId = session?.activeCondominioId;
    const [incidentes, setIncidentes] = React.useState<Incidente[]>([]);
    const [loading, setLoading] = React.useState(true);

    const isOperator = hasRole(session, ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "SINDICO", "PORTEIRO", "ZELADOR"]);

    React.useEffect(() => {
        if (!firestore || !condominioAtivoId) {
            setLoading(false);
            setIncidentes([]);
            return;
        }

        setLoading(true);
        const incidentesRef = collection(firestore, `condominios/${condominioAtivoId}/incidentes`);
        
        let q;
        if (isOperator) {
            q = query(incidentesRef, orderBy("updatedAt", "desc"));
        } else {
            q = query(incidentesRef, where("criadoPorUid", "==", session.user.uid), orderBy("updatedAt", "desc"));
        }

        const unsub = onSnapshot(q, (snap) => {
            setIncidentes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Incidente)));
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar incidentes:", error);
            setLoading(false);
        });

        return () => unsub();
    }, [firestore, condominioAtivoId, session?.user?.uid, isOperator]);

    if (!condominioAtivoId) {
        return (
            <AppLayout pageTitle="Chamados e Incidentes" headerActions={<CreateIncidenteDialog />}>
                <div className="text-center p-6 bg-card rounded-lg">
                    <p>Selecione um condomínio para ver os chamados.</p>
                </div>
            </AppLayout>
        );
    }
    
  return (
    <AppLayout pageTitle="Chamados e Incidentes" headerActions={<CreateIncidenteDialog />}>
        {loading ? <p>Carregando chamados...</p> : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {incidentes.length === 0 ? (
                    <p className="col-span-full text-center p-6">Nenhum chamado encontrado.</p>
                ) : (
                    incidentes.map(incidente => <IncidenteItem key={incidente.id} incidente={incidente} session={session} />)
                )}
            </div>
        )}
    </AppLayout>
  );
}
