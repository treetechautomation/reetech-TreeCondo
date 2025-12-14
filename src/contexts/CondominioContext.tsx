"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";

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
  const { user } = useUser();
  const firestore = useFirestore();
  
  // State
  const [condominioAtivoId, setCondominioAtivoIdState] = useState<string | null>(null);
  const [blocoAtivoId, setBlocoAtivoId] = useState<string | null>(null);
  const [unidadeAtivaId, setUnidadeAtivaId] = useState<string | null>(null);

  // Vinculos do usuário logado
  const vinculosRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, `userCondominios/${user.uid}/vinculos`);
  }, [user, firestore]);
  const { data: vinculos, isLoading: isLoadingVinculos } = useCollection<Omit<Vinculo, 'id'>>(vinculosRef);

  const vinculoAtivo = React.useMemo(() => {
    return vinculos?.find(v => v.id === condominioAtivoId) ?? null;
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
  useEffect(() => {
    const storedId = localStorage.getItem("condominioAtivoId");
    if (storedId && vinculos?.some(v => v.id === storedId)) {
      setCondominioAtivoIdState(storedId);
    } else if (vinculos && vinculos.length > 0) {
      setCondominioAtivoIdState(vinculos[0].id);
      localStorage.setItem("condominioAtivoId", vinculos[0].id);
    }
  }, [vinculos]);

  // Efeito para auto-selecionar bloco e unidade se o usuário for MORADOR
  useEffect(() => {
    if (vinculoAtivo?.role === 'MORADOR' && vinculoAtivo.blocoId && vinculoAtivo.unidadeId) {
        setBlocoAtivoId(vinculoAtivo.blocoId);
        setUnidadeAtivaId(vinculoAtivo.unidadeId);
    }
  }, [vinculoAtivo]);

  // Handler para trocar de condomínio
  const setCondominioAtivoId = (id: string | null) => {
    setCondominioAtivoIdState(id);
    // Limpa a seleção de bloco/unidade ao trocar de condomínio
    setBlocoAtivoId(null);
    setUnidadeAtivaId(null);
    if (id) {
      localStorage.setItem("condominioAtivoId", id);
    } else {
      localStorage.removeItem("condominioAtivoId");
    }
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
