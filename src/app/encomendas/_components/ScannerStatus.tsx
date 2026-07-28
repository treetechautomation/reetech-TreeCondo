"use client";

import React from "react";

export type ScannerState =
  | "PRONTO_PARA_ESCANEAR"
  | "LENDO"
  | "CODIGO_DETECTADO"
  | "VERIFICANDO"
  | "AGUARDANDO_UNIDADE"
  | "SALVANDO"
  | "REGISTRADO"
  | "ERRO";

const labels: Record<ScannerState, string> = {
  PRONTO_PARA_ESCANEAR: "Aproxime o código do leitor",
  LENDO: "Lendo código...",
  CODIGO_DETECTADO: "Código detectado!",
  VERIFICANDO: "Verificando duplicidade...",
  AGUARDANDO_UNIDADE: "Selecione a unidade",
  SALVANDO: "Salvando...",
  REGISTRADO: "Encomenda registrada!",
  ERRO: "Erro ao processar",
};

interface ScannerStatusProps {
  state: ScannerState;
  errorMsg?: string;
}

export const ScannerStatus: React.FC<ScannerStatusProps> = ({ state, errorMsg }) => {
  const isError = state === "ERRO";
  const isSuccess = state === "REGISTRADO";

  return (
    <div
      className={`text-xs text-center py-1 px-2 rounded ${
        isError ? "bg-red-50 text-red-600" :
        isSuccess ? "bg-green-50 text-green-600" :
        "bg-slate-50 text-slate-500"
      }`}
    >
      {isError && errorMsg ? errorMsg : labels[state]}
    </div>
  );
};
