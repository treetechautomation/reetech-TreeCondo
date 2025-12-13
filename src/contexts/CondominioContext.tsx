"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";

export type Vinculo = {
  id: string;
  condominioId: string;
  condominioNome: string;
  role: "sindico" | "morador" | "porteiro";
  status: "ativo" | "inativo" | "pendente";
};

interface CondominioContextType {
  condominioAtivoId: string | null;
  setCondominioAtivoId: (id: string | null) => void;
  vinculos: Vinculo[];
  isLoadingVinculos: boolean;
}

const CondominioContext = createContext<CondominioContextType | undefined>(
  undefined
);

export function CondominioProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [condominioAtivoId, setCondominioAtivoIdState] = useState<string | null>(null);

  const vinculosRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, `userCondominios/${user.uid}/vinculos`);
  }, [user, firestore]);
  
  const { data: vinculos, isLoading: isLoadingVinculos } = useCollection<Omit<Vinculo, 'id'>>(vinculosRef);

  useEffect(() => {
    const storedId = localStorage.getItem("condominioAtivoId");
    if (storedId) {
      setCondominioAtivoIdState(storedId);
    } else if (vinculos && vinculos.length > 0) {
      // Se não houver ID armazenado, seleciona o primeiro da lista
      setCondominioAtivoIdState(vinculos[0].id);
      localStorage.setItem("condominioAtivoId", vinculos[0].id);
    }
  }, [vinculos]);

  const setCondominioAtivoId = (id: string | null) => {
    setCondominioAtivoIdState(id);
    if (id) {
      localStorage.setItem("condominioAtivoId", id);
    } else {
      localStorage.removeItem("condominioAtivoId");
    }
  };

  const value = {
    condominioAtivoId,
    setCondominioAtivoId,
    vinculos: vinculos || [],
    isLoadingVinculos,
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
