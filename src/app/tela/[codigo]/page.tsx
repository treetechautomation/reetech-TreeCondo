import * as React from "react";
import { adminDb } from "@/lib/firebaseAdmin";
import PlayerClient from "./PlayerClient";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

type ScreenProps = {
  codigo: string;
  nome: string;
  local: string;
  status: string;
  playlistId: string | null;
  playlistNome: string | null;
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

export default async function PlayerPage({ params }: { params: Promise<{ codigo: string }> }) {
  const resolvedParams = await params;
  const codigo = resolvedParams?.codigo;

  // Demo mode fallback with pre-defined campaigns
  if (codigo === "demo") {
    const demoScreen: ScreenProps = {
      codigo: "demo",
      nome: "Demonstração",
      local: "Elevador Principal",
      status: "online",
      playlistId: "demo-playlist",
      playlistNome: "Playlist Demonstrativa"
    };

    const demoCampaigns = [
      {
        id: "demo-1",
        titulo: "Assembleia Geral Ordinária",
        descricao: "Convocamos todos os condôminos a participarem da assembleia anual. Sua presença é fundamental para a tomada de decisões importantes do nosso condomínio. Data: 25 de Junho de 2026 às 19h30.",
        tipo: "comunicado",
        imagemUrl: null,
        duracaoSegundos: 15,
        prioridade: 10,
        ordem: 0
      },
      {
        id: "demo-2",
        titulo: "Origem dos Elevadores Residenciais",
        descricao: "O primeiro elevador de passageiros comercial seguro foi instalado por Elisha Otis em Nova York no ano de 1857. Essa tecnologia revolucionou a arquitetura urbana.",
        tipo: "voce_sabia",
        imagemUrl: null,
        duracaoSegundos: 10,
        prioridade: 5,
        ordem: 1
      },
      {
        id: "demo-3",
        titulo: "Suba Escadas para Mais Longevidade",
        descricao: "Subir escadas por apenas 5 minutos ao dia melhora o condicionamento cardiovascular e reduz os riscos de problemas cardíacos em até 20%. Troque o elevador pelas escadas às vezes!",
        tipo: "saude",
        imagemUrl: null,
        duracaoSegundos: 12,
        prioridade: 7,
        ordem: 2
      },
      {
        id: "demo-4",
        titulo: "Economia Silenciosa no Lar",
        descricao: "Aparelhos em modo stand-by podem representar até 12% do consumo total de energia da sua residência. Desconecte eletrodomésticos que não usa com frequência.",
        tipo: "financas",
        imagemUrl: null,
        duracaoSegundos: 15,
        prioridade: 6,
        ordem: 3
      },
      {
        id: "demo-5",
        titulo: "Divulgue Aqui Sua Marca",
        descricao: "Coloque sua empresa ou serviços em destaque nesta tela e alcance centenas de moradores todos os dias. Fale com a administração pelo app ou no ramal 100.",
        tipo: "anuncio",
        imagemUrl: null,
        duracaoSegundos: 10,
        prioridade: 8,
        ordem: 4
      },
      {
        id: "demo-6",
        titulo: "Nossa Festa Junina Está Chegando!",
        descricao: "Prepare sua roupa caipira. Teremos comidas típicas, quadrilha, brincadeiras para as crianças e música ao vivo. Sábado, 28 de Junho na Quadra Poliesportiva a partir das 17h.",
        tipo: "evento",
        imagemUrl: null,
        duracaoSegundos: 15,
        prioridade: 9,
        ordem: 5
      }
    ];

    return <PlayerClient codigo="demo" screen={demoScreen} campaigns={demoCampaigns} />;
  }

  try {
    const db = adminDb();

    // Query for the screen by scanning active condominium collections sequentially
    const condominiosSnap = await db.collection("condominios").get();
    let telaDoc = null;
    let condoId = null;

    for (const condoDoc of condominiosSnap.docs) {
      const telasSnap = await db.collection("condominios")
        .doc(condoDoc.id)
        .collection("treemidia_telas")
        .where("codigo", "==", codigo)
        .limit(1)
        .get();

      if (!telasSnap.empty) {
        telaDoc = telasSnap.docs[0];
        condoId = condoDoc.id;
        break;
      }
    }

    if (!telaDoc || !condoId) {
      return <ScreenErrorPage message="Tela não encontrada" codigo={codigo} />;
    }

    const telaData = telaDoc.data();
    const screenObj: ScreenProps = {
      codigo: telaData.codigo || codigo,
      nome: telaData.nome || "Tela sem nome",
      local: telaData.local || "Não informado",
      status: telaData.status || "offline",
      playlistId: telaData.playlistId || null,
      playlistNome: telaData.playlistNome || null,
    };

    if (!screenObj.playlistId) {
      return <ScreenErrorPage message="Nenhuma playlist vinculada" codigo={codigo} />;
    }

    // Fetch playlist
    const playlistDoc = await db.collection("condominios")
      .doc(condoId)
      .collection("treemidia_playlists")
      .doc(screenObj.playlistId)
      .get();

    if (!playlistDoc.exists) {
      return <ScreenErrorPage message="Nenhuma playlist vinculada" codigo={codigo} />;
    }

    const playlistData = playlistDoc.data()!;
    if (!playlistData.ativo) {
      return <ScreenErrorPage message="Nenhuma playlist vinculada" codigo={codigo} />;
    }

    const playlistCampaignItems = playlistData.campanhas || [];

    // Fetch all active campaigns in the condominium
    const campaignsSnap = await db.collection("condominios")
      .doc(condoId)
      .collection("treemidia_campanhas")
      .where("ativo", "==", true)
      .get();

    const activeCampaignsMap = new Map();
    campaignsSnap.forEach((doc) => {
      activeCampaignsMap.set(doc.id, doc.data());
    });

    // Filter and map playlist campaigns, discarding any deleted/inactive ones (Fallbacks / Campanha removida)
    const resolvedCampaigns = playlistCampaignItems
      .filter((item: any) => {
        if (!activeCampaignsMap.has(item.campanhaId)) return false;
        const realCamp = activeCampaignsMap.get(item.campanhaId);
        
        const now = new Date();
        if (realCamp.dataInicio) {
          const start = typeof realCamp.dataInicio.toDate === "function" 
            ? realCamp.dataInicio.toDate() 
            : new Date(realCamp.dataInicio.seconds * 1000);
          if (now < start) return false;
        }
        if (realCamp.dataFim) {
          const end = typeof realCamp.dataFim.toDate === "function" 
            ? realCamp.dataFim.toDate() 
            : new Date(realCamp.dataFim.seconds * 1000);
          if (now > end) return false;
        }
        
        return true;
      })
      .map((item: any) => {
        const realCamp = activeCampaignsMap.get(item.campanhaId);
        const tipoFinal = realCamp.tipo || item.tipo || "comunicado";
        const duracaoManual = realCamp.duracaoSegundos ?? item.duracaoSegundos;
        const duracaoFinal = (typeof duracaoManual === "number" && duracaoManual > 0)
          ? duracaoManual
          : getDuracaoPadrao(tipoFinal);

        return {
          id: item.campanhaId,
          titulo: realCamp.titulo || item.titulo || "Informativo",
          descricao: realCamp.descricao || item.descricao || "",
          tipo: tipoFinal,
          imagemUrl: realCamp.imagemUrl || null,
          duracaoSegundos: duracaoFinal,
          prioridade: realCamp.prioridade ?? item.prioridade ?? 5,
          ordem: item.ordem ?? 0,
        };
      })
      .sort((a: any, b: any) => a.ordem - b.ordem);

    // Fetch configuration
    const configDoc = await db.collection("condominios")
      .doc(condoId)
      .collection("config")
      .doc("treemidia")
      .get();
    const configData = configDoc.exists ? configDoc.data() : {};
    const urlQrCode = configData?.urlQrCode || null;

    // Fetch condominium info (cidade/estado)
    const condoDoc = await db.collection("condominios").doc(condoId).get();
    const condoData = condoDoc.data() || {};
    const cidade = configData?.cidade || condoData.cidade || "";
    const estado = configData?.estado || condoData.estado || "";

    if (resolvedCampaigns.length === 0) {
      return <ScreenErrorPage message="Nenhuma playlist vinculada" codigo={codigo} />;
    }

    return (
      <PlayerClient 
        codigo={codigo} 
        screen={screenObj} 
        campaigns={resolvedCampaigns} 
        urlQrCode={urlQrCode}
        cidade={cidade}
        estado={estado}
      />
    );
  } catch (err: any) {
    console.error("[PlayerPage] Erro ao carregar player:", err);
    return <ScreenErrorPage message={`Erro de conexão com o banco de dados: ${err.message}`} codigo={codigo} />;
  }
}

function ScreenErrorPage({ message, codigo }: { message: string; codigo: string }) {
  return (
    <div className="fixed inset-0 w-screen h-screen bg-black flex flex-col justify-center items-center overflow-hidden p-8 text-center select-none">
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
      <div className="space-y-6 my-auto max-w-md">
        <div className="mx-auto w-16 h-16 bg-red-500/10 border border-red-500/30 text-red-500 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-white uppercase tracking-wider">Erro no Player</h1>
        <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
          {message}
        </p>
        <div className="text-[10px] text-slate-500 font-medium tracking-wider uppercase bg-black/25 py-2 px-4 rounded-xl border border-white/5 w-fit mx-auto">
          Código: {codigo}
        </div>
      </div>
    </div>
  );
}
