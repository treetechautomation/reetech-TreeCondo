
"use client";

import { useEffect, useState } from "react";
import { onSnapshot, orderBy, query, type FirestoreError } from "firebase/firestore";
import { useFirestore, useMemoFirebase } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { getFuncionariosRef } from "@/firebase/firestore/paths";
import type { Funcionario } from "@/firebase/firestore/funcionarios.service";
import type { InternalQuery } from "@/firebase/firestore/use-collection";


/**
 * Hook para listar funcionarios do condomínio em tempo real.
 */
export function useFuncionarios(condominioId: string | null) {
  const firestore = useFirestore();
  const [data, setData] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  const funcionariosQuery = useMemoFirebase(() => {
    if (!condominioId) return null;
    const funcionariosCollectionRef = getFuncionariosRef(firestore, condominioId);
    return query(funcionariosCollectionRef, orderBy("nome", "asc"));
  }, [condominioId, firestore]);

  useEffect(() => {
    if (!funcionariosQuery) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      funcionariosQuery,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Funcionario[];
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`Erro ao ouvir funcionarios do condominio ${condominioId}:`, err);
        
        const path = (funcionariosQuery as unknown as InternalQuery)._query.path.canonicalString();
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
  }, [funcionariosQuery, condominioId]);

  return { data, loading, error };
}
