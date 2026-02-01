
"use client";

import { useEffect, useState } from "react";
import { onSnapshot, orderBy, query, type FirestoreError } from "firebase/firestore";
import { useFirestore, useMemoFirebase } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { getFornecedoresRef } from "@/firebase/firestore/paths";
import type { Fornecedor } from "@/firebase/firestore/fornecedores.service";
import type { InternalQuery } from "@/firebase/firestore/use-collection";

/**
 * Hook para listar fornecedores do condomínio em tempo real.
 */
export function useFornecedores(condominioId: string | null) {
  const firestore = useFirestore();
  const [data, setData] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  const fornecedoresQuery = useMemoFirebase(() => {
    if (!firestore || !condominioId) return null;
    const fornecedoresCollectionRef = getFornecedoresRef(firestore, condominioId);
    return query(fornecedoresCollectionRef, orderBy("nome", "asc"));
  }, [condominioId, firestore]);

  useEffect(() => {
    if (!fornecedoresQuery) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      fornecedoresQuery,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Fornecedor[];
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`Erro ao ouvir fornecedores do condominio ${condominioId}:`, err);

        const path = (fornecedoresQuery as unknown as InternalQuery)._query.path.canonicalString();
        const contextualError = new FirestorePermissionError({
          operation: "list",
          path: path,
        });

        errorEmitter.emit("permission-error", contextualError);
        setError(contextualError);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [fornecedoresQuery, condominioId]);

  return { data, loading, error };
}
