"use client";

import React, { useState } from "react";
import { Info, HelpCircle } from "lucide-react";

type MapArea = {
  key: string;
  name: string;
  polygon: string;
  walls: string[];
  labelX: number;
  labelY: number;
};

// 4 areas corresponding to typical condo layouts
const MAP_AREAS: MapArea[] = [
  {
    key: "salao",
    name: "Salão de Festas",
    // Isometric diamond skewed
    polygon: "M 300 80 L 440 150 L 300 220 L 160 150 Z",
    walls: [
      "M 160 150 L 300 220 L 300 245 L 160 175 Z", // Left wall front
      "M 300 220 L 440 150 L 440 175 L 300 245 Z", // Right wall front
    ],
    labelX: 300,
    labelY: 140,
  },
  {
    key: "churrasqueira",
    name: "Espaço Churrasqueira",
    polygon: "M 150 160 L 250 210 L 150 260 L 50 210 Z",
    walls: [
      "M 50 210 L 150 260 L 150 280 L 50 230 Z",
      "M 150 260 L 250 210 L 250 230 L 150 280 Z",
    ],
    labelX: 150,
    labelY: 205,
  },
  {
    key: "quadra",
    name: "Quadra Poliesportiva",
    polygon: "M 450 160 L 550 210 L 450 260 L 350 210 Z",
    walls: [
      "M 350 210 L 450 260 L 450 280 L 350 230 Z",
      "M 450 260 L 550 210 L 550 230 L 450 280 Z",
    ],
    labelX: 450,
    labelY: 205,
  },
  {
    key: "piscina",
    name: "Piscina Adulto & Infantil",
    polygon: "M 300 210 L 400 260 L 300 310 L 200 260 Z",
    walls: [
      "M 200 260 L 300 310 L 300 330 L 200 280 Z",
      "M 300 310 L 400 260 L 400 280 L 300 330 Z",
    ],
    labelX: 300,
    labelY: 255,
  },
];

interface AreaInteractiveMapProps {
  areas: any[];
  selectedAreaId: string;
  onSelectArea: (area: any) => void;
  slotsDoDia: Record<string, any>;
}

export default function AreaInteractiveMap({
  areas,
  selectedAreaId,
  onSelectArea,
  slotsDoDia,
}: AreaInteractiveMapProps) {
  const [hoveredMapArea, setHoveredMapArea] = useState<MapArea | null>(null);

  // Soft-matches loaded database areas to the isometric map definition
  const matchDbArea = (mapKey: string) => {
    return areas.find((a) => {
      const lowerName = (a.nome || "").toLowerCase();
      const lowerId = (a.id || "").toLowerCase();
      
      if (mapKey === "salao") {
        return lowerName.includes("salao") || lowerName.includes("salão") || lowerId.includes("salao");
      }
      if (mapKey === "churrasqueira") {
        return lowerName.includes("churra") || lowerId.includes("churra");
      }
      if (mapKey === "quadra") {
        return lowerName.includes("quadra") || lowerName.includes("campo") || lowerId.includes("quadra") || lowerId.includes("campo");
      }
      if (mapKey === "piscina") {
        return lowerName.includes("piscina") || lowerId.includes("piscina");
      }
      return false;
    });
  };

  return (
    <div className="border border-white/10 bg-slate-950/40 backdrop-blur-2xl rounded-3xl p-5 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#00D0E6] animate-pulse" />
            Mapa Interativo das Áreas Comuns
          </h4>
          <p className="text-[10px] text-white/40 mt-0.5">
            Selecione uma área no mapa 3D para verificar horários e agendar.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-white/60">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/40 inline-block" />
            <span>Livre</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-500/40 inline-block" />
            <span>Fila</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-red-500/20 border border-red-500/40 inline-block" />
            <span>Ocupado</span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-hidden border border-white/5 bg-slate-950/70 rounded-2xl flex items-center justify-center p-2 sm:p-4">
        {/* Main Isometric SVG */}
        <svg
          viewBox="0 0 600 370"
          className="w-full h-auto max-w-[550px] overflow-visible select-none"
        >
          {/* Neon filter for glowing objects */}
          <defs>
            <filter id="neon-glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="neon-glow-green" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="neon-glow-amber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="neon-glow-red" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid Background Lines for Tech HUD look */}
          <g stroke="rgba(255,255,255,0.03)" strokeWidth="0.5">
            {/* Draw diagonal grid lines */}
            {Array.from({ length: 14 }).map((_, i) => (
              <line key={`g1-${i}`} x1={-100 + i * 60} y1={-50} x2={500 + i * 60} y2={370} />
            ))}
            {Array.from({ length: 14 }).map((_, i) => (
              <line key={`g2-${i}`} x1={700 - i * 60} y1={-50} x2={100 - i * 60} y2={370} />
            ))}
          </g>

          {/* Map Areas Rendering */}
          {MAP_AREAS.map((mapArea) => {
            const dbArea = matchDbArea(mapArea.key);
            if (!dbArea) return null;

            // Fetch availability state
            const slotDaArea = slotsDoDia[String(dbArea.id)] || { occupied: false, filaCount: 0 };
            const filaCountDaArea = Number(slotDaArea.filaCount || 0) || 0;
            const occupiedDaArea = Boolean(slotDaArea.occupied === true);
            
            const isSelected = selectedAreaId === dbArea.id;
            const isHovered = hoveredMapArea?.key === mapArea.key;

            let statusColor = "rgba(16, 185, 129, 0.15)"; // Green base (available)
            let strokeColor = "rgba(16, 185, 129, 0.4)";
            let statusFilter = "";

            if (filaCountDaArea >= 3) {
              statusColor = "rgba(239, 68, 68, 0.15)"; // Red base (unavailable)
              strokeColor = "rgba(239, 68, 68, 0.4)";
              if (isHovered) statusFilter = "url(#neon-glow-red)";
            } else if (occupiedDaArea || filaCountDaArea > 0) {
              statusColor = "rgba(245, 158, 11, 0.15)"; // Amber base (queued)
              strokeColor = "rgba(245, 158, 11, 0.4)";
              if (isHovered) statusFilter = "url(#neon-glow-amber)";
            } else {
              if (isHovered) statusFilter = "url(#neon-glow-green)";
            }

            // Highlighting selection with Neon Cyan overrides
            if (isSelected) {
              statusColor = "rgba(0, 208, 230, 0.25)";
              strokeColor = "#00D0E6";
              statusFilter = "url(#neon-glow-cyan)";
            }

            return (
              <g
                key={mapArea.key}
                className="cursor-pointer transition-all duration-300"
                onClick={() => onSelectArea(dbArea)}
                onMouseEnter={() => setHoveredMapArea(mapArea)}
                onMouseLeave={() => setHoveredMapArea(null)}
              >
                {/* 3D Walls details to give depth */}
                {mapArea.walls.map((wallPath, index) => (
                  <path
                    key={index}
                    d={wallPath}
                    fill={isSelected ? "rgba(0,208,230,0.15)" : "rgba(255,255,255,0.02)"}
                    stroke={isSelected ? "#00D0E6" : "rgba(255,255,255,0.1)"}
                    strokeWidth="1"
                    className="transition-all duration-300"
                  />
                ))}

                {/* Flat Isometric Floor Polygon */}
                <path
                  d={mapArea.polygon}
                  fill={statusColor}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? "2.5" : isHovered ? "1.5" : "1"}
                  filter={statusFilter}
                  className="transition-all duration-300"
                />

                {/* Draw Court details if it's Quadra */}
                {mapArea.key === "quadra" && (
                  <path
                    d="M 450 180 L 510 210 L 450 240 L 390 210 Z"
                    fill="transparent"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="1"
                    pointerEvents="none"
                  />
                )}

                {/* Draw pool ripple details if it's Piscina */}
                {mapArea.key === "piscina" && (
                  <g pointerEvents="none" stroke="rgba(0, 208, 230, 0.2)" strokeWidth="0.5" fill="none">
                    <path d="M 270 245 Q 300 260 330 245" />
                    <path d="M 280 275 Q 300 285 320 275" />
                  </g>
                )}

                {/* Label text placed in isometric center */}
                <g pointerEvents="none">
                  {/* Subtle glass background behind the text */}
                  <rect
                    x={mapArea.labelX - 55}
                    y={mapArea.labelY - 10}
                    width="110"
                    height="18"
                    rx="6"
                    fill="rgba(15, 23, 42, 0.6)"
                    stroke={isSelected ? "rgba(0, 208, 230, 0.3)" : "rgba(255, 255, 255, 0.05)"}
                    strokeWidth="0.5"
                    className="transition-all duration-300"
                  />
                  <text
                    x={mapArea.labelX}
                    y={mapArea.labelY + 2}
                    textAnchor="middle"
                    fill={isSelected ? "#00D0E6" : isHovered ? "#fff" : "rgba(255,255,255,0.7)"}
                    className="text-[9px] font-black tracking-wide"
                  >
                    {dbArea.nome}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Float Popup Info Panel */}
        {hoveredMapArea && (() => {
          const dbArea = matchDbArea(hoveredMapArea.key);
          if (!dbArea) return null;

          const slot = slotsDoDia[String(dbArea.id)] || { occupied: false, filaCount: 0 };
          const isOccupied = Boolean(slot.occupied);
          const queue = Number(slot.filaCount || 0);
          
          let statusText = "Disponível";
          let statusBadgeColor = "bg-emerald-500/20 text-emerald-400";
          if (queue >= 3) {
            statusText = "Indisponível (Limite excedido)";
            statusBadgeColor = "bg-red-500/20 text-red-400";
          } else if (isOccupied || queue > 0) {
            statusText = `Fila de Espera (${queue}/3)`;
            statusBadgeColor = "bg-amber-500/20 text-amber-400";
          }

          const priceText = dbArea.preco ? `${(dbArea.preco / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : "Grátis";

          return (
            <div className="absolute top-2 left-2 right-2 sm:right-auto sm:w-60 p-3.5 bg-slate-900/90 border border-white/10 backdrop-blur-xl rounded-2xl shadow-xl text-white animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-black text-xs">{dbArea.nome}</span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${statusBadgeColor}`}>
                  {statusText}
                </span>
              </div>
              <p className="text-[10px] text-white/50 leading-relaxed mb-2.5">
                {dbArea.descricao || "Área comum de lazer sujeita à reserva antecipada."}
              </p>
              <div className="flex justify-between items-center text-[10px] border-t border-white/5 pt-2 font-semibold">
                <span className="text-white/40">Taxa de Reserva:</span>
                <span className="text-[#00D0E6]">{priceText}</span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
