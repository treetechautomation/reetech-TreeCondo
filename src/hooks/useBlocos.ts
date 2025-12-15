
"use client";

import { useMemoFirebase, useCollection } from "@/firebase";
import { getBlocosRef } from "@/firebase/firestore/paths";
import type { Bloco } from "@/firebase/firestore/blocos.service";
import { query, orderBy } from "firebase/firestore";

/**
 * Hook para listar os blocos de um condomínio em tempo real, ordenados.
 * @param condominioId O ID do condomínio.
 */
export function useBlocos(condominioId: string | null) {
  const blocosQuery = useMemoFirebase(() => {
    if (!condominioId) return null;
    const blocosCollectionRef = getBlocosRef(condominioId); // Assumes getBlocosRef is adapted to not require db instance
    return query(blocosCollectionRef, orderBy("ordem", "asc"), orderBy("nome", "asc"));
  }, [condominioId]);

  // The useCollection hook handles loading, error, and data states internally.
  const { data, isLoading, error } = useCollection<Bloco>(blocosQuery);

  return { data, loading: isLoading, error };
}
