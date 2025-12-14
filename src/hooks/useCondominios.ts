
"use client";

import { useEffect, useState } from "react";
import { useFirestore } from "@/firebase";
import { subscribeCondominios } from "@/firebase/firestore/condominios.service";
import type { FirestoreError, Timestamp } from "firebase/firestore";

export type Condominio = {
  id: string;
  nome: string;
  cnpj?: string | null;
  cep?: string | null;
  ativo: boolean;
  createdAt: any; // serverTimestamp() é convertido para Timestamp
  createdBy: string;
};

export function useCondominios() {
  const firestore = useFirestore();
  const [data, setData] = useState<Condominio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!firestore) return;

    setLoading(true);
    
    const unsub = subscribeCondominios(
      firestore,
      (condominios) => {
        setData(condominios as Condominio[]);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Erro ao ouvir condominios (hook):", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore]);

  return { data, loading, error };
}
