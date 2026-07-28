"use client";

import * as React from "react";
import {
  collection,
  addDoc,
  setDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from "firebase/firestore";

import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { useSessionCtx } from "@/contexts/SessionContext";
import { 
  Clock, 
  Film, 
  Megaphone, 
  Play, 
  Trash2, 
  Edit,
  ArrowUp, 
  ArrowDown, 
  Plus,
  AlertTriangle
} from "lucide-react";

type CampanhaItem = {
  campanhaId: string;
  titulo: string;
  tipo: string;
  duracaoSegundos: number;
  prioridade: number;
  ordem: number;
  imagemUrl: string | null;
};

type Playlist = {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  campanhas: CampanhaItem[];
  totalCampanhas: number;
  duracaoTotalSegundos: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type CampanhaDisponivel = {
  id: string;
  titulo: string;
  tipo: string;
  imagemUrl: string | null;
  duracaoSegundos: number;
  prioridade: number;
  ativo: boolean;
};

const getDuracaoPadrao = (tipo: string): number => {
  const t = (tipo || "").toLowerCase();
  switch (t) {
    case "comunicado":
    case "aviso":
    case "evento":
      return 20;
    case "saude":
    case "financas":
      return 15;
    case "voce_sabia":
    case "noticia":
      return 12;
    case "anuncio":
      return 10;
    default:
      return 15;
  }
};

export default function PlaylistsPage() {
  const firestore = useFirestore();
  const { session, isSessionLoading } = useSessionCtx();
  const { toast } = useToast();

  const [playlists, setPlaylists] = React.useState<Playlist[]>([]);
  const [campanhasDisponiveis, setCampanhasDisponiveis] = React.useState<CampanhaDisponivel[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [current, setCurrent] = React.useState<Playlist | null>(null);

  // Form states
  const [nome, setNome] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [ativo, setAtivo] = React.useState(true);
  const [campanhasSelecionadas, setCampanhasSelecionadas] = React.useState<CampanhaItem[]>([]);

  const condominioAtivoId = session?.activeCondominioId || null;

  // Permissões de acesso
  const isAllowed = React.useMemo(() => {
    if (!session) return false;
    const allowedRoles = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];
    return allowedRoles.includes(session.role);
  }, [session]);

  // Load playlists
  React.useEffect(() => {
    if (!firestore || !condominioAtivoId || !isAllowed) {
      setPlaylists([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = collection(firestore, `condominios/${condominioAtivoId}/treemidia_playlists`);
    const q = query(ref, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() } as Playlist)));
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast({ variant: "destructive", title: "Erro ao carregar playlists." });
      setLoading(false);
    });
    return unsub;
  }, [firestore, condominioAtivoId, isAllowed, toast]);

  // Load available campaigns
  React.useEffect(() => {
    if (!firestore || !condominioAtivoId || !isAllowed) {
      setCampanhasDisponiveis([]);
      return;
    }
    const ref = collection(firestore, `condominios/${condominioAtivoId}/treemidia_campanhas`);
    const q = query(ref, orderBy("titulo", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setCampanhasDisponiveis(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as CampanhaDisponivel))
          .filter(c => c.ativo) // Only active campaigns can be added to playlists
      );
    }, (err) => {
      console.error(err);
    });
    return unsub;
  }, [firestore, condominioAtivoId, isAllowed]);

  const openDialog = (item: Playlist | null) => {
    setCurrent(item);
    setNome(item?.nome ?? "");
    setDescricao(item?.descricao ?? "");
    setAtivo(item?.ativo ?? true);
    setCampanhasSelecionadas(item?.campanhas ?? []);
    setOpen(true);
  };

  // Selection actions
  const addCampanha = (camp: CampanhaDisponivel) => {
    const nextOrdem = campanhasSelecionadas.length;
    const newItem: CampanhaItem = {
      campanhaId: camp.id,
      titulo: camp.titulo,
      tipo: camp.tipo,
      duracaoSegundos: camp.duracaoSegundos,
      prioridade: camp.prioridade,
      ordem: nextOrdem,
      imagemUrl: camp.imagemUrl,
    };
    setCampanhasSelecionadas([...campanhasSelecionadas, newItem]);
  };

  const removeCampanha = (idxToRemove: number) => {
    const list = campanhasSelecionadas
      .filter((_, idx) => idx !== idxToRemove)
      .map((item, idx) => ({ ...item, ordem: idx }));
    setCampanhasSelecionadas(list);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const list = [...campanhasSelecionadas];
    // swap
    const temp = list[idx - 1];
    list[idx - 1] = { ...list[idx], ordem: idx - 1 };
    list[idx] = { ...temp, ordem: idx };
    setCampanhasSelecionadas(list);
  };

  const moveDown = (idx: number) => {
    if (idx === campanhasSelecionadas.length - 1) return;
    const list = [...campanhasSelecionadas];
    // swap
    const temp = list[idx + 1];
    list[idx + 1] = { ...list[idx], ordem: idx + 1 };
    list[idx] = { ...temp, ordem: idx };
    setCampanhasSelecionadas(list);
  };

  // Calculated properties
  const duracaoTotal = React.useMemo(() => {
    return campaignsDuration(campanhasSelecionadas);
  }, [campanhasSelecionadas]);

  function campaignsDuration(list: CampanhaItem[]) {
    return list.reduce((sum, c) => {
      const durManual = c.duracaoSegundos;
      const durFinal = (typeof durManual === "number" && durManual > 0)
        ? durManual
        : getDuracaoPadrao(c.tipo);
      return sum + durFinal;
    }, 0);
  }

  const handleSave = async () => {
    if (!firestore || !condominioAtivoId) return;
    if (!nome.trim() || !descricao.trim()) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Nome e descrição são obrigatórios.",
      });
      return;
    }

    if (campanhasSelecionadas.length === 0) {
      toast({
        variant: "destructive",
        title: "Playlist vazia",
        description: "Adicione pelo menos uma campanha à playlist.",
      });
      return;
    }

    setSaving(true);
    try {
      const collectionRef = collection(firestore, `condominios/${condominioAtivoId}/treemidia_playlists`);
      const payload = {
        nome,
        descricao,
        ativo,
        campanhas: campanhasSelecionadas,
        totalCampanhas: campanhasSelecionadas.length,
        duracaoTotalSegundos: duracaoTotal,
        updatedAt: serverTimestamp(),
      };

      if (current) {
        const docRef = doc(collectionRef, current.id);
        await updateDoc(docRef, payload);
        toast({ title: "Playlist atualizada com sucesso!" });
      } else {
        await addDoc(collectionRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Playlist criada com sucesso!" });
      }
      setOpen(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: e.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore || !condominioAtivoId) return;
    if (!confirm("Tem certeza que deseja remover esta playlist?")) return;
    try {
      await deleteDoc(doc(firestore, `condominios/${condominioAtivoId}/treemidia_playlists`, id));
      toast({ title: "Playlist excluída." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: e.message,
      });
    }
  };

  if (isSessionLoading) {
    return (
      <AppLayout pageTitle="Mídia — Playlists e Programação">
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-slate-600 dark:text-slate-300">Carregando sessão...</p>
        </div>
      </AppLayout>
    );
  }

  if (!isAllowed) {
    return (
      <AppLayout pageTitle="Mídia — Acesso Restrito">
        <Card className="border-white/20 bg-white/20 backdrop-blur-2xl shadow-lg text-white">
          <CardHeader>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription className="text-white/70">
              Esta área é exclusiva para gestores e administradores do condomínio.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-white/80">
            Caso precise gerenciar playlists da TreeMídia, solicite permissão ao administrador do condomínio.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      pageTitle="Mídia — Playlists e Programação"
      headerActions={
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold rounded-xl"
          onClick={() => openDialog(null)}
        >
          Nova Playlist
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Playlist List Card */}
        <Card className="border-white/20 bg-white/20 backdrop-blur-2xl shadow-[0_18px_55px_rgba(2,6,23,0.14)] text-white">
          <CardHeader>
            <CardTitle className="text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.30)]">Playlists Ativas</CardTitle>
            <CardDescription className="text-white/70">
              Gerencie a programação de campanhas que rodam em loop nas telas conectadas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!condominioAtivoId ? (
              <p className="text-white/75">Selecione um condomínio para visualizar.</p>
            ) : loading ? (
              <p className="text-white/75">Carregando...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {playlists.length === 0 ? (
                  <div className="col-span-full text-center text-white/75 py-12 bg-white/5 rounded-2xl border border-white/10">
                    Nenhuma playlist cadastrada neste condomínio.
                  </div>
                ) : (
                  playlists.map((item) => (
                    <Card key={item.id} className="border-white/10 bg-white/5 backdrop-blur-md text-white shadow-xl rounded-2xl hover:bg-white/[0.08] transition duration-200 flex flex-col justify-between overflow-hidden">
                      <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-xl font-bold text-[#00beea]">{item.nome}</CardTitle>
                          <CardDescription className="text-white/60 text-xs">{item.descricao}</CardDescription>
                        </div>
                        {item.ativo ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                            🟢 Ativa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-white/10 border border-white/20 text-white/60 text-xs px-2.5 py-0.5 rounded-full font-bold">
                            ⚪ Inativa
                          </span>
                        )}
                      </CardHeader>
                      <CardContent className="py-4 space-y-5 flex-1 flex flex-col justify-between">
                        {/* Alerta de limite de campanhas para elevador */}
                        {item.campanhas && item.campanhas.length > 5 && (
                          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-400">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>Recomendamos até 5 campanhas para telas de elevador.</span>
                          </div>
                        )}

                        {/* Timeline representation */}
                        <div className="space-y-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">Linha do Tempo de Exibição</span>
                          <div className="relative pl-5 border-l-2 border-[#00beea]/30 space-y-4 py-1 ml-1.5">
                            {item.campanhas && item.campanhas.length > 0 ? (
                              item.campanhas.map((camp, idx) => {
                                const durFinal = (typeof camp.duracaoSegundos === "number" && camp.duracaoSegundos > 0)
                                  ? camp.duracaoSegundos
                                  : getDuracaoPadrao(camp.tipo);
                                return (
                                  <div key={idx} className="relative flex items-center justify-between text-xs">
                                    {/* Dot on line */}
                                    <span className="absolute -left-[26.5px] w-2.5 h-2.5 bg-[#00beea] rounded-full border-2 border-slate-950 shadow-sm" />
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-extrabold text-[#00beea]/60">{idx + 1}.</span>
                                      <span className="font-semibold text-white truncate max-w-[180px]">{camp.titulo}</span>
                                    </div>
                                    <span className="text-white/50 text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/10 font-mono">
                                      {durFinal}s
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <span className="text-xs text-white/40 block">Nenhuma campanha vinculada a esta playlist.</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          {/* Metrics Row */}
                          <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-4 text-xs font-semibold">
                            <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                              <span className="text-white/50 block text-[10px] mb-0.5 uppercase tracking-wider">Tempo Total do Ciclo</span>
                              <span className="text-sm font-extrabold text-[#00beea]">
                                {campaignsDuration(item.campanhas || [])}s
                              </span>
                            </div>
                            <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                              <span className="text-white/50 block text-[10px] mb-0.5 uppercase tracking-wider">Quantidade</span>
                              <span className="text-sm font-extrabold text-[#00beea]">
                                {item.totalCampanhas || item.campanhas?.length || 0} mídias
                              </span>
                            </div>
                          </div>

                          {/* Footer with Actions */}
                          <div className="flex items-center justify-between border-t border-white/5 pt-3 text-[10px] text-white/40">
                            <div>
                              Atualizado: {item.updatedAt ? new Date(item.updatedAt.seconds * 1000).toLocaleDateString("pt-BR") : "Nunca"}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                className="border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25 text-white size-sm rounded-xl font-medium"
                                size="sm"
                                onClick={() => openDialog(item)}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white shadow-sm rounded-xl font-medium"
                                onClick={() => handleDelete(item.id)}
                              >
                                Excluir
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Creation/Edition Dialog Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="tc-dialog-center max-w-4xl bg-slate-900 border border-white/20 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {current ? "✏️ Editar Playlist" : "📋 Nova Playlist"}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Configure a grade de programação adicionando e ordenando as campanhas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-3 max-h-[60vh] overflow-y-auto pr-1">
            {/* Playlist Fields & Selected Campaigns */}
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="nome" className="text-xs font-semibold text-white/80">Nome da Playlist</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Grade Elevadores - Manhã"
                  className="bg-black/45 border-white/10 text-white rounded-xl placeholder:text-white/35 focus-visible:ring-[#00beea]"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="descricao" className="text-xs font-semibold text-white/80">Descrição</Label>
                <Input
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Programação principal para informativos internos"
                  className="bg-black/45 border-white/10 text-white rounded-xl placeholder:text-white/35 focus-visible:ring-[#00beea]"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="ativo" className="text-xs font-semibold text-white/80">Status de Ativação</Label>
                <select
                  id="ativo"
                  value={ativo ? "true" : "false"}
                  onChange={(e) => setAtivo(e.target.value === "true")}
                  className="w-full bg-black/45 border border-white/10 text-white rounded-xl h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#00beea]"
                >
                  <option className="bg-slate-900" value="true">🟢 Ativa</option>
                  <option className="bg-slate-900" value="false">⚪ Inativa</option>
                </select>
              </div>

              <div className="border border-white/10 rounded-xl p-3 bg-black/25">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#00beea] mb-2">Resumo da Playlist</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-white/60">Campanhas:</span>{" "}
                    <span className="font-extrabold text-white">{campanhasSelecionadas.length}</span>
                  </div>
                  <div>
                    <span className="text-white/60">Duração Total:</span>{" "}
                    <span className="font-extrabold text-white">{duracaoTotal}s</span>
                  </div>
                </div>
              </div>

              {campanhasSelecionadas.length > 5 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 animate-pulse" />
                  <span>Recomendamos até 5 campanhas para telas de elevador.</span>
                </div>
              )}
            </div>

            {/* Campaign Selection Column */}
            <div className="flex flex-col space-y-4">
              {/* Selected Campaigns & Ordering */}
              <div className="flex-1 flex flex-col min-h-[220px] max-h-[300px]">
                <Label className="text-xs font-bold uppercase text-white/80 tracking-wide mb-2 flex justify-between">
                  <span>Campanhas Selecionadas (Grade)</span>
                  <span className="text-white/50">{campanhasSelecionadas.length} itens</span>
                </Label>
                <div className="flex-1 border border-white/10 bg-black/35 rounded-xl p-2 overflow-y-auto space-y-2">
                  {campanhasSelecionadas.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-white/40">
                      Nenhuma campanha adicionada. Use a lista abaixo.
                    </div>
                  ) : (
                    campanhasSelecionadas.map((item, idx) => {
                      const durFinal = (typeof item.duracaoSegundos === "number" && item.duracaoSegundos > 0)
                        ? item.duracaoSegundos
                        : getDuracaoPadrao(item.tipo);
                      return (
                        <div key={idx} className="flex items-center justify-between gap-2 bg-white/[0.05] border border-white/10 p-2 rounded-xl text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-extrabold text-white/40">{idx + 1}</span>
                            <span className="font-medium text-white truncate max-w-[150px]">{item.titulo}</span>
                            <span className="text-white/50 text-[10px]">({durFinal}s)</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              type="button" size="icon" variant="ghost"
                              className="h-7 w-7 rounded-lg text-white/75 hover:bg-white/10 hover:text-white"
                              onClick={() => moveUp(idx)}
                              disabled={idx === 0}
                            >
                              ↑
                            </Button>
                            <Button
                              type="button" size="icon" variant="ghost"
                              className="h-7 w-7 rounded-lg text-white/75 hover:bg-white/10 hover:text-white"
                              onClick={() => moveDown(idx)}
                              disabled={idx === campanhasSelecionadas.length - 1}
                            >
                              ↓
                            </Button>
                            <Button
                              type="button" size="icon" variant="destructive"
                              className="h-7 w-7 rounded-lg bg-red-500/15 hover:bg-red-500/35 border border-red-500/30 text-red-400"
                              onClick={() => removeCampanha(idx)}
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Available Campaigns list to pick from */}
              <div className="flex-1 flex flex-col min-h-[180px] max-h-[220px]">
                <Label className="text-xs font-bold uppercase text-white/80 tracking-wide mb-2">Campanhas Disponíveis</Label>
                <div className="flex-1 border border-white/10 bg-black/35 rounded-xl p-2 overflow-y-auto space-y-2">
                  {campanhasDisponiveis.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-white/40">
                      Nenhuma campanha ativa cadastrada.
                    </div>
                  ) : (
                    campanhasDisponiveis.map((camp) => {
                      const durFinal = (typeof camp.duracaoSegundos === "number" && camp.duracaoSegundos > 0)
                        ? camp.duracaoSegundos
                        : getDuracaoPadrao(camp.tipo);
                      return (
                        <div key={camp.id} className="flex items-center justify-between bg-white/[0.03] border border-white/5 p-2 rounded-xl text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            {camp.imagemUrl ? (
                              <img
                                src={camp.imagemUrl}
                                alt={camp.titulo}
                                className="h-7 w-7 object-cover rounded-lg border border-white/10"
                              />
                            ) : (
                              <div className="h-7 w-7 bg-white/10 rounded-lg flex items-center justify-center text-[8px] text-white/50">
                                Sem img
                              </div>
                            )}
                            <div className="truncate">
                              <span className="font-semibold block text-white truncate max-w-[150px]">{camp.titulo}</span>
                              <span className="text-[10px] text-white/50 block">Duração: {durFinal}s</span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            className="h-7 bg-[#00beea] hover:bg-[#00beea]/80 text-slate-950 font-bold px-2 rounded-lg"
                            onClick={() => addCampanha(camp)}
                          >
                            + Adicionar
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t border-white/10 pt-3">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-white/10 bg-transparent text-white hover:bg-white/5 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#00beea] hover:bg-[#00beea]/80 text-slate-950 font-bold rounded-xl"
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
