"use client";

import * as React from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { useSessionCtx } from "@/contexts/SessionContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  Eye, 
  CheckCircle, 
  AlertTriangle,
  Tv
} from "lucide-react";

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

export default function MonitoramentoPage() {
  const firestore = useFirestore();
  const { session, isSessionLoading } = useSessionCtx();
  const { toast } = useToast();

  const [telas, setTelas] = React.useState<Tela[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [ticker, setTicker] = React.useState(0);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewScreen, setPreviewScreen] = React.useState<Tela | null>(null);
  const [iframeKey, setIframeKey] = React.useState(0);

  const handleOpenPreview = (tela: Tela) => {
    setPreviewScreen(tela);
    setIframeKey((prev) => prev + 1);
    setPreviewOpen(true);
  };

  const condominioAtivoId = session?.activeCondominioId || null;

  // Permissões de acesso
  const isAllowed = React.useMemo(() => {
    if (!session) return false;
    const allowedRoles = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];
    return allowedRoles.includes(session.role);
  }, [session]);

  // Client-side auto-refresh ticker (re-evaluates time and statuses every 30s)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setTicker((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load screens from Firestore in real-time
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
      toast({ variant: "destructive", title: "Erro ao carregar monitoramento." });
      setLoading(false);
    });
    return unsub;
  }, [firestore, condominioAtivoId, isAllowed, toast]);

  // Helper function to dynamically calculate screen status based on heartbeat
  const getStatusCalculado = (ultimaComunicacao: Timestamp | null, manualStatus: string): "online" | "atencao" | "offline" | "manutencao" => {
    if (manualStatus === "manutencao") return "manutencao";
    if (!ultimaComunicacao) return "offline";
    const now = new Date();
    const diffMs = now.getTime() - (ultimaComunicacao.seconds * 1000);
    const diffMin = diffMs / 1000 / 60;
    
    if (diffMin <= 2) {
      return "online";
    } else if (diffMin <= 5) {
      return "atencao";
    } else {
      return "offline";
    }
  };

  // Helper to format last communication relative time elapsed (humanized)
  const getTempoFormatado = (ultimaComunicacao: Timestamp | null): string => {
    if (!ultimaComunicacao) return "Nunca";
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - (ultimaComunicacao.seconds * 1000)) / 1000);

    if (diffSeconds < 0) return "Agora mesmo";
    if (diffSeconds < 10) return "Agora mesmo";
    if (diffSeconds < 60) return `há ${diffSeconds} segundos`;

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `há ${diffMinutes} ${diffMinutes === 1 ? "minuto" : "minutos"}`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `há ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `há ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`;
  };

  // KPIs and summarized stats (re-calculated dynamically on telemetry updates or ticker tick)
  const stats = React.useMemo(() => {
    const total = telas.length;
    let online = 0;
    let atencao = 0;
    let offline = 0;
    let manutencao = 0;
    let semPlaylist = 0;

    telas.forEach((t) => {
      if (!t.playlistId) {
        semPlaylist++;
      }
      
      const statusCalculado = getStatusCalculado(t.ultimaComunicacao, t.status);
      if (statusCalculado === "online") {
        online++;
      } else if (statusCalculado === "atencao") {
        atencao++;
      } else if (statusCalculado === "manutencao") {
        manutencao++;
      } else {
        offline++;
      }
    });

    return { total, online, atencao, offline, manutencao, semPlaylist };
  }, [telas, ticker]);

  if (isSessionLoading) {
    return (
      <AppLayout pageTitle="Mídia — Monitoramento em Tempo Real">
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
            Caso precise gerenciar e monitorar telas da TreeMídia, solicite permissão ao administrador do condomínio.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Mídia — Monitoramento em Tempo Real">
      <div className="space-y-6">
        
        {/* EXECUTIVE SUMMARY STRIP */}
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
          <div className="space-y-1">
            <h2 className="text-xs font-bold text-white/50 uppercase tracking-wider">Tree Mídia Status</h2>
            <div className="flex flex-wrap items-center gap-6 mt-2 text-sm font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span>🟢</span> {stats.online} Online
              </span>
              <span className="flex items-center gap-1.5 text-yellow-400">
                <span>🟡</span> {stats.atencao} Atenção
              </span>
              <span className="flex items-center gap-1.5 text-red-400">
                <span>🔴</span> {stats.offline} Offline
              </span>
              <span className="flex items-center gap-1.5 text-orange-400">
                <span>🟡</span> {stats.manutencao} Manutenção
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span>⚪</span> {stats.semPlaylist} Sem Playlist
              </span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-2">
            <span className="h-2 w-2 bg-emerald-500 rounded-full animate-ping" />
            Auto Refresh: 30s
          </div>
        </div>

        {/* KPI Section */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-white/10 bg-white/10 backdrop-blur-md text-white col-span-2 lg:col-span-1">
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
              <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Atenção</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-yellow-400 flex items-center gap-2">
                <span>🟡</span> {stats.atencao}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-white/10 bg-white/10 backdrop-blur-md text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Offline / Manutenção</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-red-400 flex flex-wrap items-center gap-2">
                <span>🔴</span> {stats.offline}
                <span className="text-xs text-orange-400">({stats.manutencao} Manut.)</span>
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-white/10 bg-white/10 backdrop-blur-md text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Sem Playlist</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-slate-400 flex items-center gap-2">
                <span>⚪</span> {stats.semPlaylist}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* NOC Operational Cards */}
        {condominioAtivoId && telas.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {telas.map((item) => {
              const calculatedStatus = getStatusCalculado(item.ultimaComunicacao, item.status);
              const tempoFormatado = getTempoFormatado(item.ultimaComunicacao);
              const hasPlaylist = !!item.playlistId;

              // Border and bg colors based on status
              let statusBorder = "border-white/10";
              let statusBg = "bg-white/5";
              let statusText = "text-white";
              let statusBullet = "⚪";
              let statusName = "Sem Playlist";

              if (calculatedStatus === "manutencao") {
                statusBorder = "border-yellow-500/20";
                statusBg = "bg-yellow-500/5";
                statusText = "text-yellow-400";
                statusBullet = "🟡";
                statusName = "Manutenção";
              } else if (!hasPlaylist) {
                statusBorder = "border-slate-500/20";
                statusBg = "bg-slate-500/5";
                statusText = "text-slate-400";
                statusBullet = "⚪";
                statusName = "Sem Playlist";
              } else if (calculatedStatus === "online") {
                statusBorder = "border-emerald-500/20";
                statusBg = "bg-emerald-500/5";
                statusText = "text-emerald-400";
                statusBullet = "🟢";
                statusName = "Online";
              } else if (calculatedStatus === "atencao") {
                statusBorder = "border-yellow-500/20 animate-pulse";
                statusBg = "bg-yellow-500/5";
                statusText = "text-yellow-400";
                statusBullet = "🟡";
                statusName = "Atenção";
              } else {
                statusBorder = "border-red-500/20";
                statusBg = "bg-red-500/5";
                statusText = "text-red-400";
                statusBullet = "🔴";
                statusName = "Offline";
              }

              return (
                <div key={item.id} className={`rounded-xl border ${statusBorder} ${statusBg} backdrop-blur-md p-4 space-y-3 transition duration-150 hover:bg-white/[0.08]`}>
                  <div className="flex items-start justify-between">
                    <div className="truncate">
                      <span className="text-[10px] font-mono text-white/50 block">{item.codigo}</span>
                      <h4 className="font-bold text-sm text-white truncate">{item.nome}</h4>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${statusText}`}>
                      {statusBullet} {statusName}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 pt-2 border-t border-white/5">
                    <div className="flex justify-between">
                      <span className="text-white/40">Playlist:</span>
                      <span className="font-semibold text-[#00beea] truncate max-w-[120px]">{item.playlistNome || "Nenhuma"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Último contato:</span>
                      <span className="font-semibold text-white/80">{tempoFormatado}</span>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      className="w-full border-[#00beea]/30 bg-[#00beea]/10 hover:bg-[#00beea]/20 text-white rounded-lg text-xs font-semibold py-1 h-auto flex items-center justify-center gap-1.5"
                      size="sm"
                      onClick={() => handleOpenPreview(item)}
                    >
                      <Eye className="h-3.5 w-3.5" /> Visualizar Tela
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Monitoring List Card */}
        <Card className="border-white/20 bg-white/20 backdrop-blur-2xl shadow-[0_18px_55px_rgba(2,6,23,0.14)] text-white">
          <CardHeader>
            <CardTitle className="text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.30)]">Monitoramento Ativo</CardTitle>
            <CardDescription className="text-white/70">
              Acompanhe o batimento cardíaco (heartbeat) e a playlist associada a cada dispositivo.
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
                    <TableHead className="text-white/70">Nome da Tela</TableHead>
                    <TableHead className="text-white/70">Local</TableHead>
                    <TableHead className="text-white/70">Status Atual</TableHead>
                    <TableHead className="text-white/70">Playlist</TableHead>
                    <TableHead className="text-white/70">Última Comunicação</TableHead>
                    <TableHead className="text-white/70">Tempo sem contato</TableHead>
                    <TableHead className="text-white/70">Orientação</TableHead>
                    <TableHead className="text-white/70">Resolução</TableHead>
                    <TableHead className="text-white/70">Último Heartbeat</TableHead>
                    <TableHead className="text-right text-white/70">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {telas.length === 0 ? (
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableCell colSpan={11} className="text-center text-white/75 py-8">
                        Nenhuma tela monitorada neste condomínio.
                      </TableCell>
                    </TableRow>
                  ) : (
                    telas.map((item) => {
                      const calculatedStatus = getStatusCalculado(item.ultimaComunicacao, item.status);
                      const tempoFormatado = getTempoFormatado(item.ultimaComunicacao);
                      const hasPlaylist = !!item.playlistId;

                      return (
                        <TableRow key={item.id} className="border-white/10 hover:bg-white/5 transition duration-150">
                          <TableCell className="font-semibold text-[#00beea]">{item.codigo}</TableCell>
                          <TableCell>{item.nome}</TableCell>
                          <TableCell>{item.local}</TableCell>
                          <TableCell>
                            {calculatedStatus === "manutencao" ? (
                              <span className="inline-flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                🟡 Manutenção
                              </span>
                            ) : !hasPlaylist ? (
                              <span className="inline-flex items-center gap-1 bg-white/10 border border-white/20 text-white/60 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                ⚪ Sem Playlist
                              </span>
                            ) : calculatedStatus === "online" ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                🟢 Online
                              </span>
                            ) : calculatedStatus === "atencao" ? (
                              <span className="inline-flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                                🟡 Atenção
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-red-500/20 border border-red-500/40 text-red-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                🔴 Offline
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-[#00beea]">
                            {item.playlistNome || "Nenhuma"}
                          </TableCell>
                          <TableCell>
                            {item.ultimaComunicacao
                              ? new Date(item.ultimaComunicacao.seconds * 1000).toLocaleString("pt-BR")
                              : "Nunca"}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {tempoFormatado}
                          </TableCell>
                          <TableCell className="capitalize">{item.orientacao}</TableCell>
                          <TableCell>{item.resolucao}</TableCell>
                          <TableCell className="text-xs text-slate-400 font-mono">
                            {item.ultimaComunicacao
                              ? new Date(item.ultimaComunicacao.seconds * 1000).toISOString()
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              className="border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25 text-white size-sm rounded-xl font-medium"
                              size="sm"
                              onClick={() => handleOpenPreview(item)}
                            >
                              👁 Visualizar Tela
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Visual Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md bg-slate-955 border border-white/10 text-white rounded-2xl p-6 shadow-2xl relative flex flex-col items-center">
          <DialogHeader className="w-full border-b border-white/5 pb-3">
            <DialogTitle className="text-lg font-bold text-[#00beea] flex items-center gap-2">
              <Tv className="h-5 w-5" /> Preview ao Vivo da Tela
            </DialogTitle>
          </DialogHeader>

          {previewScreen && (
            <div className="w-full space-y-4 pt-3 flex flex-col items-center">
              {/* Screen Info */}
              <div className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-white/50">Nome:</span>
                  <span className="font-semibold">{previewScreen.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Código:</span>
                  <span className="font-mono font-semibold text-[#00beea]">{previewScreen.codigo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Playlist:</span>
                  <span className="font-semibold text-[#00beea]">{previewScreen.playlistNome || "Sem Playlist"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/50">Status:</span>
                  {(() => {
                    const calc = getStatusCalculado(previewScreen.ultimaComunicacao, previewScreen.status);
                    if (calc === "manutencao") return <span className="text-yellow-400 font-semibold">🟡 Manutenção</span>;
                    if (calc === "online") return <span className="text-emerald-400 font-semibold">🟢 Online</span>;
                    if (calc === "atencao") return <span className="text-yellow-400 font-semibold">🟡 Atenção</span>;
                    return <span className="text-red-400 font-semibold">🔴 Offline</span>;
                  })()}
                </div>
              </div>

              {/* Vertical Emulator Container (9:16 Aspect Ratio) */}
              <div className="w-[225px] h-[400px] bg-[#030712] border-4 border-slate-800 rounded-[20px] overflow-hidden shadow-inner relative group">
                <iframe
                  key={iframeKey}
                  src={`/tela/${previewScreen.codigo}`}
                  className="w-full h-full border-none select-none"
                  style={{ transform: "scale(1)", transformOrigin: "top left" }}
                />
              </div>

              {/* Action Buttons Below the Preview */}
              <div className="w-full grid grid-cols-3 gap-2 pt-2 text-xs">
                {/* Refresh Preview */}
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex flex-col items-center justify-center p-2 h-auto gap-1"
                  onClick={() => setIframeKey(prev => prev + 1)}
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="text-[10px]">Atualizar</span>
                </Button>

                {/* Open in new tab */}
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex flex-col items-center justify-center p-2 h-auto gap-1"
                  onClick={() => window.open(`/tela/${previewScreen.codigo}`, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="text-[10px]">Nova Aba</span>
                </Button>

                {/* Copy URL */}
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl flex flex-col items-center justify-center p-2 h-auto gap-1"
                  onClick={() => {
                    const url = `${window.location.origin}/tela/${previewScreen.codigo}`;
                    navigator.clipboard.writeText(url);
                    toast({
                      title: "URL Copiada!",
                      description: "A URL da tela foi copiada para a área de transferência.",
                    });
                  }}
                >
                  <Copy className="h-4 w-4" />
                  <span className="text-[10px]">Copiar URL</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
