
"use client";

import { useEffect, useState } from "react";
import { onSnapshot, orderBy, query, type FirestoreError } from "firebase/firestore";

import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { getPetsRef } from "@/firebase/firestore/paths";
import type { Pet } from "@/firebase/firestore/pets.service";


/**
 * Hook para listar pets de uma unidade em tempo real.
 */
export function usePets(
  condominioId: string | null,
  blocoId: string | null,
  unidadeId: string | null
) {
  const firestore = useFirestore();
  
  const petsQuery = useMemoFirebase(() => {
    if (!condominioId || !blocoId || !unidadeId) return null;
    const petsCollectionRef = getPetsRef(firestore, condominioId, blocoId, unidadeId);
    return query(petsCollectionRef, orderBy("nome", "asc"));
  }, [condominioId, blocoId, unidadeId, firestore]);

  const { data, isLoading, error } = useCollection<Pet>(petsQuery);

  return { data, loading: isLoading, error };
}
