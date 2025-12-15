
"use client";

import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { getVeiculosRef } from "@/firebase/firestore/paths";
import type { Veiculo } from "@/firebase/firestore/veiculos.service";
import { query, orderBy } from "firebase/firestore";

/**
 * Hook para listar veículos de uma unidade em tempo real.
 */
export function useVeiculos(
  condominioId: string | null,
  blocoId: string | null,
  unidadeId: string | null
) {
  const firestore = useFirestore();
  
  const veiculosQuery = useMemoFirebase(() => {
    if (!condominioId || !blocoId || !unidadeId) return null;
    const veiculosCollectionRef = getVeiculosRef(firestore, condominioId, blocoId, unidadeId);
    return query(veiculosCollectionRef, orderBy("modelo", "asc"));
  }, [condominioId, blocoId, unidadeId, firestore]);

  const { data, isLoading, error } = useCollection<Veiculo>(veiculosQuery);

  return { data, loading: isLoading, error };
}
