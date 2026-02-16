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
  condominioNome?: string;
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

  // ✅ SUPER ADMIN robusto (emails + flags + role + hasRole)
  const isSuperAdmin = useMemo(() => {
    const email = (session?.user?.email || "").toLowerCase();
    return (
      email === "treecommunity@treetechautomation.com" ||
      email === "treetechautomation@treetechautomation.com" ||
      !!(session as any)?.superAdmin ||
      String((session as any)?.role || "") === "SUPER_ADMIN" ||
      hasRole(session, ["SUPER_ADMIN"])
    );
  }, [session]);

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
  const [unidadeAtivaId, setUnidadeAtivaIdState] = useState<string | null>(null);

  // ✅ Regra correta: só força condomínio se houver APENAS 1 vínculo ativo
useEffect(() => {
  if (isSessionLoading) return;

  const ativos = vinculos.filter(v => v.status === "ATIVO");

  // se só existe 1 vínculo, trava
  if (ativos.length === 1) {
    if (ativos[0].condominioId !== condominioAtivoId) {
      setActiveCondominioId(ativos[0].condominioId);
    }
  }
}, [vinculos, condominioAtivoId, setActiveCondominioId, isSessionLoading]);

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

  // Listener de blocos
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

        // auto pick bloco
        if (!blocoAtivoId && list.length > 0 && typeof window !== "undefined") {
          const saved = localStorage.getItem(LS_BLOCO(condominioAtivoId));
          if (saved && list.find((b) => b.id === saved)) {
            setBlocoAtivoIdState(saved);
          } else {
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

  // Listener de unidades
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

        // auto pick unidade
        if (!unidadeAtivaId && list.length > 0 && typeof window !== "undefined") {
          const saved = localStorage.getItem(LS_UNIDADE(condominioAtivoId));
          if (saved && list.find((u) => u.id === saved)) {
            setUnidadeAtivaIdState(saved);
          } else {
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

  // ✅ troca condomínio (somente super admin)
  const handleSetCondominioAtivoId = useCallback(
    (id: string | null) => {
      if (!isSuperAdmin) return;

      const anteriorId = condominioAtivoId;

      setActiveCondominioId(id);

      // limpa seleções
      setBlocoAtivoIdState(null);
      setUnidadeAtivaIdState(null);

      // limpa storage do anterior e do novo
      if (typeof window !== "undefined") {
        if (anteriorId) {
          localStorage.removeItem(LS_BLOCO(anteriorId));
          localStorage.removeItem(LS_UNIDADE(anteriorId));
        }
        if (id) {
          localStorage.removeItem(LS_BLOCO(id));
          localStorage.removeItem(LS_UNIDADE(id));
        }
      }
    },
    [isSuperAdmin, condominioAtivoId, setActiveCondominioId]
  );

  const handleSetBlocoAtivoId = useCallback(
    (id: string | null) => {
      setBlocoAtivoIdState(id);
      setUnidadeAtivaIdState(null);

      if (typeof window !== "undefined" && condominioAtivoId) {
        if (id) localStorage.setItem(LS_BLOCO(condominioAtivoId), id);
        else localStorage.removeItem(LS_BLOCO(condominioAtivoId));
        localStorage.removeItem(LS_UNIDADE(condominioAtivoId));
      }
    },
    [condominioAtivoId]
  );

  const handleSetUnidadeAtivaId = useCallback(
    (id: string | null) => {
      setUnidadeAtivaIdState(id);

      if (typeof window !== "undefined" && condominioAtivoId) {
        if (id) localStorage.setItem(LS_UNIDADE(condominioAtivoId), id);
        else localStorage.removeItem(LS_UNIDADE(condominioAtivoId));
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
  if (!ctx) throw new Error("useCondominio must be used within CondominioProvider");
  return ctx;
}
