
"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase";

export type Condominio = {
  id: string;
  nome: string;
  cnpj?: string | null;
  cep?: string | null;
  ativo: boolean;
  createdAt: ReturnType<typeof serverTimestamp>;
  createdBy: string;
};

export function useCondominios() {
  const firestore = useFirestore();
  const [data, setData] = useState<Condominio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!firestore) return;

    const q = query(collection(firestore, "condominios"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Condominio[];
        setData(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Erro ao ouvir condominios:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore]);

  return { data, loading, error };
}
