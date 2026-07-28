"use client";

import * as React from "react";
import { 
  Sun, 
  TrendingUp, 
  TrendingDown, 
  Tv, 
  QrCode, 
  Calendar, 
  Award, 
  Heart, 
  Info, 
  AlertTriangle, 
  Percent, 
  Clock,
  Coins,
  ShieldCheck,
  Megaphone,
  Cloud,
  CloudRain
} from "lucide-react";
import * as QRCode from "qrcode";

type Campanha = {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  imagemUrl: string | null;
  duracaoSegundos: number;
  prioridade: number;
  ordem: number;
};

type ScreenProps = {
  codigo: string;
  nome: string;
  local: string;
  status: string;
  playlistId: string | null;
  playlistNome: string | null;
};

type PlayerClientProps = {
  codigo: string;
  screen: ScreenProps;
  campaigns: Campanha[];
  urlQrCode?: string | null;
  cidade?: string;
  estado?: string;
};

const TIPO_LABELS: Record<string, string> = {
  comunicado: "Comunicado Oficial",
  aviso: "Aviso Importante",
  saude: "Dica de Saúde",
  financas: "Finanças Pessoais",
  voce_sabia: "Você Sabia?",
  noticia: "Notícias de Hoje",
  evento: "Evento do Condomínio",
  anuncio: "Anuncie Conosco",
  patrocinado: "Patrocinado",
};

const PLAYER_VERSION = "1.0.0";

export default function PlayerClient({ 
  codigo, 
  screen, 
  campaigns,
  urlQrCode = null,
  cidade = "São Paulo",
  estado = "SP"
}: PlayerClientProps) {
  // Timers states
  const [headerIndex, setHeaderIndex] = React.useState(0);
  const [centerIndex, setCenterIndex] = React.useState(0);
  const [footerIndex, setFooterIndex] = React.useState(0);

  // Time & Date state
  const [currentTime, setCurrentTime] = React.useState("");

  // Animation states to trigger transitions
  const [headerFade, setHeaderFade] = React.useState(true);
  const [centerFade, setCenterFade] = React.useState(true);
  const [footerFade, setFooterFade] = React.useState(true);

  // Image load error tracker
  const [imageErrors, setImageErrors] = React.useState<Record<string, boolean>>({});

  // Dynamic QR Code state
  const [qrDataUrl, setQrDataUrl] = React.useState<string>("");

  // Weather states
  const [weatherTemp, setWeatherTemp] = React.useState<string>("--");
  const [weatherDesc, setWeatherDesc] = React.useState<string>("");

  // Update clock
  React.useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Generate QR Code dynamically
  React.useEffect(() => {
    const qrText = urlQrCode || "https://treecondo.treetechautomation.com";
    QRCode.toDataURL(qrText, { width: 150, margin: 1 })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generating QR code:", err));
  }, [urlQrCode]);

  // Load and update live weather info (Open-Meteo)
  React.useEffect(() => {
    if (!cidade) {
      setWeatherTemp("--");
      setWeatherDesc("");
      return;
    }

    async function fetchWeather() {
      try {
        // Step 1: Geocoding
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&format=json`;
        const geoRes = await fetch(geoUrl);
        if (!geoRes.ok) throw new Error("Geocoding API request failed");
        
        const geoData = await geoRes.json();
        if (!geoData.results || geoData.results.length === 0) {
          throw new Error(`Location not found: ${cidade}`);
        }
        
        const { latitude, longitude } = geoData.results[0];

        // Step 2: Weather Forecast
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
        const weatherRes = await fetch(weatherUrl);
        if (!weatherRes.ok) throw new Error("Weather API request failed");

        const weatherData = await weatherRes.json();
        const cw = weatherData.current_weather;
        if (!cw) throw new Error("No current weather data in response");

        const tempVal = Math.round(cw.temperature);
        const code = cw.weathercode;

        let desc = "☁ Nublado";
        if (code === 0 || code === 1) {
          desc = "☀ Ensolarado";
        } else if ((code >= 51 && code <= 82) || (code >= 95 && code <= 99)) {
          desc = "🌧 Chuva";
        }

        setWeatherTemp(`${tempVal}°C`);
        setWeatherDesc(desc);
      } catch (err) {
        console.error("[PlayerClient] Falha ao carregar clima:", err);
        setWeatherTemp("--");
        setWeatherDesc("");
      }
    }

    fetchWeather();
    // Update every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [cidade, estado]);

  // Header rotations (10s)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setHeaderFade(false);
      setTimeout(() => {
        setHeaderIndex((prev) => (prev + 1) % 5);
        setHeaderFade(true);
      }, 500); // Wait for fade out to complete before swapping content
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Center rotations (dynamic duration based on campaign slide)
  React.useEffect(() => {
    if (campaigns.length === 0) return;

    const currentCampaign = campaigns[centerIndex];
    const nextIndex = campaigns.length > 1 ? (centerIndex + 1) % campaigns.length : centerIndex;
    const nextCampaign = campaigns[nextIndex];
    const duration = (currentCampaign?.duracaoSegundos || 10) * 1000;

    console.log(
      `[PlayerClient] Slide atual: "${currentCampaign?.titulo || 'Sem título'}" (Index: ${centerIndex}) -> ` +
      `Próximo slide: "${nextCampaign?.titulo || 'Sem título'}" (Index: ${nextIndex}) | Duração: ${duration / 1000}s`
    );

    if (campaigns.length <= 1) return;

    const timer = setTimeout(() => {
      setCenterFade(false);
      setTimeout(() => {
        setCenterIndex((prev) => (prev + 1) % campaigns.length);
        setCenterFade(true);
      }, 500); // 500ms fade transition
    }, duration - 500); // Start fade transition 500ms before duration expires

    return () => clearTimeout(timer);
  }, [centerIndex, campaigns]);

  // Footer rotations (8s)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setFooterFade(false);
      setTimeout(() => {
        setFooterIndex((prev) => (prev + 1) % 5);
        setFooterFade(true);
      }, 500);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Heartbeat updates (Immediate on mount, then every 60 seconds)
  React.useEffect(() => {
    if (codigo === "demo") return;

    async function sendHeartbeat() {
      try {
        const payload = {
          playerVersion: PLAYER_VERSION,
          deviceInfo: {
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "desconhecido",
            platform: typeof navigator !== "undefined" ? navigator.platform : "desconhecido",
            language: typeof navigator !== "undefined" ? navigator.language : "desconhecido",
          },
          screenInfo: {
            width: typeof window !== "undefined" ? window.screen.width : 0,
            height: typeof window !== "undefined" ? window.screen.height : 0,
            innerWidth: typeof window !== "undefined" ? window.innerWidth : 0,
            innerHeight: typeof window !== "undefined" ? window.innerHeight : 0,
            orientation: typeof window !== "undefined" ? (window.screen.orientation?.type || (window.innerHeight > window.innerWidth ? "portrait" : "landscape")) : "desconhecido",
          }
        };

        await fetch(`/api/treemidia/player/${codigo}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error("[PlayerClient] Falha ao enviar heartbeat:", err);
      }
    }

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [codigo]);

  const handleImageError = (campId: string) => {
    setImageErrors((prev) => ({ ...prev, [campId]: true }));
  };

  // --- Content Definitions ---

  // Top widgets (10s)
  const renderHeaderContent = () => {
    switch (headerIndex) {
      case 0:
        return (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              {weatherDesc === "☀ Ensolarado" ? (
                <Sun className="h-10 w-10 text-amber-400" />
              ) : weatherDesc === "🌧 Chuva" ? (
                <CloudRain className="h-10 w-10 text-blue-400" />
              ) : (
                <Cloud className="h-10 w-10 text-slate-400" />
              )}
              <div>
                <div className="text-xl font-bold">{cidade}</div>
                <div className="text-sm text-slate-400">{weatherDesc || "Carregando clima..."}</div>
              </div>
            </div>
            <div className="text-3xl font-extrabold text-white">{weatherTemp}</div>
          </div>
        );
      case 1:
        return (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Coins className="h-8 w-8 text-[#00beea]" />
              <span className="text-lg font-semibold text-slate-300">Câmbio Comercial</span>
            </div>
            <div className="flex gap-6">
              <div className="text-right">
                <div className="text-xs text-slate-400">DÓLAR</div>
                <div className="text-lg font-bold text-emerald-400 flex items-center gap-1">
                  R$ 5,42 <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">EURO</div>
                <div className="text-lg font-bold text-rose-400 flex items-center gap-1">
                  R$ 5,84 <TrendingDown className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-[#00beea]" />
              <span className="text-lg font-semibold text-slate-300">Mercado Financeiro</span>
            </div>
            <div className="flex gap-6">
              <div className="text-right">
                <div className="text-xs text-slate-400">IBOVESPA</div>
                <div className="text-lg font-bold text-emerald-400 flex items-center gap-1">
                  +1.12% <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">BITCOIN</div>
                <div className="text-lg font-bold text-emerald-400 flex items-center gap-1">
                  +2.45% <TrendingUp className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Percent className="h-8 w-8 text-[#00beea]" />
              <span className="text-lg font-semibold text-slate-300">Taxas Básicas</span>
            </div>
            <div className="flex gap-6">
              <div className="text-right">
                <div className="text-xs text-slate-400">SELIC</div>
                <div className="text-lg font-bold text-white">10.50% a.a.</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">CDI</div>
                <div className="text-lg font-bold text-white">10.40% a.a.</div>
              </div>
            </div>
          </div>
        );
      case 4:
      default:
        return (
          <div className="flex items-center gap-3 w-full">
            <Megaphone className="h-8 w-8 text-[#00beea] shrink-0" />
            <div className="truncate">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Aviso Rápido</div>
              <div className="text-lg font-semibold text-white truncate">
                Manutenção dos elevadores sociais programada para quarta-feira.
              </div>
            </div>
          </div>
        );
    }
  };

  const renderTextualLayout = (camp: Campanha, normalTipo: string) => {
    let bgClass = "bg-gradient-to-b from-[#0f172a] to-[#1e293b]";
    let badgeClass = "bg-[#00beea]/20 text-[#00beea] border border-[#00beea]/30";
    let IconComponent = Megaphone;

    switch (normalTipo) {
      case "patrocinado":
        bgClass = "bg-gradient-to-b from-[#0f172a] to-[#2e1a47]";
        badgeClass = "bg-purple-500/20 text-purple-300 border border-purple-500/30";
        IconComponent = Award;
        break;
      case "voce_sabia":
        bgClass = "bg-gradient-to-b from-[#0f172a] to-[#0d344d]";
        badgeClass = "bg-amber-500/20 text-amber-400 border border-amber-500/30";
        IconComponent = Award;
        break;
      case "saude":
        bgClass = "bg-gradient-to-b from-[#0f172a] to-[#14422e]";
        badgeClass = "bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30";
        IconComponent = Heart;
        break;
      case "financas":
        bgClass = "bg-gradient-to-b from-[#0f172a] to-[#3b2a0c]";
        badgeClass = "bg-amber-400/20 text-amber-300 border border-amber-400/30";
        IconComponent = Coins;
        break;
      case "evento":
        bgClass = "bg-gradient-to-b from-[#0f172a] to-[#4c1d95]";
        badgeClass = "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30";
        IconComponent = Calendar;
        break;
      case "anuncio":
        return (
          <div className="h-full flex flex-col justify-between p-8 border-2 border-dashed border-[#00beea]/30 rounded-3xl m-2 bg-slate-900/50">
            <div className="space-y-4 text-center my-auto">
              <Megaphone className="h-16 w-16 text-[#00beea] mx-auto animate-bounce" />
              <h2 className="text-3xl font-extrabold text-white leading-tight">
                {camp.titulo}
              </h2>
              <p className="text-slate-300 text-base max-w-sm mx-auto">
                {camp.descricao}
              </p>
            </div>
            <div className="bg-[#00beea]/10 rounded-2xl p-4 text-center text-sm text-[#00beea] font-semibold">
              Fale com a administração pelo app ou no ramal 100
            </div>
          </div>
        );
      default:
        break;
    }

    return (
      <div className={`h-full flex flex-col justify-between p-8 ${bgClass}`}>
        <div className="space-y-4">
          <span className={`${badgeClass} text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full flex w-max items-center gap-1.5`}>
            <IconComponent className="h-3.5 w-3.5" /> {normalTipo === "patrocinado" ? "📣 PATROCINADO" : (TIPO_LABELS[normalTipo] || camp.tipo)}
          </span>
          <h2 className="text-3xl font-extrabold text-white leading-tight">
            {camp.titulo}
          </h2>
          <p className="text-slate-300 text-base leading-relaxed">
            {camp.descricao}
          </p>
        </div>
      </div>
    );
  };

  // Center slides (dynamic duration)
  const renderCenterContent = () => {
    const camp = campaigns[centerIndex];
    if (!camp) {
      return (
        <div className="h-full flex flex-col justify-center items-center p-8 text-center bg-slate-950/40">
          <Info className="h-12 w-12 text-[#00beea] mb-3 animate-pulse" />
          <h2 className="text-xl font-bold text-white">Playlist Vazia</h2>
          <p className="text-slate-400 text-xs mt-1">Nenhuma campanha cadastrada ou ativa nesta playlist.</p>
        </div>
      );
    }

    const showImage = camp.imagemUrl && !imageErrors[camp.id];
    const normalTipo = (camp.tipo || "comunicado").toLowerCase();

    if (showImage) {
      return (
        <div className="h-full w-full relative flex flex-col justify-end">
          <img
            src={camp.imagemUrl!}
            alt={camp.titulo}
            onError={() => handleImageError(camp.id)}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Gradiente escuro no topo para legibilidade do clima/cidade */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-slate-950 via-slate-950/20 to-transparent pointer-events-none" />
          {/* Gradiente escuro no rodapé para legibilidade do QR/assinatura */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none" />
          
          {/* Bloco escuro translúcido com backdrop-blur para legibilidade do texto */}
          <div className="relative z-10 bg-slate-950/65 backdrop-blur-md border border-white/10 rounded-2xl p-6 m-6 space-y-3">
            <div>
              <span className="bg-[#00beea]/80 text-slate-950 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                {normalTipo === "patrocinado" ? "📣 PATROCINADO" : (TIPO_LABELS[normalTipo] || camp.tipo || "Comunicado")}
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-white leading-tight drop-shadow-md">
              {camp.titulo}
            </h2>
            <p className="text-slate-200 text-sm leading-relaxed drop-shadow-sm">
              {camp.descricao}
            </p>
          </div>
        </div>
      );
    }

    return renderTextualLayout(camp, normalTipo);
  };

  // Footer widgets (8s)
  const renderFooterContent = () => {
    switch (footerIndex) {
      case 0:
        return (
          <div className="flex items-center justify-between w-full">
            <div className="space-y-1">
              <div className="text-sm font-bold text-white">Baixe o App TreeCondo</div>
              <div className="text-xs text-slate-400">Gerencie correspondências e reservas</div>
            </div>
            <div className="bg-white p-1 rounded-lg shrink-0 w-14 h-14 flex items-center justify-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-12 h-12" />
              ) : (
                <QrCode className="h-12 w-12 text-[#0f172a]" />
              )}
            </div>
          </div>
        );
      case 1:
        return (
          <div className="flex items-center justify-between w-full">
            <div className="space-y-1">
              <div className="text-sm font-bold text-white">Próxima Reunião de Conselho</div>
              <div className="text-xs text-slate-400">Segunda-feira, às 20h00 no Salão Nobre</div>
            </div>
            <div className="bg-[#00beea]/20 p-2 rounded-xl text-[#00beea]">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="flex items-center justify-between w-full">
            <div className="space-y-1">
              <div className="text-sm font-bold text-[#00beea]">Parceiro Local</div>
              <div className="text-xs text-slate-300 font-medium">Lavanderia Express: 15% OFF para moradores</div>
            </div>
            <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400">
              <Percent className="h-6 w-6" />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="flex items-center justify-between w-full">
            <div className="space-y-1">
              <div className="text-sm font-bold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Comunicado Crítico
              </div>
              <div className="text-xs text-slate-300 truncate">Vazamento na prumada do Bloco B resolvido.</div>
            </div>
          </div>
        );
      case 4:
      default:
        return (
          <div className="flex items-center justify-between w-full">
            <div className="space-y-1">
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#22C55E]" /> Segurança em Primeiro Lugar
              </div>
              <div className="text-xs text-slate-400">Não autorize a entrada de prestadores sem cadastro.</div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black flex flex-col justify-between overflow-hidden p-0 cursor-none select-none">
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          width: 100vw !important;
          height: 100vh !important;
          overflow: hidden !important;
          background: #000 !important;
          cursor: none !important;
          user-select: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `}} />
      
      {/* Glow Effects */}
      <div className="absolute top-0 -left-1/4 w-[150%] h-[30%] bg-gradient-to-b from-[#00beea]/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -left-1/4 w-[150%] h-[20%] bg-gradient-to-t from-[#22C55E]/5 to-transparent blur-3xl pointer-events-none" />

      {/* 1. TOPO ROTATIVO (HEADER) */}
      <header className="h-[12%] shrink-0 border-b border-white/10 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center relative z-10">
        <div className={`w-full transition-all duration-500 ease-in-out ${headerFade ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}>
          {renderHeaderContent()}
        </div>
      </header>

      {/* 2. CONTEÚDO PRINCIPAL (CENTER) */}
      <main className="flex-1 min-h-0 bg-slate-950/40 relative z-10 flex flex-col justify-center">
        <div className={`h-full w-full transition-all duration-500 ease-in-out ${centerFade ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          {renderCenterContent()}
        </div>
      </main>

      {/* 3. RODAPÉ ROTATIVO (FOOTER) */}
      <footer className="h-[16%] shrink-0 border-t border-white/10 bg-slate-900/70 backdrop-blur-md flex flex-col justify-between p-6 relative z-10">
        
        {/* Main Footer Widget */}
        <div className={`w-full transition-all duration-500 ease-in-out ${footerFade ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
          {renderFooterContent()}
        </div>

        {/* Sub-footer bottom bar (Time, Pairing Code and Logo) */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2 text-[10px] text-slate-500 font-medium tracking-wider uppercase">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-[#00beea]" /> {currentTime || "00:00:00"}
          </div>
          <div>
            ID: {codigo === "demo" ? "DEMO-MODE" : codigo}
          </div>
          <div className="text-[#00beea] font-extrabold flex items-center gap-0.5">
            <Tv className="h-3 w-3" /> TreeMídia
          </div>
        </div>
      </footer>

    </div>
  );
}
