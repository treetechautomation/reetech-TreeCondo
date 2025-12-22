"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { initializeFirebase } from "@/firebase";

export type PapelPessoa = "MORADOR" | "SINDICO" | "PORTEIRO";

export interface Pessoa {
  id: string;
  nome: string;
  email: string;
  papel: PapelPessoa;
  bloco?: string | null;
}

interface UsePessoasResult {
  pessoas: Pessoa[];
  loading: boolean;
  error: string | null;
  tornarSindico: (pessoaId: string) => Promise<void>;
  // espaço pra futuros métodos (adicionar / remover, etc.)
}

export function usePessoas(condominioId?: string | null): UsePessoasResult {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!condominioId) {
      setPessoas([]);
      return;
    }

    const app = initializeFirebase();
    const db = getFirestore(app);

    const colRef = collection(db, "condominios", condominioId, "membros");
    const q = query(colRef, orderBy("nome"));

    setLoading(true);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data: Pessoa[] = snap.docs.map((d) => {
          const raw = d.data() as any;
          return {
            id: d.id,
            nome: raw.nome ?? "",
            email: raw.email ?? "",
            papel: (raw.role ?? "MORADOR") as PapelPessoa,
            bloco: raw.bloco ?? null,
          };
        });

        setPessoas(data);
        setLoading(false);
      },
      (err) => {
        console.error("[usePessoas] erro ao carregar membros:", err);
        setError("Erro ao carregar pessoas do condomínio.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [condominioId]);

  const tornarSindico = async (pessoaId: string) => {
    if (!condominioId) return;

    const app = initializeFirebase();
    const db = getFirestore(app);

    const membrosCol = collection(db, "condominios", condominioId, "membros");

    // 1) tira qualquer síndico atual
    const sindicosSnap = await getDocs(
      query(membrosCol, where("role", "==", "SINDICO"))
    );

    const updates: Promise<void>[] = [];

    sindicosSnap.forEach((docSnap) => {
      if (docSnap.id === pessoaId) return;
      updates.push(updateDoc(docSnap.ref, { role: "MORADOR" }));
    });

    // 2) define o novo síndico
    const novoSindicoRef = doc(membrosCol, pessoaId);
    updates.push(updateDoc(novoSindicoRef, { role: "SINDICO" }));

    await Promise.all(updates);
  };

  return { pessoas, loading, error, tornarSindico };
}
