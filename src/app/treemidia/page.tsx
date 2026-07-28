"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import Link from "next/link";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { 
  Tv, 
  Play, 
  Image, 
  Monitor, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  Megaphone, 
  TrendingUp, 
  ArrowRight,
  ShieldAlert
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TreeMidiaPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const firestore = useFirestore();
  const condominioAtivoId = session?.activeCondominioId || null;

  const [telas, setTelas] = React.useState<any[]>([]);
  const [campanhas, setCampanhas] = React.useState<any[]>([]);
  const [playlists, setPlaylists] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Permissões de acesso
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

    const screensRef = collection(firestore, `condominios/${condominioAtivoId}/treemidia_telas`);
    const campaignsRef = collection(firestore, `condominios/${condominioAtivoId}/treemidia_campanhas`);
    const playlistsRef = collection(firestore, `condominios/${condominioAtivoId}/treemidia_playlists`);

    const unsubScreens = onSnapshot(screensRef, (snap) => {
      setTelas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubCampaigns = onSnapshot(campaignsRef, (snap) => {
      setCampanhas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubPlaylists = onSnapshot(playlistsRef, (snap) => {
      setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubScreens();
      unsubCampaigns();
      unsubPlaylists();
    };
  }, [firestore, condominioAtivoId, isAllowed]);

  // Dynamic status evaluation helper
  const getStatusCalculado = (ultimaComunicacao: any, manualStatus: string): "online" | "atencao" | "offline" | "manutencao" => {
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

  const stats = React.useMemo(() => {
    const totalTelas = telas.length;
    let online = 0;
    let atencao = 0;
    let offline = 0;
    let manutencao = 0;
    let telasAtivas = 0;

    telas.forEach((t) => {
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

      if (t.playlistId) {
        telasAtivas++;
      }
    });

    const totalCampanhas = campanhas.length;
    const totalPlaylists = playlists.length;
    const totalPatrocinadas = campanhas.filter((c: any) => c.tipo === "patrocinado" && c.ativo).length;

    // Tempo total de exibição: sum of durations of all campaigns inside active playlists
    let tempoTotalExibicao = 0;
    playlists.forEach((p) => {
      if (p.ativo && p.campanhas) {
        p.campanhas.forEach((c: any) => {
          tempoTotalExibicao += c.duracaoSegundos || 0;
        });
      }
    });

    return {
      totalTelas,
      online,
      atencao,
      offline,
      manutencao,
      telasAtivas,
      totalCampanhas,
      totalPlaylists,
      tempoTotalExibicao,
      totalPatrocinadas,
    };
  }, [telas, campanhas, playlists]);

  if (isSessionLoading) {
    return (
      <AppLayout pageTitle="TreeMídia — Carregando">
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-slate-400">Carregando sessão...</p>
        </div>
      </AppLayout>
    );
  }

  if (!isAllowed) {
    return (
      <AppLayout pageTitle="TreeMídia — Acesso Restrito">
        <Card className="border-white/20 bg-white/20 backdrop-blur-2xl shadow-lg text-white">
          <CardHeader>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription className="text-white/70">
              Esta área é exclusiva para gestores e administradores do condomínio.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-white/80">
            Solicite permissão ao administrador caso precise configurar o painel TreeMídia.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="TreeMídia — Dashboard Executivo">
      <div className="space-y-8 text-white">
        
        {/* Title Intro */}
        <div className="flex flex-col gap-1">
          <p className="text-sm text-slate-400">
            Painel operacional e estatísticas de transmissão de mídia em tempo real.
          </p>
        </div>

        {/* Section: Status das Telas */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-white/50 uppercase tracking-wider">Status de Transmissão</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Screens */}
            <Card className="border-white/10 bg-white/5 backdrop-blur-md text-white hover:bg-white/[0.08] transition duration-200">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Total de Telas</CardDescription>
                <Tv className="h-4 w-4 text-[#00beea]" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold">{loading ? "..." : stats.totalTelas}</div>
              </CardContent>
            </Card>

            {/* Online Screens */}
            <Card className="border-emerald-500/20 bg-emerald-500/5 backdrop-blur-md text-white hover:bg-emerald-500/[0.08] transition duration-200">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Online</CardDescription>
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-emerald-400">
                  {loading ? "..." : stats.online}
                </div>
              </CardContent>
            </Card>

            {/* Attention Screens */}
            <Card className="border-yellow-500/20 bg-yellow-500/5 backdrop-blur-md text-white hover:bg-yellow-500/[0.08] transition duration-200">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">Atenção</CardDescription>
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-yellow-400">
                  {loading ? "..." : stats.atencao}
                </div>
              </CardContent>
            </Card>

            {/* Offline Screens */}
            <Card className="border-red-500/20 bg-red-500/5 backdrop-blur-md text-white hover:bg-red-500/[0.08] transition duration-200">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-red-400 text-xs font-semibold uppercase tracking-wider">Offline</CardDescription>
                <ShieldAlert className="h-4 w-4 text-red-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold text-red-400">
                  {loading ? "..." : stats.offline}
                  {stats.manutencao > 0 && (
                    <span className="text-xs text-yellow-500 font-semibold ml-2">({stats.manutencao} Manut.)</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section: Métricas de Conteúdo e Comercial */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-white/50 uppercase tracking-wider">Desempenho & Mídia</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Campaigns */}
            <Card className="border-white/10 bg-white/5 backdrop-blur-md text-white hover:bg-white/[0.08] transition duration-200">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Campanhas</CardDescription>
                <Megaphone className="h-4 w-4 text-[#00beea]" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold">{loading ? "..." : stats.totalCampanhas}</div>
              </CardContent>
            </Card>

            {/* Playlists Count */}
            <Card className="border-white/10 bg-white/5 backdrop-blur-md text-white hover:bg-white/[0.08] transition duration-200">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Playlists</CardDescription>
                <Play className="h-4 w-4 text-[#00beea]" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold">{loading ? "..." : stats.totalPlaylists}</div>
              </CardContent>
            </Card>

            {/* Total Duration */}
            <Card className="border-white/10 bg-white/5 backdrop-blur-md text-white hover:bg-white/[0.08] transition duration-200">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Tempo de Exibição</CardDescription>
                <Clock className="h-4 w-4 text-[#00beea]" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold">
                  {loading ? "..." : `${stats.tempoTotalExibicao}s`}
                </div>
              </CardContent>
            </Card>

            {/* Active Screens Spot Count */}
            <Card className="border-white/10 bg-white/5 backdrop-blur-md text-white hover:bg-white/[0.08] transition duration-200">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Telas Ativas</CardDescription>
                <MapPin className="h-4 w-4 text-[#00beea]" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold">
                  {loading ? "..." : stats.telasAtivas}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section: Comercial & Monetização */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-white/50 uppercase tracking-wider">Performance Comercial</h2>
          <Card className="border-cyan-500/20 bg-cyan-500/5 backdrop-blur-md text-white relative overflow-hidden shadow-lg hover:bg-cyan-500/[0.08] transition duration-200">
            <div className="absolute top-0 -left-1/4 w-[150%] h-[150%] bg-gradient-to-br from-cyan-500/10 to-transparent blur-3xl pointer-events-none" />
            <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between relative z-10">
              <div>
                <CardTitle className="text-base font-bold text-[#00beea] flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 animate-pulse" /> Espaços Publicitários
                </CardTitle>
                <CardDescription className="text-white/50 text-[10px] uppercase font-bold mt-0.5 tracking-wider">Previsão e Mapeamento de Geração de Receita</CardDescription>
              </div>
              <span className="text-[10px] font-bold bg-[#00beea]/20 border border-[#00beea]/40 text-[#00beea] px-2.5 py-0.5 rounded-full">
                PILOTO COMERCIAL
              </span>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
              <div className="space-y-0.5">
                <span className="text-white/50 text-xs font-semibold">Anunciantes Ativos</span>
                <div className="text-xl font-black">0</div>
              </div>
              <div className="space-y-0.5">
                <span className="text-white/50 text-xs font-semibold">Campanhas Patrocinadas</span>
                <div className="text-xl font-black">{loading ? "..." : stats.totalPatrocinadas}</div>
              </div>
              <div className="space-y-0.5">
                <span className="text-white/50 text-xs font-semibold">Espaços Ocupados</span>
                <div className="text-xl font-black">0%</div>
              </div>
              <div className="space-y-0.5">
                <span className="text-white/50 text-xs font-semibold">Receita Estimada</span>
                <div className="text-xl font-black text-emerald-400">R$ 0,00</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Grid (Premium buttons) */}
        <div className="space-y-3 pt-2">
          <h2 className="text-xs font-bold text-white/50 uppercase tracking-wider">Gerenciamento Operacional</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Telas Link */}
            <Link href="/treemidia/telas">
              <div className="group border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-5 hover:bg-white/[0.08] hover:border-[#00beea]/30 transition duration-200 cursor-pointer flex flex-col justify-between min-h-[140px]">
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-[#00beea] flex items-center gap-2">
                    <span>📺</span> Telas & Dispositivos
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Pareie novos aparelhos TV Box, simule visualização e controle configurações de tela.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#00beea] pt-2 group-hover:translate-x-1 transition-transform">
                  Configurar <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>

            {/* Campanhas Link */}
            <Link href="/treemidia/campanhas">
              <div className="group border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-5 hover:bg-white/[0.08] hover:border-[#00beea]/30 transition duration-200 cursor-pointer flex flex-col justify-between min-h-[140px]">
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-[#00beea] flex items-center gap-2">
                    <span>📢</span> Campanhas & Conteúdo
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Gerencie avisos, conteúdos de saúde, finanças, anúncios de patrocinadores e notícias.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#00beea] pt-2 group-hover:translate-x-1 transition-transform">
                  Gerenciar Mídias <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>

            {/* Playlists Link */}
            <Link href="/treemidia/playlists">
              <div className="group border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-5 hover:bg-white/[0.08] hover:border-[#00beea]/30 transition duration-200 cursor-pointer flex flex-col justify-between min-h-[140px]">
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-[#00beea] flex items-center gap-2">
                    <span>📋</span> Playlists & Programação
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Organize o loop de veiculação das campanhas e configure a ordenação operacional.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#00beea] pt-2 group-hover:translate-x-1 transition-transform">
                  Ver Grade <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>

            {/* Monitoramento NOC Link */}
            <Link href="/treemidia/monitoramento">
              <div className="group border border-emerald-500/10 bg-emerald-500/5 backdrop-blur-md rounded-2xl p-5 hover:bg-emerald-500/[0.08] hover:border-emerald-500/30 transition duration-200 cursor-pointer flex flex-col justify-between min-h-[140px]">
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-emerald-400 flex items-center gap-2">
                    <span>🖥</span> Monitoramento NOC
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Painel inteligente em tempo real para telemetria de batimento cardíaco dos players.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 pt-2 group-hover:translate-x-1 transition-transform">
                  Ver Central NOC <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>

          </div>
        </div>

      </div>
    </AppLayout>
  );
}
