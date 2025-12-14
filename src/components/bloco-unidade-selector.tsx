"use client";

import React from "react";
import { useCondominio } from "@/contexts/CondominioContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export function BlocoUnidadeSelector() {
  const {
    vinculoAtivo,
    isLoadingVinculos,
    blocos,
    isLoadingBlocos,
    blocoAtivoId,
    setBlocoAtivoId,
    unidades,
    isLoadingUnidades,
    unidadeAtivaId,
    setUnidadeAtivaId,
  } = useCondominio();

  const isMorador = vinculoAtivo?.role === "MORADOR";

  if (isLoadingVinculos) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // Não renderiza nada se não houver um vínculo ativo (nenhum condomínio selecionado)
  if (!vinculoAtivo) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Seletor de Bloco */}
      <Select
        value={blocoAtivoId ?? ""}
        onValueChange={(value) => {
          setBlocoAtivoId(value);
          setUnidadeAtivaId(null); // Reseta a unidade ao trocar de bloco
        }}
        disabled={isMorador || isLoadingBlocos || blocos.length === 0}
      >
        <SelectTrigger>
          <SelectValue placeholder={isLoadingBlocos ? "Carregando..." : "Selecione o Bloco"} />
        </SelectTrigger>
        <SelectContent>
          {blocos.map((bloco) => (
            <SelectItem key={bloco.id} value={bloco.id}>
              {bloco.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Seletor de Unidade */}
      <Select
        value={unidadeAtivaId ?? ""}
        onValueChange={setUnidadeAtivaId}
        disabled={isMorador || isLoadingUnidades || unidades.length === 0 || !blocoAtivoId}
      >
        <SelectTrigger>
          <SelectValue placeholder={isLoadingUnidades ? "Carregando..." : "Selecione a Unidade"} />
        </SelectTrigger>
        <SelectContent>
          {unidades.map((unidade) => (
            <SelectItem key={unidade.id} value={unidade.id}>
              Unidade {unidade.numero}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
