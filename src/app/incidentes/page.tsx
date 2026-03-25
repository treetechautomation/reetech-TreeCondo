'use client';

import * as React from 'react';
import {
  PlusCircle,
  Paperclip,
  Send,
  Star,
  MessageSquare,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useSessionCtx } from '@/contexts/SessionContext';
import { useFirestore, initializeFirebase } from '@/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { hasRole } from '@/lib/acl';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCondominio } from '@/contexts/CondominioContext';

// ===== TreeCondo: cores por autor (Histórico) =====
const TC_AUTHOR_COLORS = [
  "#C8BFE7","#7092BE","#99D9EA","#B5E61D","#EFE4B0","#FFC90E",
  "#FFAEC9","#B97A57","#F5A173","#FF7F27","#00A2E8","#C3C3C3",
] as const;

function tcHash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function tcAuthorColor(key: string) {
  const idx = tcHash(key) % TC_AUTHOR_COLORS.length;
  return TC_AUTHOR_COLORS[idx];
}
// ===== /TreeCondo: cores por autor =====

type Incidente = {
  id: string;
  titulo: string;
  descricao: string;
  fotos?: string[];
  tipo: 'MANUTENCAO' | 'RECLAMACAO' | 'DUVIDA_SUGESTAO';
  status: 'ABERTO' | 'EM_ANDAMENTO' | 'RESOLVIDO' | 'FINALIZADO';
  criadoPorUid: string;
  criadoPorNome: string;
  createdAt: any;
  updatedAt: any;
  avaliacao?: number;
};

type Historico = {
  id: string;
  tipo: 'SISTEMA' | 'COMENTARIO';
  mensagem: string;
  autorUid?: string;
  autorNome?: string;
  createdAt: any;
};

function formatTimestamp(ts: any) {
  if (!ts?.toDate) return 'data inválida';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(ts.toDate());
}

async function uploadFoto(file: File, condominioId: string): Promise<string> {
  const { app } = initializeFirebase();
  const storage = getStorage(app);

  const fileName = Date.now() + "_" + file.name;
  const storageRef = ref(storage, `condominios/${condominioId}/incidentes/${fileName}`);

  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
}

async function apiPost(path: string, body: any) {
  const { auth } = initializeFirebase();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Usuário não autenticado');

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

const IncidenteItem = ({ incidente }: { incidente: Incidente }) => {
  const { session } = useSessionCtx();
  const firestore = useFirestore();
  const { condominioAtivoId } = useCondominio();

  const [historico, setHistorico] = React.useState<Historico[]>([]);
  const [loadingHistorico, setLoadingHistorico] = React.useState(true);

  const isOwner = session?.user?.uid === incidente.criadoPorUid;
  const isOperator = hasRole(session, [
    'SUPER_ADMIN',
    'ADMIN_CONDOMINIO',
    'ADMIN',
    'SINDICO',
    'PORTEIRO',
    'ZELADOR',
  ]);
  const canRate =
    isOwner && !isOperator && incidente.status === 'FINALIZADO' && !incidente.avaliacao;

  const statusConfig: Record<
    Incidente['status'],
    { label: string; className: string }
  > = {
    ABERTO: {
      label: 'Aberto',
      className:
        'border-transparent bg-blue-100 text-blue-800 hover:bg-blue-100',
    },
    EM_ANDAMENTO: {
      label: 'Em Andamento',
      className:
        'border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100',
    },
    RESOLVIDO: {
      label: 'Resolvido',
      className:
        'border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
    },
    FINALIZADO: {
      label: 'Finalizado',
      className:
        'border-transparent bg-slate-100 text-slate-700 hover:bg-slate-100',
    },
  };
  const isIncidenteStatus = (v: string): v is Incidente['status'] =>
    Object.prototype.hasOwnProperty.call(statusConfig, v);

  const [statusLocal, setStatusLocal] = React.useState<string>(incidente.status);
React.useEffect(() => {
  setStatusLocal(incidente.status);
}, [incidente.status]);

const currentStatusConfig = isIncidenteStatus(statusLocal)
  ? statusConfig[statusLocal]
  : {
      label: statusLocal.replace(/_/g, ' '),
      className: 'bg-gray-100 text-gray-800',
    };
React.useEffect(() => {
    if (!firestore || !condominioAtivoId) return;
    const historicoRef = collection(
      firestore,
      `condominios/${condominioAtivoId}/incidentes/${incidente.id}/historico`
    );
    const q = query(historicoRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setHistorico(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Historico))
      );
      setLoadingHistorico(false);
    });
    return () => unsub();
  }, [firestore, condominioAtivoId, incidente.id]);

  return (
    <Card className="border-white/20 bg-white/28 backdrop-blur-2xl shadow-[0_18px_55px_rgba(2,6,23,0.12)]">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg" style={{ color: "#F5EAB4" }}>{incidente.titulo}</CardTitle>
            <CardDescription style={{ color: "#C3C3C3" }}>
              Aberto por {incidente.criadoPorNome} -{' '}
              {formatTimestamp(incidente.createdAt)}
            </CardDescription>
          </div>
          <Badge
            variant={
              incidente.tipo === 'MANUTENCAO'
                ? 'destructive'
                : incidente.tipo === 'RECLAMACAO'
                ? 'secondary'
                : 'default'
            }
          >
            {incidente.tipo.replace('_', '/')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-[#FFFEE9]">{incidente.descricao}</p>
        
        {Array.isArray(incidente.fotos) && incidente.fotos.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {incidente.fotos.slice(0, 3).map((foto: string, i: number) => (
              <a
                key={i}
                href={foto}
                target="_blank"
                rel="noreferrer"
                className="block"
                title={`Abrir foto ${i + 1}`}
              >
                <img
                  src={foto}
                  alt={`Foto da ocorrência ${i + 1}`}
                  className="h-24 w-24 rounded-lg border object-cover shadow-sm transition hover:scale-[1.05]"
                />
              </a>
            ))}
          </div>
        )}

<Separator className="my-4 bg-white/25" />
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Histórico</h4>
          {loadingHistorico ? (
            <p className="text-xs text-muted-foreground">
              Carregando histórico...
            </p>
          ) : (
            historico.map((h) => {
              const authorKey = (h.autorUid || h.autorNome || "Sistema") as string;
              const authorName = (h.autorNome || "Sistema") as string;
              const isSystem = authorName.trim().toLowerCase() === "sistema";

              return (
                <p key={h.id} className="text-xs leading-relaxed text-foreground/80">
                  <span
                    className="font-semibold"
                    style={{ color: isSystem ? "#EFE4B0" : tcAuthorColor(authorKey) }}
                    title={authorKey}
                  >
                    {authorName}:
                  </span>{" "}
                  <span style={{ color: "#C3C3C3" }}>
                    "{h.mensagem}"
                  </span>{" "}
                  <span style={{ color: "#C3C3C3" }}>
                    ({formatTimestamp(h.createdAt)})
                  </span>
                </p>
              );
            })
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-wrap gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Badge className={currentStatusConfig.className}>
            {currentStatusConfig.label}
          </Badge>
          {isOperator && (
            <select
  value={statusLocal}
  onChange={async (e) => {
    const newStatus = e.target.value as Incidente['status'];
    try {
      await apiPost('/api/incidentes/status', {
        condominioId: condominioAtivoId,
        incidenteId: incidente.id,
        status: newStatus,
      });
    } catch (err: any) {
      alert(err?.message || 'Erro ao atualizar status');
    }
  }}
  className="h-8 w-[150px] rounded-md border border-input bg-white/90 px-2 text-xs text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/40"
>
  <option value="ABERTO">Aberto</option>
  <option value="EM_ANDAMENTO">Em Andamento</option>
  <option value="RESOLVIDO">Resolvido</option>
  <option value="FINALIZADO">Finalizado</option>
</select>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canRate ? (
            <RateDialog incidente={incidente} />
          ) : (
            incidente.avaliacao && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                Avaliação:{' '}
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-4 w-4',
                      i < incidente.avaliacao!
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300'
                    )}
                  />
                ))}
              </div>
            )
          )}
          {(isOwner || isOperator) && <CommentDialog incidente={incidente} />}
        </div>
      </CardFooter>
    </Card>
  );
};

const CreateIncidenteDialog = () => {
  const { session } = useSessionCtx();
  const { condominioAtivoId } = useCondominio();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
const [fotos, setFotos] = React.useState<string[]>([]);
  const [titulo, setTitulo] = React.useState('');
  const [descricao, setDescricao] = React.useState('');
  const [tipo, setTipo] = React.useState<Incidente['tipo'] | ''>('');

  
  

const handleCreate = async () => {
    if (!condominioAtivoId || !titulo || !descricao || !tipo) {
      alert('Preencha todos os campos.');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/api/incidentes/create', { fotos,
        condominioId: condominioAtivoId,
        titulo,
        descricao,
        tipo,
      });
      setOpen(false);
      setTitulo('');
      setDescricao('');
      setTipo('');
        setFotos([]);
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="text-black" size="sm" disabled={!condominioAtivoId}>
          <PlusCircle />{' '}
          <span className="hidden sm:inline-block ml-2">Abrir Chamado</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] tc-dialog-center">
        <DialogHeader>
          <DialogTitle>Abrir Novo Chamado</DialogTitle>
          <DialogDescription>
            Descreva o seu problema ou sugestão. O gestor será notificado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-start">
            <Label htmlFor="tipo" className="text-right">
              Tipo
            </Label>
            <select
                id="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as any)}
                className="col-span-3 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="" disabled>Selecione o tipo</option>
                <option value="RECLAMACAO">Reclamação</option>
                <option value="MANUTENCAO">Manutenção</option>
                <option value="DUVIDA_SUGESTAO">Dúvida/Sugestão</option>
              </select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="titulo" className="text-right">
              Título
            </Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Lâmpada queimada"
              className="col-span-3"
            />
          </div>
<div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-start">
              <Label htmlFor="descricao" className="text-left md:text-right md:pt-2">
                Descrição
              </Label>

              <div className="space-y-3 md:col-span-3">

                <label className="inline-flex w-full justify-center sm:w-auto cursor-pointer items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                  <span>📸 Adicionar fotos do problema</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      try {
                        const files = Array.from(e.target.files || []).slice(0, 3);
                        if (!files.length) return;

                        if (!condominioAtivoId) {
                          throw new Error("Condomínio ativo não encontrado.");
                        }

                        const urls: string[] = [];
                        for (const f of files) {
                          const url = await uploadFoto(f, condominioAtivoId);
                          urls.push(url);
                        }

                        setFotos((prev) => [...prev, ...urls].slice(0, 3));
                        e.target.value = "";
                      } catch (err) {
                        console.error(err);
                        alert("Erro ao enviar fotos.");
                      }
                    }}
                  />
                </label>

                <p className="text-xs leading-5 text-slate-500">
                  Adicione até 3 fotos para ajudar na análise da ocorrência.
                </p>

                {Array.isArray(fotos) && fotos.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {fotos.map((foto: string, i: number) => (
                        <div
                          key={i}
                          className="relative rounded-xl border border-black/10 bg-white p-2 shadow-sm"
                        >
                          <img
                            src={foto}
                            alt={`Foto da ocorrência ${i + 1}`}
                            className="h-24 w-24 rounded-lg border object-cover"
                          />

                          <button
                            type="button"
                            className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-white text-sm font-bold text-red-600 shadow hover:bg-red-50"
                            onClick={() =>
                              setFotos((prev: string[]) => prev.filter((_, idx) => idx !== i))
                            }
                            title="Excluir esta foto"
                            aria-label={`Excluir foto ${i + 1}`}
                          >
                            ×
                          </button>

                          <div className="mt-2 text-center text-[11px] text-slate-500">
                            Foto {i + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva com clareza o problema..."
                  className="min-h-[140px] w-full resize-y"
                />

                <p className="text-xs text-slate-500">
                  Ex: Vazamento na garagem, próximo à vaga 12.
                </p>

              </div>
            </div>
        </div>
        <DialogFooter>
          <Button className="text-black" onClick={handleCreate} disabled={saving}>
            {saving ? (
              'Enviando...'
            ) : (
              <>
                <Send className="mr-2" /> Enviar Chamado
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CommentDialog = ({ incidente }: { incidente: Incidente }) => {
  const { session } = useSessionCtx();
  const { condominioAtivoId } = useCondominio();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [texto, setTexto] = React.useState('');

  const handleComment = async () => {
    if (!condominioAtivoId || !texto) return;
    setSaving(true);
    try {
      await apiPost('/api/incidentes/comment', {
        condominioId: condominioAtivoId,
        incidenteId: incidente.id,
        texto,
      });
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
      <DialogTrigger asChild>
        <Button className="text-black" variant="outline" size="sm">
          <MessageSquare className="mr-2" /> Comentar
        </Button>
      </DialogTrigger>
      <DialogContent className="tc-dialog-center">
        <DialogHeader>
          <DialogTitle>Adicionar Comentário</DialogTitle>
          <DialogDescription>
            Adicione uma atualização ou resposta ao chamado "{incidente.titulo}".
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite seu comentário..."
        />
        <DialogFooter>
          <Button className="text-black" onClick={handleComment} disabled={saving}>
            {saving ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const RateDialog = ({ incidente }: { incidente: Incidente }) => {
  const { session } = useSessionCtx();
  const { condominioAtivoId } = useCondominio();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [rating, setRating] = React.useState(0);

  const handleRate = async () => {
    if (!condominioAtivoId || rating === 0) return;
    setSaving(true);
    try {
      await apiPost('/api/incidentes/rate', {
        condominioId: condominioAtivoId,
        incidenteId: incidente.id,
        avaliacao: rating,
      });
      setOpen(false);
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="text-black" variant="outline" size="sm">
          <Star className="mr-2" /> Avaliar
        </Button>
      </DialogTrigger>
      <DialogContent className="tc-dialog-center">
        <DialogHeader>
          <DialogTitle>Avaliar Atendimento</DialogTitle>
          <DialogDescription>
            Dê uma nota de 1 a 5 para o atendimento deste chamado.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} onClick={() => setRating(star)}>
              <Star
                className={cn(
                  'h-8 w-8 text-gray-300',
                  star <= rating && 'text-yellow-400 fill-yellow-400'
                )}
              />
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button className="text-black" onClick={handleRate} disabled={saving || rating === 0}>
            {saving ? 'Avaliando...' : 'Confirmar Avaliação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function IncidentesPage() {
  const { session } = useSessionCtx();
  const firestore = useFirestore();
  const { condominioAtivoId } = useCondominio();

  const [incidentes, setIncidentes] = React.useState<Incidente[]>([]);
  const [loading, setLoading] = React.useState(true);

  const isOperator = hasRole(session, [
    'SUPER_ADMIN',
    'ADMIN_CONDOMINIO',
    'ADMIN',
    'SINDICO',
    'PORTEIRO',
    'ZELADOR',
  ]);

  React.useEffect(() => {
    if (!firestore || !condominioAtivoId) {
      setLoading(false);
      setIncidentes([]);
      return;
    }

    if (!session?.user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const incidentesRef = collection(
      firestore,
      `condominios/${condominioAtivoId}/incidentes`
    );

    let q;
    if (isOperator) {
      q = query(incidentesRef, orderBy('updatedAt', 'desc'));
    } else {
      q = query(
        incidentesRef,
        where('criadoPorUid', '==', session.user.uid),
        orderBy('updatedAt', 'desc')
      );
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        setIncidentes(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Incidente))
        );
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao buscar incidentes:', error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, condominioAtivoId, session?.user?.uid, isOperator]);

  const incidentesAbertos = React.useMemo(
    () => incidentes.filter((inc) => inc.status !== 'FINALIZADO'),
    [incidentes]
  );

  const incidentesFinalizados = React.useMemo(
    () => incidentes.filter((inc) => inc.status === 'FINALIZADO'),
    [incidentes]
  );

  if (!condominioAtivoId) {
    return (
      <AppLayout
        pageTitle="Chamados e Incidentes"
        headerActions={<CreateIncidenteDialog />}
      >
        <div className="text-center p-6 bg-card rounded-lg">
          <p>Selecione um condomínio para ver os chamados.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      pageTitle="Chamados e Incidentes"
      headerActions={<CreateIncidenteDialog />}
    >
      <Tabs defaultValue="abertos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="abertos">Chamados Abertos</TabsTrigger>
          <TabsTrigger value="historico">Histórico (Finalizados)</TabsTrigger>
        </TabsList>

        <TabsContent value="abertos">
          {loading ? (
            <p>Carregando chamados...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {incidentesAbertos.length === 0 ? (
                <div className="col-span-full text-center p-6 border-white/20 bg-white/28 backdrop-blur-2xl shadow-[0_18px_55px_rgba(2,6,23,0.12)] rounded-2xl">
                  Nenhum chamado aberto encontrado.
                </div>
              ) : (
                incidentesAbertos.map((incidente) => (
                  <IncidenteItem key={incidente.id} incidente={incidente} />
                ))
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico">
          {loading ? (
            <p>Carregando histórico...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {incidentesFinalizados.length === 0 ? (
                <p className="col-span-full text-center p-6 border-white/20 bg-white/28 backdrop-blur-2xl shadow-[0_18px_55px_rgba(2,6,23,0.12)] rounded-2xl">
                  Nenhum chamado finalizado encontrado.
                </p>
              ) : (
                incidentesFinalizados.map((incidente) => (
                  <IncidenteItem key={incidente.id} incidente={incidente} />
                ))
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
