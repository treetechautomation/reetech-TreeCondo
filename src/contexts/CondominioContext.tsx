
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { useSessionCtx } from "./SessionContext";

export type Vinculo = {
  id: string; // condominioId
  condominioId: string;
  condominioNome: string;
  role: "SINDICO" | "MORADOR" | "PORTEIRO";
  status: "ATIVO" | "INATIVO" | "PENDENTE";
  blocoId?: string;
  unidadeId?: string;
};

export type Bloco = {
    id: string;
    nome: string;
    ordem: number;
}

export type Unidade = {
    id: string;
    numero: string;
    andar: number;
}

interface CondominioContextType {
  // Condominio
  condominioAtivoId: string | null;
  setCondominioAtivoId: (id: string | null) => void;
  vinculos: Vinculo[];
  isLoadingVinculos: boolean;
  vinculoAtivo: Vinculo | null;

  // Bloco
  blocoAtivoId: string | null;
  setBlocoAtivoId: (id: string | null) => void;
  blocos: Bloco[];
  isLoadingBlocos: boolean;

  // Unidade
  unidadeAtivaId: string | null;
  setUnidadeAtivaId: (id: string | null) => void;
  unidades: Unidade[];
  isLoadingUnidades: boolean;
}

const CondominioContext = createContext<CondominioContextType | undefined>(
  undefined
);

export function CondominioProvider({ children }: { children: ReactNode }) {
  const { session, isSessionLoading, setActiveCondominioId } = useSessionCtx();
  const condominioAtivoId = session?.activeCondominioId ?? null;
  const firestore = useFirestore();
  
  // State
    const [blocoAtivoId, setBlocoAtivoId] = useState<string | null>(null);
  const [unidadeAtivaId, setUnidadeAtivaId] = useState<string | null>(null);

  // Vinculos do usuário logado (agora vem da sessão)
  const vinculos = useMemo(() => (session?.vinculos as Vinculo[]) || [], [session]);
  const isLoadingVinculos = isSessionLoading;

  const vinculoAtivo = React.useMemo(() => {
    return vinculos?.find((v: Vinculo) => v.condominioId === condominioAtivoId) ?? null;
  }, [vinculos, condominioAtivoId]);


  // Blocos do condomínio ativo
  const blocosRef = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId) return null;
    return query(collection(firestore, `condominios/${condominioAtivoId}/blocos`), orderBy('ordem'));
  }, [firestore, condominioAtivoId]);
  const { data: blocos, isLoading: isLoadingBlocos } = useCollection<Omit<Bloco, 'id'>>(blocosRef);


  // Unidades do bloco ativo
  const unidadesRef = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId || !blocoAtivoId) return null;
    return query(collection(firestore, `condominios/${condominioAtivoId}/blocos/${blocoAtivoId}/unidades`), orderBy('numero'));
  }, [firestore, condominioAtivoId, blocoAtivoId]);
  const { data: unidades, isLoading: isLoadingUnidades } = useCollection<Omit<Unidade, 'id'>>(unidadesRef);
  
  // Efeito para carregar o condomínio ativo do localStorage ou usar o primeiro vínculo
    // Efeito para auto-selecionar bloco e unidade se o usuário for MORADOR
  useEffect(() => {
    if (vinculoAtivo?.role === 'MORADOR' && vinculoAtivo.blocoId && vinculoAtivo.unidadeId) {
        setBlocoAtivoId(vinculoAtivo.blocoId);
        setUnidadeAtivaId(vinculoAtivo.unidadeId);
    }
  }, [vinculoAtivo]);

  // Handler para trocar de condomínio
  const setCondominioAtivoId = (id: string | null) => {
    if (id) setActiveCondominioId(id);
  };

  const value = {
    // Condominio
    condominioAtivoId,
    setCondominioAtivoId,
    vinculos: vinculos || [],
    isLoadingVinculos,
    vinculoAtivo,

    // Bloco
    blocoAtivoId,
    setBlocoAtivoId,
    blocos: blocos || [],
    isLoadingBlocos,

    // Unidade
    unidadeAtivaId,
    setUnidadeAtivaId,
    unidades: unidades || [],
    isLoadingUnidades,
  };

  return (
    <CondominioContext.Provider value={value}>
      {children}
    </CondominioContext.Provider>
  );
}

export function useCondominio() {
  const context = useContext(CondominioContext);
  if (context === undefined) {
    throw new Error("useCondominio must be used within a CondominioProvider");
  }
  return context;
}
