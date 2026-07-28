"use client";

import * as React from "react";
import {
  collection,
  addDoc,
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

type Tela = {
  id: string;
  nome: string;
  codigo: string;
  local: string;
  orientacao: "vertical" | "horizontal";
  resolucao: string;
  status: "online" | "offline" | "manutencao";
  playlistId: string | null;
  playlistNome: string | null;
  ultimaComunicacao: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export default function TelasPage() {
  const firestore = useFirestore();
  const { session, isSessionLoading } = useSessionCtx();
  const { toast } = useToast();

  const [telas, setTelas] = React.useState<Tela[]>([]);
  const [playlists, setPlaylists] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [current, setCurrent] = React.useState<Tela | null>(null);

  // Form states
  const [nome, setNome] = React.useState("");
  const [codigo, setCodigo] = React.useState("");
  const [local, setLocal] = React.useState("");
  const [orientacao, setOrientacao] = React.useState<"vertical" | "horizontal">("vertical");
  const [resolucao, setResolucao] = React.useState("1080x1920");
  const [status, setStatus] = React.useState<"online" | "offline" | "manutencao">("offline");
  const [playlistId, setPlaylistId] = React.useState<string | null>(null);

  const condominioAtivoId = session?.activeCondominioId || null;

  // Permissões de acesso
  const isAllowed = React.useMemo(() => {
    if (!session) return false;
    const allowedRoles = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];
    return allowedRoles.includes(session.role);
  }, [session]);

  // Load screens
  React.useEffect(() => {
    if (!firestore || !condominioAtivoId || !isAllowed) {
      setTelas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = collection(firestore, `condominios/${condominioAtivoId}/treemidia_telas`);
    const q = query(ref, orderBy("codigo", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setTelas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tela)));
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast({ variant: "destructive", title: "Erro ao carregar telas." });
      setLoading(false);
    });
    return unsub;
  }, [firestore, condominioAtivoId, isAllowed, toast]);

  // Load playlists
  React.useEffect(() => {
    if (!firestore || !condominioAtivoId || !isAllowed) {
      setPlaylists([]);
      return;
    }
    const ref = collection(firestore, `condominios/${condominioAtivoId}/treemidia_playlists`);
    const q = query(ref, orderBy("nome", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setPlaylists(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(p => p.ativo)
      );
    }, (err) => {
      console.error(err);
    });
    return unsub;
  }, [firestore, condominioAtivoId, isAllowed]);

  const openDialog = (item: Tela | null) => {
    setCurrent(item);
    setNome(item?.nome ?? "");
    setCodigo(item?.codigo ?? "");
    setLocal(item?.local ?? "");
    setOrientacao(item?.orientacao ?? "vertical");
    setResolucao(item?.resolucao ?? "1080x1920");
    setStatus(item?.status ?? "offline");
    setPlaylistId(item?.playlistId ?? "");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !condominioAtivoId) return;
    if (!nome.trim() || !codigo.trim() || !local.trim()) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Nome, código e local são obrigatórios.",
      });
      return;
    }
    setSaving(true);
    try {
      const collectionRef = collection(firestore, `condominios/${condominioAtivoId}/treemidia_telas`);
      const chosenPlaylist = playlists.find(p => p.id === playlistId);
      const playlistNome = chosenPlaylist ? chosenPlaylist.nome : null;

      const payload = {
        nome,
        codigo,
        local,
        orientacao,
        resolucao,
        status,
        playlistId: playlistId || null,
        playlistNome: playlistNome || null,
        ultimaComunicacao: current?.ultimaComunicacao ?? null,
        updatedAt: serverTimestamp(),
      };

      if (current) {
        const docRef = doc(collectionRef, current.id);
        await updateDoc(docRef, payload);
        toast({ title: "Tela atualizada com sucesso!" });
      } else {
        await addDoc(collectionRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Tela cadastrada com sucesso!" });
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
    if (!confirm("Tem certeza que deseja remover esta tela?")) return;
    try {
      await deleteDoc(doc(firestore, `condominios/${condominioAtivoId}/treemidia_telas`, id));
      toast({ title: "Tela excluída." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: e.message,
      });
    }
  };

  // Status counters
  const stats = React.useMemo(() => {
    const total = telas.length;
    const online = telas.filter(t => t.status === "online").length;
    const offline = telas.filter(t => t.status === "offline").length;
    const manutencao = telas.filter(t => t.status === "manutencao").length;
    return { total, online, offline, manutencao };
  }, [telas]);

  if (isSessionLoading) {
    return (
      <AppLayout pageTitle="Mídia — Telas e Dispositivos">
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
            Caso precise gerenciar telas da TreeMídia, solicite permissão ao administrador do condomínio.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      pageTitle="Mídia — Telas e Dispositivos"
      headerActions={
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold rounded-xl"
          onClick={() => openDialog(null)}
        >
          Nova Tela
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Status Counters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-white/10 bg-white/10 backdrop-blur-md text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Total de Telas</CardDescription>
              <CardTitle className="text-3xl font-extrabold">{stats.total}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-white/10 bg-white/10 backdrop-blur-md text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Online</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-emerald-400 flex items-center gap-2">
                <span>🟢</span> {stats.online}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-white/10 bg-white/10 backdrop-blur-md text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Offline</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-red-400 flex items-center gap-2">
                <span>🔴</span> {stats.offline}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-white/10 bg-white/10 backdrop-blur-md text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Manutenção</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-yellow-400 flex items-center gap-2">
                <span>🟡</span> {stats.manutencao}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main List Table Card */}
        <Card className="border-white/20 bg-white/20 backdrop-blur-2xl shadow-[0_18px_55px_rgba(2,6,23,0.14)] text-white">
          <CardHeader>
            <CardTitle className="text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.30)]">Dispositivos Cadastrados</CardTitle>
            <CardDescription className="text-white/70">
              Telas ativas veiculando as campanhas e informativos do condomínio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!condominioAtivoId ? (
              <p className="text-white/75">Selecione um condomínio para visualizar.</p>
            ) : loading ? (
              <p className="text-white/75">Carregando...</p>
            ) : (
              <Table className="text-white">
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/70">Código</TableHead>
                    <TableHead className="text-white/70">Nome</TableHead>
                    <TableHead className="text-white/70">Local</TableHead>
                    <TableHead className="text-white/70">Orientação</TableHead>
                    <TableHead className="text-white/70">Status</TableHead>
                    <TableHead className="text-white/70">Playlist</TableHead>
                    <TableHead className="text-white/70">Última Comunicação</TableHead>
                    <TableHead className="text-right text-white/70">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {telas.length === 0 ? (
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableCell colSpan={8} className="text-center text-white/75 py-8">
                        Nenhuma tela cadastrada neste condomínio.
                      </TableCell>
                    </TableRow>
                  ) : (
                    telas.map((item) => (
                      <TableRow key={item.id} className="border-white/10 hover:bg-white/5 transition duration-150">
                        <TableCell className="font-semibold text-[#00beea]">{item.codigo}</TableCell>
                        <TableCell>{item.nome}</TableCell>
                        <TableCell>{item.local}</TableCell>
                        <TableCell className="capitalize">{item.orientacao}</TableCell>
                        <TableCell>
                          {item.status === "online" && (
                            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                              <span>🟢</span> Online
                            </span>
                          )}
                          {item.status === "offline" && (
                            <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                              <span>🔴</span> Offline
                            </span>
                          )}
                          {item.status === "manutencao" && (
                            <span className="flex items-center gap-1.5 text-yellow-400 font-semibold">
                              <span>🟡</span> Manutenção
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold text-[#00beea]">
                          {item.playlistNome || "Sem Playlist"}
                        </TableCell>
                        <TableCell>
                          {item.ultimaComunicacao
                            ? new Date(item.ultimaComunicacao.seconds * 1000).toLocaleString("pt-BR")
                            : "Nunca"}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            className="border-emerald-400/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-white size-sm rounded-xl font-medium"
                            size="sm"
                            onClick={() => window.open(`/tela/${item.codigo}`, "_blank")}
                          >
                            👁 Simular
                          </Button>
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
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Creation/Edition Dialog Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="tc-dialog-center max-w-md bg-slate-900 border border-white/20 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {current ? "✏️ Editar Tela" : "📺 Nova Tela"}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Preencha os dados do dispositivo reprodutor TreeMídia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="nome" className="text-xs font-semibold text-white/80">Nome da Tela</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Elevador Social Bloco A"
                className="bg-black/45 border-white/10 text-white rounded-xl placeholder:text-white/35 focus-visible:ring-[#00beea]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="codigo" className="text-xs font-semibold text-white/80">Código de Pareamento</Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex: TELA-001"
                className="bg-black/45 border-white/10 text-white rounded-xl placeholder:text-white/35 focus-visible:ring-[#00beea]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="local" className="text-xs font-semibold text-white/80">Local de Instalação</Label>
              <Input
                id="local"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Ex: Hall de Entrada / Elevador"
                className="bg-black/45 border-white/10 text-white rounded-xl placeholder:text-white/35 focus-visible:ring-[#00beea]"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="orientacao" className="text-xs font-semibold text-white/80">Orientação</Label>
                <select
                  id="orientacao"
                  value={orientacao}
                  onChange={(e) => setOrientacao(e.target.value as any)}
                  className="w-full bg-black/45 border border-white/10 text-white rounded-xl h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#00beea]"
                >
                  <option className="bg-slate-900" value="vertical">Vertical</option>
                  <option className="bg-slate-900" value="horizontal">Horizontal</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="resolucao" className="text-xs font-semibold text-white/80">Resolução</Label>
                <select
                  id="resolucao"
                  value={resolucao}
                  onChange={(e) => setResolucao(e.target.value)}
                  className="w-full bg-black/45 border border-white/10 text-white rounded-xl h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#00beea]"
                >
                  <option className="bg-slate-900" value="1080x1920">1080x1920</option>
                  <option className="bg-slate-900" value="1920x1080">1920x1080</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="playlist" className="text-xs font-semibold text-white/80">Playlist Vinculada</Label>
              <select
                id="playlist"
                value={playlistId || ""}
                onChange={(e) => setPlaylistId(e.target.value || null)}
                className="w-full bg-black/45 border border-white/10 text-white rounded-xl h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#00beea]"
              >
                <option className="bg-slate-900" value="">Sem Playlist</option>
                {playlists.map((p) => (
                  <option key={p.id} className="bg-slate-900" value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="status" className="text-xs font-semibold text-white/80">Status Inicial</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-black/45 border border-white/10 text-white rounded-xl h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#00beea]"
              >
                <option className="bg-slate-900" value="online">🟢 Online</option>
                <option className="bg-slate-900" value="offline">🔴 Offline</option>
                <option className="bg-slate-900" value="manutencao">🟡 Manutenção</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
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
