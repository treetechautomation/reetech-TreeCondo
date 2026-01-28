"use client";

import * as React from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useFirestore } from "@/firebase";

export type EncomendaStatus = "AGUARDANDO" | "RETIRADA";

export type Encomenda = {
  id: string;
  unidade?: string | null;         // Ex: "Apto 101"
  unidadeId?: string | null;       // opcional (pra evoluir depois)
  transportadora?: string | null;  // Ex: "Correios"
  codigo?: string | null;          // opcional
  status: EncomendaStatus;

  chegadaEm?: any;                 // serverTimestamp
  retiradaEm?: any;                // serverTimestamp
  registradoPorUid?: string | null;
  retiradoPorUid?: string | null;
};

export function useEncomendas(condId: string | null) {
  const firestore = useFirestore();

  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<Encomenda[]>([]);

  React.useEffect(() => {
    if (!firestore || !condId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = collection(firestore, "condominios", String(condId), "encomendas");
    const q = query(ref, orderBy("chegadaEm", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const out: Encomenda[] = [];
        snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
        setItems(out);
        setLoading(false);
      },
      (err) => {
        console.error("[useEncomendas] snapshot erro:", err);
        setItems([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, condId]);

  return { items, loading };
}
