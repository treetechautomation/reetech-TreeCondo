"use client";

import React from "react";

interface EncomendasHeaderProps {
  isOperador: boolean;
  pendingCount: number;
  onOpenCreate: () => void;
}

export const EncomendasHeader: React.FC<EncomendasHeaderProps> = ({
  isOperador,
  pendingCount,
  onOpenCreate,
}) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-xl font-bold">Encomendas</h1>
        {pendingCount > 0 && (
          <span className="text-sm text-slate-500">
            {pendingCount} aguardando retirada
          </span>
        )}
      </div>
      {isOperador && (
        <button
          onClick={onOpenCreate}
          className="px-4 py-2 bg-[#00D0E6] text-white rounded-lg text-sm font-semibold hover:bg-[#00B8CC]"
        >
          + Nova Encomenda
        </button>
      )}
    </div>
  );
};
