
"use client";

import { useEffect, useState } from "react";
import { useFirestore } from "@/firebase";
import { 
  getDocs, 
  query, 
  orderBy, 
  type FirestoreError 
} from "firebase/firestore";
import { getCondominiosRef } from "@/firebase/firestore/paths";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

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
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!firestore) return;

    let isMounted = true;

    const fetchCondominios = async () => {
      setLoading(true);
      try {
        const condominiosRef = getCondominiosRef(firestore);
        const q = query(condominiosRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        if (isMounted) {
          const condominiosData = snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as Condominio)
          );
          setData(condominiosData);
          setError(null);
        }
      } catch (err: any) {
        console.error("Erro ao buscar condomínios (hook):", err);
        const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: 'condominios',
        });
        errorEmitter.emit('permission-error', contextualError);
        if (isMounted) {
          setError(contextualError);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCondominios();

    return () => {
      isMounted = false;
    };
  }, [firestore]);

  return { data, loading, error };
}
