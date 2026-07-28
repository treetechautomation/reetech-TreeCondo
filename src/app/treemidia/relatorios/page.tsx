"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart3, 
  Play, 
  Tv, 
  Megaphone, 
  Calendar, 
  TrendingUp, 
  Clock, 
  Search,
  Filter
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Campanha = {
  id: string;
  titulo: string;
  tipo: string;
  ativo: boolean;
};

type PlaylistCampanhaItem = {
  campanhaId: string;
  duracaoSegundos?: number;
  ordem?: number;
};

type Playlist = {
  id: string;
  nome: string;
  ativo: boolean;
  campanhas: PlaylistCampanhaItem[];
};

type Tela = {
  id: string;
  codigo: string;
  nome: string;
  local: string;
  playlistId: string | null;
  playlistNome: string | null;
};

const PERIODS = [
  { label: "Últimas 24 Horas", value: 24 * 60 * 60, days: 1 },
  { label: "Últimos 7 Dias", value: 7 * 24 * 60 * 60, days: 7 },
  { label: "Últimos 30 Dias", value: 30 * 24 * 60 * 60, days: 30 },
];

export default function RelatoriosPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const firestore = useFirestore();
  const { toast } = useToast();
  const condominioAtivoId = session?.activeCondominioId || null;

  // Data states
  const [campanhas, setCampanhas] = React.useState<Campanha[]>([]);
  const [playlists, setPlaylists] = React.useState<Playlist[]>([]);
  const [telas, setTelas] = React.useState<Tela[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Filters state
  const [selectedCampanhaId, setSelectedCampanhaId] = React.useState("todas");
  const [selectedPlaylistId, setSelectedPlaylistId] = React.useState("todas");
  const [selectedTelaId, setSelectedTelaId] = React.useState("todas");
  const [selectedPeriodSecs, setSelectedPeriodSecs] = React.useState(24 * 60 * 60);

  const isAllowed = React.useMemo(() => {
    if (!session) return false;
    const allowedRoles = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];
    return allowedRoles.includes(session.role);
  }, [session]);

  React.useEffect(() => {
    if (!firestore || !condominioAtivoId || !isAllowed) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const campaignsRef = collection(firestore, `condominios/${condominioAtivoId}/treemidia_campanhas`);
    const playlistsRef = collection(firestore, `condominios/${condominioAtivoId}/treemidia_playlists`);
    const screensRef = collection(firestore, `condominios/${condominioAtivoId}/treemidia_telas`);

    const unsubC = onSnapshot(campaignsRef, (snap) => {
      setCampanhas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Campanha)));
    });

    const unsubP = onSnapshot(playlistsRef, (snap) => {
      setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() } as Playlist)));
    });

    const unsubS = onSnapshot(screensRef, (snap) => {
      setTelas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tela)));
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast({ variant: "destructive", title: "Erro ao carregar relatórios." });
      setLoading(false);
    });

    return () => {
      unsubC();
      unsubP();
      unsubS();
    };
  }, [firestore, condominioAtivoId, isAllowed, toast]);

  // Duration mapping helper
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

  // Compile calculations
  const reportData = React.useMemo(() => {
    return campanhas
      .filter(c => selectedCampanhaId === "todas" || c.id === selectedCampanhaId)
      .map((camp) => {
        let exibiçõesEstimadas = 0;
        const linkedPlaylists: string[] = [];
        const linkedTelas: string[] = [];

        // For each screen in the condominium
        telas.forEach((tela) => {
          // Check if screen selection matches
          if (selectedTelaId !== "todas" && tela.id !== selectedTelaId) return;

          // Check if screen has a playlist
          if (!tela.playlistId) return;
          
          // Check if playlist selection matches
          if (selectedPlaylistId !== "todas" && tela.playlistId !== selectedPlaylistId) return;

          // Find the playlist
          const playlist = playlists.find(p => p.id === tela.playlistId);
          if (!playlist || !playlist.ativo) return;

          // Check if the campaign belongs to this playlist
          const campInPlaylist = playlist.campanhas?.find(item => item.campanhaId === camp.id);
          if (!campInPlaylist) return;

          // Add metadata
          if (!linkedPlaylists.includes(playlist.nome)) {
            linkedPlaylists.push(playlist.nome);
          }
          if (!linkedTelas.includes(tela.nome)) {
            linkedTelas.push(tela.nome);
          }

          // Calculate total loop duration of this playlist
          const loopDuration = playlist.campanhas.reduce((sum, item) => {
            const linkedCamp = campanhas.find(cc => cc.id === item.campanhaId);
            const dur = item.duracaoSegundos || (linkedCamp ? getDuracaoPadrao(linkedCamp.tipo) : 15);
            return sum + dur;
          }, 0);

          if (loopDuration > 0) {
            // formula: period (s) / loop duration (s)
            exibiçõesEstimadas += Math.floor(selectedPeriodSecs / loopDuration);
          }
        });

        return {
          ...camp,
          playlists: linkedPlaylists,
          telas: linkedTelas,
          exibiçõesEstimadas
        };
      })
      .filter(row => row.exibiçõesEstimadas > 0 || selectedCampanhaId !== "todas")
      .sort((a, b) => b.exibiçõesEstimadas - a.exibiçõesEstimadas);
  }, [campanhas, playlists, telas, selectedCampanhaId, selectedPlaylistId, selectedTelaId, selectedPeriodSecs]);

  // Aggregate totals
  const totals = React.useMemo(() => {
    let totalExibições = 0;
    const uniqueTelas = new Set<string>();
    const uniquePlaylists = new Set<string>();

    reportData.forEach((row) => {
      totalExibições += row.exibiçõesEstimadas;
      row.telas.forEach(t => uniqueTelas.add(t));
      row.playlists.forEach(p => uniquePlaylists.add(p));
    });

    return {
      totalExibições,
      telasAtivas: uniqueTelas.size,
      playlistsAtivas: uniquePlaylists.size
    };
  }, [reportData]);

  if (isSessionLoading || loading) {
    return (
      <AppLayout pageTitle="Relatório de Transmissão — Carregando">
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-slate-400">Carregando dados estatísticos...</p>
        </div>
      </AppLayout>
    );
  }

  if (!isAllowed) {
    return (
      <AppLayout pageTitle="Relatórios TreeMídia — Acesso Restrito">
        <Card className="border-white/20 bg-white/20 backdrop-blur-2xl shadow-lg text-white">
          <CardHeader>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription className="text-white/70">
              Esta área é exclusiva para gestores e administradores do condomínio.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-white/80">
            Contate o administrador para obter permissão para ver os relatórios.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Relatórios — Estimativas de Transmissão">
      <div className="space-y-6 text-white">
        
        {/* Intro */}
        <div className="flex flex-col gap-1">
          <p className="text-sm text-slate-400">
            Comprovação de veiculação e entrega estimadas de mídia digital para síndicos e patrocinadores locais.
          </p>
        </div>

        {/* Filters Panel */}
        <Card className="border-white/10 bg-white/5 backdrop-blur-md text-white">
          <CardHeader className="pb-3 flex flex-row items-center gap-2 space-y-0">
            <Filter className="h-5 w-5 text-[#00beea]" />
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Filtros Operacionais</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {/* Campaign Filter */}
              <div className="space-y-1.5">
                <Label htmlFor="campSelect" className="text-xs font-semibold text-white/85">Campanha</Label>
                <select
                  id="campSelect"
                  value={selectedCampanhaId}
                  onChange={(e) => setSelectedCampanhaId(e.target.value)}
                  className="w-full bg-black/45 border border-white/10 text-white rounded-xl h-10 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#00beea]"
                >
                  <option value="todas">Todas as Campanhas</option>
                  {campanhas.map(c => (
                    <option key={c.id} value={c.id} className="bg-slate-900">{c.titulo}</option>
                  ))}
                </select>
              </div>

              {/* Playlist Filter */}
              <div className="space-y-1.5">
                <Label htmlFor="playSelect" className="text-xs font-semibold text-white/85">Playlist</Label>
                <select
                  id="playSelect"
                  value={selectedPlaylistId}
                  onChange={(e) => setSelectedPlaylistId(e.target.value)}
                  className="w-full bg-black/45 border border-white/10 text-white rounded-xl h-10 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#00beea]"
                >
                  <option value="todas">Todas as Playlists</option>
                  {playlists.map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900">{p.nome}</option>
                  ))}
                </select>
              </div>

              {/* Screen Filter */}
              <div className="space-y-1.5">
                <Label htmlFor="telaSelect" className="text-xs font-semibold text-white/85">Tela / Dispositivo</Label>
                <select
                  id="telaSelect"
                  value={selectedTelaId}
                  onChange={(e) => setSelectedTelaId(e.target.value)}
                  className="w-full bg-black/45 border border-white/10 text-white rounded-xl h-10 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#00beea]"
                >
                  <option value="todas">Todas as Telas</option>
                  {telas.map(t => (
                    <option key={t.id} value={t.id} className="bg-slate-900">{t.nome} ({t.local})</option>
                  ))}
                </select>
              </div>

              {/* Period Filter */}
              <div className="space-y-1.5">
                <Label htmlFor="periodSelect" className="text-xs font-semibold text-white/85">Período de Análise</Label>
                <select
                  id="periodSelect"
                  value={selectedPeriodSecs}
                  onChange={(e) => setSelectedPeriodSecs(Number(e.target.value))}
                  className="w-full bg-black/45 border border-white/10 text-white rounded-xl h-10 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#00beea]"
                >
                  {PERIODS.map(p => (
                    <option key={p.value} value={p.value} className="bg-slate-900">{p.label}</option>
                  ))}
                </select>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Exhibitions */}
          <Card className="border-cyan-500/20 bg-cyan-500/5 backdrop-blur-md text-white hover:bg-cyan-500/[0.08] transition duration-200">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardDescription className="text-cyan-400 text-xs font-semibold uppercase tracking-wider">Volumetria de Exibições</CardDescription>
              <BarChart3 className="h-4 w-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-cyan-400">{totals.totalExibições.toLocaleString("pt-BR")}</div>
              <p className="text-[10px] text-white/40 mt-1">Exibições estimadas no período selecionado.</p>
            </CardContent>
          </Card>

          {/* Active Screens */}
          <Card className="border-white/10 bg-white/5 backdrop-blur-md text-white hover:bg-white/[0.08] transition duration-200">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Telas Atendidas</CardDescription>
              <Tv className="h-4 w-4 text-[#00beea]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold">{totals.telasAtivas}</div>
              <p className="text-[10px] text-white/40 mt-1">Telas transmitindo as mídias selecionadas.</p>
            </CardContent>
          </Card>

          {/* Playlists Linked */}
          <Card className="border-white/10 bg-white/5 backdrop-blur-md text-white hover:bg-white/[0.08] transition duration-200">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Playlists Ativas</CardDescription>
              <Play className="h-4 w-4 text-[#00beea]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold">{totals.playlistsAtivas}</div>
              <p className="text-[10px] text-white/40 mt-1">Playlists vinculadas às exibições.</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Table */}
        <Card className="border-white/10 bg-white/5 backdrop-blur-md text-white">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#00beea]" /> Relatório Detalhado de Veiculação
            </CardTitle>
            <CardDescription className="text-white/50 text-[11px]">Projeção baseada na taxa de repetição do loop configurado para as playlists associadas às telas.</CardDescription>
          </CardHeader>
          <CardContent>
            {reportData.length === 0 ? (
              <div className="text-center py-12 text-white/40 text-xs space-y-2">
                <Megaphone className="h-10 w-10 text-white/20 mx-auto animate-pulse" />
                <p>Nenhuma exibição encontrada para as combinações de filtros selecionadas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-white/80">
                  <thead className="text-xs uppercase bg-black/40 text-white/50 border-b border-white/10">
                    <tr>
                      <th scope="col" className="px-4 py-3">Campanha</th>
                      <th scope="col" className="px-4 py-3">Playlist Associada</th>
                      <th scope="col" className="px-4 py-3">Telas Vinculadas</th>
                      <th scope="col" className="px-4 py-3 text-right">Projeção de Exibições</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row) => (
                      <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                        <td className="px-4 py-4 font-semibold text-white">
                          <div className="flex flex-col">
                            <span>{row.titulo}</span>
                            <span className="text-[10px] text-white/45 font-normal uppercase tracking-wider mt-0.5">{row.tipo}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs">
                          {row.playlists.join(", ") || "--"}
                        </td>
                        <td className="px-4 py-4 text-xs text-white/60">
                          {row.telas.join(", ") || "--"}
                        </td>
                        <td className="px-4 py-4 text-right font-black text-[#00beea] text-base">
                          {row.exibiçõesEstimadas.toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
