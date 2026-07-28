"use client";

import React from "react";

export type EncomendaCardData = {
  id: string;
  status: string;
  codigo?: string;
  transportadora?: string;
  unidadeId?: string;
  blocoId?: string;
  chegouEm?: any;
  retiradaEm?: any;
};

interface EncomendaCardProps {
  pkg: EncomendaCardData;
  isOperador: boolean;
  onRetirar: (pkg: EncomendaCardData) => void;
  onShowQR: (pkg: EncomendaCardData) => void;
  onOpenInfo: (pkg: EncomendaCardData) => void;
}

export const EncomendaCard: React.FC<EncomendaCardProps> = ({
  pkg,
  isOperador,
  onRetirar,
  onShowQR,
  onOpenInfo,
}) => {
  const isPendente = pkg.status === "AGUARDANDO_RETIRADA" || pkg.status === "PENDENTE" || pkg.status === "AGUARDANDO";
  const statusColor = isPendente ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800";

  return (
    <div
      className="border rounded-lg p-3 bg-white hover:shadow-sm cursor-pointer"
      onClick={() => onOpenInfo(pkg)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
              {isPendente ? "Pendente" : pkg.status === "RETIRADA" ? "Retirada" : pkg.status}
            </span>
            {pkg.transportadora && (
              <span className="text-xs text-slate-500">{pkg.transportadora}</span>
            )}
          </div>
          <div className="mt-1 text-sm font-medium truncate">
            {pkg.unidadeId && <span>Unidade {pkg.unidadeId}</span>}
            {pkg.blocoId && <span> Bl. {pkg.blocoId}</span>}
          </div>
          {pkg.codigo && (
            <div className="text-xs text-slate-400 truncate mt-0.5">{pkg.codigo}</div>
          )}
        </div>
        {isOperador && isPendente && (
          <div className="flex gap-1 ml-2 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onRetirar(pkg); }}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
            >
              Retirar
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onShowQR(pkg); }}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              QR
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
