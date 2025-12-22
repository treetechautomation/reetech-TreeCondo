"use client";

import { useEffect, useState } from "react";
import { useFirestore } from "@/firebase";
import {
  collection,
  getDocs,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";

export type CondominioItem = {
  id: string;
  nome: string;
  ativo: boolean;
};

type UseCondominiosState = {
  data: CondominioItem[];
  loading: boolean;
  error: Error | null;
};

export function useCondominios(): UseCondominiosState {
  const firestore = useFirestore();
  const [data, setData] = useState<CondominioItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    console.log("[useCondominios] effect start. Firestore:", firestore);

    if (!firestore) {
      console.warn("[useCondominios] Firestore não inicializado ainda.");
      return;
    }

    let cancelled = false;

    async function fetchCondominios() {
      console.log("[useCondominios] Buscando coleção 'condominios'...");

      setLoading(true);
      setError(null);

      try {
        const ref = collection(firestore, "condominios");
        const snap: QuerySnapshot<DocumentData> = await getDocs(ref);

        console.log(
          "[useCondominios] getDocs retornou",
          snap.size,
          "documentos"
        );

        const items: CondominioItem[] = [];
        snap.forEach((doc) => {
          const d = doc.data() as any;
          console.log("[useCondominios] doc:", doc.id, d);

          const ativo = d.ativo !== false; // se não tiver campo, assume true
          if (!ativo) {
            console.log("[useCondominios] ignorando porque ativo == false:", doc.id);
            return;
          }

          items.push({
            id: doc.id,
            nome: d.nome ?? "Condomínio sem nome",
            ativo,
          });
        });

        if (!cancelled) {
          console.log("[useCondominios] itens finais:", items);
          setData(items);
        }
      } catch (e: any) {
        console.error("[useCondominios] ERRO ao buscar condomínios:", e);
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          console.log("[useCondominios] loading = false");
        }
      }
    }

    fetchCondominios();

    return () => {
      cancelled = true;
      console.log("[useCondominios] effect cleanup (cancelled = true)");
    };
  }, [firestore]);

  return { data, loading, error };
}
