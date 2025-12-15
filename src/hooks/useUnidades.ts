
"use client";

import { useMemoFirebase, useCollection, useFirestore } from "@/firebase";
import { getUnidadesRef } from "@/firebase/firestore/paths";
import type { Unidade } from "@/firebase/firestore/unidades.service";
import { query, orderBy } from "firebase/firestore";

/**
 * Hook para listar as unidades de um bloco em tempo real, ordenadas por número.
 * @param condominioId O ID do condomínio.
 * @param blocoId O ID do bloco.
 */
export function useUnidades(condominioId: string | null, blocoId: string | null) {
  const firestore = useFirestore();

  const unidadesQuery = useMemoFirebase(() => {
    if (!condominioId || !blocoId) return null;
    const unidadesCollectionRef = getUnidadesRef(condominioId, blocoId, firestore);
    return query(unidadesCollectionRef, orderBy("numero", "asc"));
  }, [condominioId, blocoId, firestore]);

  const { data, isLoading, error } = useCollection<Unidade>(unidadesQuery);

  return { data, loading: isLoading, error };
}
