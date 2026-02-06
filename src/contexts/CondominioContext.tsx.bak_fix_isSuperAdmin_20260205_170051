"use client";

import { hasRole } from "@/lib/acl";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { useSessionCtx } from "./SessionContext";
import { useFirestore } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  QueryDocumentSnapshot,
  DocumentData,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

const LS_BLOCO = (condominioId: string) => `tc_bloco_${condominioId}_bloco`;
const LS_UNIDADE = (condominioId: string) => `tc_bloco_${condominioId}_unidade`;

export type VinculoRole =
  | "SINDICO"
  | "MORADOR"
  | "PORTEIRO"
  | "ZELADOR"
  | "ADMIN"
  | "ADMIN_CONDOMINIO";

export type Vinculo = {
  condominioId: string;
  role: VinculoRole;
  blocoId?: string | null;
  unidadeId?: string | null;
  status: "ATIVO" | "INATIVO";
};

export type Bloco = {
  id: string;
  nome: string;
  ordem?: number | null;
};

export type Unidade = {
  id: string;
  numero: string;
  blocoId: string;
};

type CondominioContextType = {
  condominioAtivoId: string | null;
  setCondominioAtivoId: (id: string | null) => void;

  vinculos: Vinculo[];
  vinculoAtivo: Vinculo | null;
  isLoadingVinculos: boolean;

  blocos: Bloco[];
  isLoadingBlocos: boolean;
  blocoAtivoId: string | null;
  setBlocoAtivoId: (id: string | null) => void;

  unidades: Unidade[];
  isLoadingUnidades: boolean;
  unidadeAtivaId: string | null;
  setUnidadeAtivaId: (id: string | null) => void;
};

const CondominioContext = createContext<CondominioContextType | undefined>(
  undefined
);

export function CondominioProvider({ children }: { children: ReactNode }) {
  const { session, isSessionLoading, setActiveCondominioId } = useSessionCtx();
  const firestore = useFirestore();

  const condominioAtivoId = session?.activeCondominioId ?? null;

  const vinculos: Vinculo[] = useMemo(
    () => ((session as any)?.vinculos as Vinculo[] | undefined) ?? [],
    [session]
  );
  const isLoadingVinculos = isSessionLoading;

  const vinculoAtivo = useMemo(() => {
    if (!condominioAtivoId) return null;
    return vinculos.find((v) => v.condominioId === condominioAtivoId) ?? null;
  }, [vinculos, condominioAtivoId]);

  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [isLoadingBlocos, setIsLoadingBlocos] = useState(false);
  const [blocoAtivoId, setBlocoAtivoIdState] = useState<string | null>(null);

  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [isLoadingUnidades, setIsLoadingUnidades] = useState(false);
  const [unidadeAtivaId, setUnidadeAtivaIdState] = useState<string | null>(
    null
  );

  // Restaurar bloco/unidade do localStorage quando trocar de condomínio
  useEffect(() => {
    if (!condominioAtivoId) {
      setBlocoAtivoIdState(null);
      setUnidadeAtivaIdState(null);
      return;
    }

    if (typeof window === "undefined") return;

    const savedBloco = localStorage.getItem(LS_BLOCO(condominioAtivoId));
    const savedUnidade = localStorage.getItem(LS_UNIDADE(condominioAtivoId));

    setBlocoAtivoIdState(savedBloco || null);
    setUnidadeAtivaIdState(savedUnidade || null);
  }, [condominioAtivoId]);

  // Listener de blocos do condomínio ativo
  useEffect(() => {
    if (!firestore || !condominioAtivoId) {
      setBlocos([]);
      return;
    }

    setIsLoadingBlocos(true);

    const q = query(
      collection(firestore, `condominios/${condominioAtivoId}/blocos`),
      orderBy("ordem")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Bloco[] = snapshot.docs.map(
          (doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            ...(doc.data() as Omit<Bloco, "id">),
          })
        );
        setBlocos(list);
        setIsLoadingBlocos(false);

        // Se não há bloco selecionado, tenta restaurar do LS ou pegar o primeiro
        if (!blocoAtivoId) {
          if (typeof window !== "undefined") {
            const savedBloco = localStorage.getItem(LS_BLOCO(condominioAtivoId));
            if (savedBloco && list.find((b) => b.id === savedBloco)) {
              setBlocoAtivoIdState(savedBloco);
              return;
            }
          }
          if (list.length > 0) {
            setBlocoAtivoIdState(list[0].id);
          }
        }
      },
      (error) => {
        console.error("Erro ao buscar blocos:", error);
        setIsLoadingBlocos(false);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, condominioAtivoId]);

  // Listener de unidades do bloco ativo
  useEffect(() => {
    if (!firestore || !condominioAtivoId || !blocoAtivoId) {
      setUnidades([]);
      return;
    }

    setIsLoadingUnidades(true);

    const q = query(
      collection(
        firestore,
        `condominios/${condominioAtivoId}/blocos/${blocoAtivoId}/unidades`
      ),
      orderBy("numero")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Unidade[] = snapshot.docs.map(
          (doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            blocoId: blocoAtivoId,
            ...(doc.data() as Omit<Unidade, "id" | "blocoId">),
          })
        );
        setUnidades(list);
        setIsLoadingUnidades(false);

        // Se não há unidade selecionada, tenta restaurar ou pegar a primeira
        if (!unidadeAtivaId) {
          if (typeof window !== "undefined") {
            const savedUnidade = localStorage.getItem(LS_UNIDADE(condominioAtivoId));
            if (savedUnidade && list.find((u) => u.id === savedUnidade)) {
              setUnidadeAtivaIdState(savedUnidade);
              return;
            }
          }
          if (list.length > 0) {
            setUnidadeAtivaIdState(list[0].id);
          }
        }
      },
      (error) => {
        console.error("Erro ao buscar unidades:", error);
        setIsLoadingUnidades(false);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, condominioAtivoId, blocoAtivoId]);

  const handleSetCondominioAtivoId = useCallback(
    (newCondoId: string | null) => {
      if (!session?.superAdmin) return;
      if (newCondoId === condominioAtivoId) return;

      const previousCondoId = condominioAtivoId;
      
      setActiveCondominioId(newCondoId);

      setBlocoAtivoIdState(null);
      setUnidadeAtivaIdState(null);

      if (typeof window !== "undefined") {
        if (previousCondoId) {
            localStorage.removeItem(LS_BLOCO(previousCondoId));
            localStorage.removeItem(LS_UNIDADE(previousCondoId));
        }
        if (newCondoId) {
            localStorage.removeItem(LS_BLOCO(newCondoId));
            localStorage.removeItem(LS_UNIDADE(newCondoId));
        }
      }
    },
    [session?.superAdmin, condominioAtivoId, setActiveCondominioId]
  );

  const handleSetBlocoAtivoId = useCallback(
    (id: string | null) => {
      setBlocoAtivoIdState(id);
      setUnidadeAtivaIdState(null);

      if (typeof window !== "undefined" && condominioAtivoId) {
        if (id) {
          localStorage.setItem(LS_BLOCO(condominioAtivoId), id);
        } else {
          localStorage.removeItem(LS_BLOCO(condominioAtivoId));
        }
        localStorage.removeItem(LS_UNIDADE(condominioAtivoId));
      }
    },
    [condominioAtivoId]
  );

  const handleSetUnidadeAtivaId = useCallback(
    (id: string | null) => {
      setUnidadeAtivaIdState(id);

      if (typeof window !== "undefined" && condominioAtivoId) {
        if (id) {
          localStorage.setItem(LS_UNIDADE(condominioAtivoId), id);
        } else {
          localStorage.removeItem(LS_UNIDADE(condominioAtivoId));
        }
      }
    },
    [condominioAtivoId]
  );

  const value: CondominioContextType = {
    condominioAtivoId,
    setCondominioAtivoId: handleSetCondominioAtivoId,

    vinculos,
    vinculoAtivo,
    isLoadingVinculos,

    blocos,
    isLoadingBlocos,
    blocoAtivoId,
    setBlocoAtivoId: handleSetBlocoAtivoId,

    unidades,
    isLoadingUnidades,
    unidadeAtivaId,
    setUnidadeAtivaId: handleSetUnidadeAtivaId,
  };

  return (
    <CondominioContext.Provider value={value}>
      {children}
    </CondominioContext.Provider>
  );
}

export function useCondominio() {
  const ctx = useContext(CondominioContext);
  if (!ctx) {
    throw new Error("useCondominio must be used within CondominioProvider");
  }
  return ctx;
}
