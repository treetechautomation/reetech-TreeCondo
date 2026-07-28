"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { 
  Tv, 
  Copy, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Terminal, 
  HelpCircle,
  FileCheck2,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Tela = {
  id: string;
  codigo: string;
  nome: string;
  local: string;
  status: string;
  playlistId: string | null;
  playlistNome: string | null;
  ultimaComunicacao?: any;
};

export default function KioskPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const firestore = useFirestore();
  const { toast } = useToast();
  const condominioAtivoId = session?.activeCondominioId || null;

  const [telas, setTelas] = React.useState<Tela[]>([]);
  const [selectedTelaId, setSelectedTelaId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);

  // Checklist states
  const [checklist, setChecklist] = React.useState({
    telaCheia: false,
    semCursor: false,
    autoStart: false,
    semSuspensao: false
  });

  const isAllowed = React.useMemo(() => {
    if (!session) return false;
    const allowedRoles = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];
    return allowedRoles.includes(session.role);
  }, [session]);

  React.useEffect(() => {
    if (!firestore || !condominioAtivoId || !isAllowed) {
      setTelas([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const ref = collection(firestore, `condominios/${condominioAtivoId}/treemidia_telas`);
    const q = query(ref, orderBy("nome", "asc"));
    
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tela));
      setTelas(list);
      if (list.length > 0 && !selectedTelaId) {
        setSelectedTelaId(list[0].id);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast({ variant: "destructive", title: "Erro ao carregar telas." });
      setLoading(false);
    });

    return unsub;
  }, [firestore, condominioAtivoId, isAllowed, toast]);

  const selectedTela = React.useMemo(() => {
    return telas.find(t => t.id === selectedTelaId) || null;
  }, [telas, selectedTelaId]);

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

  const getStatusBadge = (statusCalculado: string) => {
    switch (statusCalculado) {
      case "online":
        return <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 w-fit">● Online</span>;
      case "atencao":
        return <span className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 w-fit">● Atenção</span>;
      case "manutencao":
        return <span className="bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 w-fit">● Manutenção</span>;
      default:
        return <span className="bg-red-500/20 border border-red-500/40 text-red-400 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 w-fit">● Offline</span>;
    }
  };

  const screenUrl = React.useMemo(() => {
    if (typeof window === "undefined" || !selectedTela) return "";
    return `${window.location.origin}/tela/${selectedTela.codigo}`;
  }, [selectedTela]);

  const copyUrlToClipboard = () => {
    if (!screenUrl) return;
    navigator.clipboard.writeText(screenUrl);
    toast({ title: "Copiado!", description: "A URL do player foi copiada para a área de transferência." });
  };

  if (isSessionLoading || loading) {
    return (
      <AppLayout pageTitle="Modo Kiosk TV Box — Carregando">
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-slate-400">Carregando painel de Kiosk...</p>
        </div>
      </AppLayout>
    );
  }

  if (!isAllowed) {
    return (
      <AppLayout pageTitle="Modo Kiosk TV Box — Acesso Restrito">
        <Card className="border-white/20 bg-white/20 backdrop-blur-2xl shadow-lg text-white">
          <CardHeader>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription className="text-white/70">
              Esta área é exclusiva para gestores e administradores do condomínio.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-white/80">
            Contate o administrador para obter autorização para configurar os dispositivos.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Modo Kiosk TV Box — Homologação">
      <div className="space-y-8 text-white">
        
        {/* Intro Banner */}
        <div className="flex flex-col gap-1">
          <p className="text-sm text-slate-400">
            Prepare, homologue e ative o player da TreeMídia no modo Kiosk em seus dispositivos TV Box nos elevadores.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
          
          {/* Col 1: Technical specs & Selector */}
          <div className="space-y-6">
            <Card className="border-white/10 bg-white/5 backdrop-blur-md text-white">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-[#00beea] flex items-center gap-2">
                  <Terminal className="h-5 w-5" /> Configuração do Dispositivo
                </CardTitle>
                <CardDescription className="text-white/50 text-[11px]">Selecione a tela ativa no condomínio para obter os parâmetros de conexão.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                
                {/* Select dropdown */}
                <div className="space-y-1.5">
                  <Label htmlFor="telaSelect" className="text-xs font-semibold text-white/80">Selecione a Tela</Label>
                  {telas.length === 0 ? (
                    <div className="text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl">
                      Nenhuma tela cadastrada neste condomínio. Cadastre telas na guia Telas primeiro.
                    </div>
                  ) : (
                    <select
                      id="telaSelect"
                      value={selectedTelaId}
                      onChange={(e) => setSelectedTelaId(e.target.value)}
                      className="w-full bg-black/45 border border-white/10 text-white rounded-xl h-11 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#00beea]"
                    >
                      {telas.map((t) => (
                        <option key={t.id} value={t.id} className="bg-slate-900">
                          {t.nome} ({t.local})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedTela && (
                  <div className="border border-white/10 rounded-2xl p-4 bg-black/30 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] text-white/45 font-bold uppercase tracking-wider">Código da Tela</div>
                        <div className="text-sm font-bold text-white mt-0.5">{selectedTela.codigo}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-white/45 font-bold uppercase tracking-wider">Status de Transmissão</div>
                        <div className="mt-1">
                          {getStatusBadge(getStatusCalculado(selectedTela.ultimaComunicacao, selectedTela.status))}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[10px] text-white/45 font-bold uppercase tracking-wider">Último Batimento Cardíaco (Heartbeat)</div>
                        <div className="text-sm font-medium text-white mt-0.5 flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-[#00beea]" />
                          {selectedTela.ultimaComunicacao 
                            ? new Date(selectedTela.ultimaComunicacao.seconds * 1000).toLocaleString("pt-BR")
                            : "Nenhum sinal recebido"}
                        </div>
                      </div>
                    </div>

                    <div className="h-[1px] bg-white/10 my-3" />

                    {/* Copier link block */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-white/45 font-bold uppercase tracking-wider">URL do Player</div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={screenUrl}
                          className="flex-1 bg-black/45 border border-white/10 text-xs text-white rounded-xl h-10 px-3 focus:outline-none"
                        />
                        <button
                          onClick={copyUrlToClipboard}
                          className="bg-white/10 hover:bg-white/15 text-white p-2.5 rounded-xl border border-white/10 transition"
                          title="Copiar URL"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <a
                          href={screenUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-[#00beea]/20 hover:bg-[#00beea]/30 text-[#00beea] p-2.5 rounded-xl border border-[#00beea]/30 transition flex items-center"
                          title="Abrir Player"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Guide card */}
            <Card className="border-white/10 bg-white/5 backdrop-blur-md text-white">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-[#00beea] flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" /> Instruções de Configuração (TV Box)
                </CardTitle>
                <CardDescription className="text-white/50 text-[11px]">Siga os passos técnicos no dispositivo conectado à tela do elevador.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-relaxed text-white/70">
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#00beea]/20 border border-[#00beea]/35 text-[#00beea] flex items-center justify-center text-xs font-black shrink-0">1</span>
                  <p><strong>Abrir Navegador:</strong> Conecte a TV Box à internet (Wi-Fi ou Ethernet) e abra o navegador padrão (ex: Google Chrome).</p>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#00beea]/20 border border-[#00beea]/35 text-[#00beea] flex items-center justify-center text-xs font-black shrink-0">2</span>
                  <p><strong>Acessar o Player:</strong> Digite a <strong>URL do Player</strong> descrita no painel técnico acima e certifique-se de que a playlist carregue corretamente.</p>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#00beea]/20 border border-[#00beea]/35 text-[#00beea] flex items-center justify-center text-xs font-black shrink-0">3</span>
                  <p><strong>Modo Tela Cheia:</strong> Ative as opções do navegador para ocultar a barra de endereços (Fullscreen) ou use um aplicativo do tipo Kiosk Browser para fixar a exibição.</p>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#00beea]/20 border border-[#00beea]/35 text-[#00beea] flex items-center justify-center text-xs font-black shrink-0">4</span>
                  <p><strong>Inicialização Automática:</strong> Utilize aplicativos como o <em>"Autostart"</em> ou nas próprias configurações do Android do TV Box para iniciar o navegador diretamente no link do player ao ligar o aparelho.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Col 2: Homologation Checklist */}
          <div>
            <Card className="border-cyan-500/20 bg-cyan-500/5 backdrop-blur-md text-white h-full">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-[#00beea] flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5" /> Checklist de Homologação
                </CardTitle>
                <CardDescription className="text-white/50 text-[11px]">Marque cada etapa após verificar o dispositivo fisicamente no elevador.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-2">
                
                <p className="text-xs text-white/60 leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5">
                  Estes itens garantem que a experiência visual do morador seja de alto nível, livre de interrupções, cursores ou barras do sistema Android.
                </p>

                <div className="space-y-4">
                  {/* Item 1 */}
                  <label className="flex gap-3 items-start cursor-pointer group bg-black/10 hover:bg-black/20 p-3 rounded-2xl border border-white/5 transition">
                    <input
                      type="checkbox"
                      checked={checklist.telaCheia}
                      onChange={(e) => setChecklist(prev => ({ ...prev, telaCheia: e.target.checked }))}
                      className="mt-1 accent-[#00beea] h-4 w-4 rounded border-white/20 bg-transparent text-[#00beea]"
                    />
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-[#00beea] transition">Modo Tela Cheia</div>
                      <div className="text-xs text-white/50 mt-0.5">Sem barras de navegação, cabeçalhos, abas ou elementos do sistema operacional visíveis.</div>
                    </div>
                  </label>

                  {/* Item 2 */}
                  <label className="flex gap-3 items-start cursor-pointer group bg-black/10 hover:bg-black/20 p-3 rounded-2xl border border-white/5 transition">
                    <input
                      type="checkbox"
                      checked={checklist.semCursor}
                      onChange={(e) => setChecklist(prev => ({ ...prev, semCursor: e.target.checked }))}
                      className="mt-1 accent-[#00beea] h-4 w-4 rounded border-white/20 bg-transparent text-[#00beea]"
                    />
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-[#00beea] transition">Sem Cursor do Mouse</div>
                      <div className="text-xs text-white/50 mt-0.5">O cursor do mouse está configurado para sumir automaticamente em inatividade (ex: usando app cursor hider).</div>
                    </div>
                  </label>

                  {/* Item 3 */}
                  <label className="flex gap-3 items-start cursor-pointer group bg-black/10 hover:bg-black/20 p-3 rounded-2xl border border-white/5 transition">
                    <input
                      type="checkbox"
                      checked={checklist.autoStart}
                      onChange={(e) => setChecklist(prev => ({ ...prev, autoStart: e.target.checked }))}
                      className="mt-1 accent-[#00beea] h-4 w-4 rounded border-white/20 bg-transparent text-[#00beea]"
                    />
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-[#00beea] transition">Auto Start Configurado</div>
                      <div className="text-xs text-white/50 mt-0.5">Ao reiniciar ou ligar o TV Box, o player carrega automaticamente sem necessitar intervenção humana.</div>
                    </div>
                  </label>

                  {/* Item 4 */}
                  <label className="flex gap-3 items-start cursor-pointer group bg-black/10 hover:bg-black/20 p-3 rounded-2xl border border-white/5 transition">
                    <input
                      type="checkbox"
                      checked={checklist.semSuspensao}
                      onChange={(e) => setChecklist(prev => ({ ...prev, semSuspensao: e.target.checked }))}
                      className="mt-1 accent-[#00beea] h-4 w-4 rounded border-white/20 bg-transparent text-[#00beea]"
                    />
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-[#00beea] transition">Sem Suspensão de Energia</div>
                      <div className="text-xs text-white/50 mt-0.5">A suspensão ou descanso de tela do Android foram completamente desligados (configuração "Sempre ativa").</div>
                    </div>
                  </label>
                </div>

                {/* Progress helper */}
                <div className="pt-2">
                  {Object.values(checklist).every(v => v) ? (
                    <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 p-3.5 rounded-2xl text-xs font-bold">
                      <CheckCircle className="h-5 w-5" /> Equipamento homologado e pronto para operação!
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-white/40 bg-white/5 border border-white/10 p-3.5 rounded-2xl text-xs font-semibold">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" /> Preencha o checklist para concluir a homologação.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

        </div>

      </div>
    </AppLayout>
  );
}
