"use client";

import { useEffect, useState, useCallback } from "react";
import { useFirestore } from "@/firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  QueryDocumentSnapshot,
  DocumentData,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

export interface AdminCondominio {
  id: string;
  nome: string;
  cnpj?: string | null;
  ativo?: boolean;
  [key: string]: any;
}

export function useAdminCondominios() {
  const firestore = useFirestore();

  const [condominios, setCondominios] = useState<AdminCondominio[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const carregar = useCallback(async () => {
    if (!firestore) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const colRef = collection(firestore, "condominios");
      const q = query(colRef, orderBy("nome"));
      const snap = await getDocs(q);

      const lista: AdminCondominio[] = snap.docs.map(
        (doc: QueryDocumentSnapshot<DocumentData>) => ({
          id: doc.id,
          ...(doc.data() as any),
        })
      );

      console.log(
        "[useAdminCondominios] condomínios carregados:",
        lista.map((c) => ({ id: c.id, nome: c.nome }))
      );

      setCondominios(lista);
    } catch (e: any) {
      console.error("[useAdminCondominios] erro ao carregar:", e);
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [firestore]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (cancelled) return;
      await carregar();
    })();

    return () => {
      cancelled = true;
      console.log("[useAdminCondominios] cleanup");
    };
  }, [carregar]);

  const criarCondominio = useCallback(
    async (dados: { nome: string; cnpj?: string; ativo?: boolean }) => {
      if (!firestore) {
        throw new Error("Firestore não inicializado");
      }

      if (!dados.nome.trim()) {
        throw new Error("Nome do condomínio é obrigatório");
      }

      setSaving(true);
      setError(null);

      try {
        const colRef = collection(firestore, "condominios");

        const payload = {
          nome: dados.nome.trim(),
          cnpj: dados.cnpj?.trim() || null,
          ativo: dados.ativo ?? true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const docRef = await addDoc(colRef, payload);

        console.log("[useAdminCondominios] condomínio criado:", docRef.id);

        // Atualiza lista local rapidamente
        await carregar();

        return docRef.id;
      } catch (e: any) {
        console.error("[useAdminCondominios] erro ao criar:", e);
        setError(e instanceof Error ? e : new Error(String(e)));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [firestore, carregar]
  );

  return {
    condominios,
    loading,
    error,
    criarCondominio,
    saving,
    recarregar: carregar,
  };
}
