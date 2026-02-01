
"use client";

import { useMemoFirebase, useCollection } from "@/firebase";
import { getBlocosRef } from "@/firebase/firestore/paths";
import type { Bloco } from "@/firebase/firestore/blocos.service";
import { query, orderBy } from "firebase/firestore";
import { useFirestore } from "@/firebase";

/**
 * Hook para listar os blocos de um condomínio em tempo real, ordenados.
 * @param condominioId O ID do condomínio.
 */
export function useBlocos(condominioId: string | null) {
  const firestore = useFirestore();
  
  const blocosQuery = useMemoFirebase(() => {
    if (!firestore || !condominioId) return null;
    const blocosCollectionRef = getBlocosRef(firestore, condominioId);
    return query(blocosCollectionRef, orderBy("ordem", "asc"), orderBy("nome", "asc"));
  }, [condominioId, firestore]);

  // The useCollection hook handles loading, error, and data states internally.
  const { data, isLoading, error } = useCollection<Bloco>(blocosQuery);

  return { data, loading: isLoading, error };
}
