"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
} from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { useSessionCtx } from "./SessionContext";

export type Vinculo = {
  id: string; // condominioId
  condominioId: string;
  condominioNome: string;
  role: "SINDICO" | "MORADOR" | "PORTEIRO" | "ADMIN_CONDOMINIO" | "SUPER_ADMIN";
  status: "ATIVO" | "INATIVO" | "PENDENTE";
  blocoId?: string;
  unidadeId?: string;
};

export type Bloco = {
  id: string;
  nome: string;
  ordem: number;
};

export type Unidade = {
  id: string;
  numero: string;
  andar: number;
};

interface CondominioContextType {
  // Condomínio
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

const LS_BLOCO = (condominioId: string) => `tc_active_bloco_${condominioId}`;
const LS_UNIDADE = (condominioId: string) => `tc_active_unidade_${condominioId}`;

export function CondominioProvider({ children }: { children: ReactNode }) {
  const { session, isSessionLoading, setActiveCondominioId } = useSessionCtx();
  const firestore = useFirestore();

  const condominioAtivoId = session?.activeCondominioId ?? null;

  const vinculos = useMemo(() => (session?.vinculos as Vinculo[]) || [], [session]);
  const isLoadingVinculos = isSessionLoading;

  const vinculoAtivo = useMemo(() => {
    if (!condominioAtivoId) return null;
    return (
      vinculos.find((v) => v.condominioId === condominioAtivoId) ?? null
    );
  }, [vinculos, condominioAtivoId]);

  const [blocoAtivoId, _setBlocoAtivoId] = useState<string | null>(null);
  const [unidadeAtivaId, _setUnidadeAtivaId] = useState<string | null>(null);

  const blocosRef = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId) return null;
    return query(
      collection(firestore, `condominios/${condominioAtivoId}/blocos`),
      orderBy("ordem")
    );
  }, [firestore, condominioAtivoId]);

  const { data: blocosRaw, isLoading: isLoadingBlocos } =
    useCollection<Bloco>(blocosRef);

  const blocos: Bloco[] = useMemo(() => (blocosRaw as any) || [], [blocosRaw]);

  const unidadesRef = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId || !blocoAtivoId) return null;
    return query(
      collection(
        firestore,
        `condominios/${condominioAtivoId}/blocos/${blocoAtivoId}/unidades`
      ),
      orderBy("numero")
    );
  }, [firestore, condominioAtivoId, blocoAtivoId]);

  const { data: unidadesRaw, isLoading: isLoadingUnidades } =
    useCollection<Unidade>(unidadesRef);

  const unidades: Unidade[] = useMemo(
    () => (unidadesRaw as any) || [],
    [unidadesRaw]
  );

  const setBlocoAtivoId = useCallback(
    (id: string | null) => {
      _setBlocoAtivoId(id);
      // ao trocar bloco, unidade deve resetar
      _setUnidadeAtivaId(null);

      if (typeof window !== "undefined" && condominioAtivoId) {
        if (id) localStorage.setItem(LS_BLOCO(condominioAtivoId), id);
        else localStorage.removeItem(LS_BLOCO(condominioAtivoId));
        localStorage.removeItem(LS_UNIDADE(condominioAtivoId));
      }
    },
    [condominioAtivoId]
  );

  const setUnidadeAtivaId = useCallback(
    (id: string | null) => {
      _setUnidadeAtivaId(id);
      if (typeof window !== "undefined" && condominioAtivoId) {
        if (id) localStorage.setItem(LS_UNIDADE(condominioAtivoId), id);
        else localStorage.removeItem(LS_UNIDADE(condominioAtivoId));
      }
    },
    [condominioAtivoId]
  );

  // MORADOR: força bloco/unidade do vínculo
  useEffect(() => {
    if (!vinculoAtivo) return;

    if (
      vinculoAtivo.role === "MORADOR" &&
      vinculoAtivo.blocoId &&
      vinculoAtivo.unidadeId
    ) {
      _setBlocoAtivoId(vinculoAtivo.blocoId);
      _setUnidadeAtivaId(vinculoAtivo.unidadeId);
    }
  }, [vinculoAtivo]);

  // Ao trocar condomínio: restaura seleção bloco/unidade do localStorage, ou escolhe automaticamente
  useEffect(() => {
    if (!condominioAtivoId) {
      _setBlocoAtivoId(null);
      _setUnidadeAtivaId(null);
      return;
    }

    // MORADOR não usa auto-seleção; ele já foi setado pelo effect acima
    if (vinculoAtivo?.role === "MORADOR") return;

    let restoredBloco: string | null = null;

    if (typeof window !== "undefined") {
      restoredBloco = localStorage.getItem(LS_BLOCO(condominioAtivoId));
    }

    // se tiver bloco salvo, usa ele; se não, tenta primeiro bloco quando carregar
    if (restoredBloco) _setBlocoAtivoId(restoredBloco);
    else _setBlocoAtivoId(null);

    _setUnidadeAtivaId(null);
  }, [condominioAtivoId, vinculoAtivo?.role]);

  // Quando blocos carregarem e não houver bloco ativo, escolhe o primeiro
  useEffect(() => {
    if (!condominioAtivoId) return;
    if (vinculoAtivo?.role === "MORADOR") return;
    if (isLoadingBlocos) return;

    if (!blocoAtivoId && blocos?.length) {
      setBlocoAtivoId(blocos[0].id);
    }
  }, [
    condominioAtivoId,
    vinculoAtivo?.role,
    isLoadingBlocos,
    blocos,
    blocoAtivoId,
    setBlocoAtivoId,
  ]);

  // Quando unidades carregarem e não houver unidade ativa, restaura do LS ou escolhe a primeira
  useEffect(() => {
    if (!condominioAtivoId) return;
    if (vinculoAtivo?.role === "MORADOR") return;
    if (isLoadingUnidades) return;
    if (!blocoAtivoId) return;

    let restoredUnidade: string | null = null;
    if (typeof window !== "undefined") {
      restoredUnidade = localStorage.getItem(LS_UNIDADE(condominioAtivoId));
    }

    if (!unidadeAtivaId) {
      const exists = restoredUnidade && unidades?.some((u) => u.id === restoredUnidade);
      if (exists) setUnidadeAtivaId(restoredUnidade!);
      else if (unidades?.length) setUnidadeAtivaId(unidades[0].id);
    }
  }, [
    condominioAtivoId,
    vinculoAtivo?.role,
    isLoadingUnidades,
    blocoAtivoId,
    unidades,
    unidadeAtivaId,
    setUnidadeAtivaId,
  ]);

  // Trocar condomínio (IMPORTANTE: aceitar null também)
  const handleSetCondominioAtivoId = useCallback(
    (id: string | null) => {
      // permite limpar
      if (!id) {
        setActiveCondominioId(""); // se o teu setActiveCondominioId não aceita null, manda string vazia
        _setBlocoAtivoId(null);
        _setUnidadeAtivaId(null);
        return;
      }

      setActiveCondominioId(id);

      // reset local (os effects acima vão auto-restore/auto-select)
      _setBlocoAtivoId(null);
      _setUnidadeAtivaId(null);
    },
    [setActiveCondominioId]
  );

  const value: CondominioContextType = {
    condominioAtivoId,
    setCondominioAtivoId: handleSetCondominioAtivoId,
    vinculos: vinculos || [],
    isLoadingVinculos,
    vinculoAtivo,

    blocoAtivoId,
    setBlocoAtivoId,
    blocos: blocos || [],
    isLoadingBlocos,

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
