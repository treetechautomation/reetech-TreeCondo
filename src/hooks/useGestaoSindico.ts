import { useEffect, useState, useCallback } from "react";
import { initializeFirebase } from "@/firebase";
import { useUser } from "@/firebase";
import {
  collection,
  onSnapshot,
} from "firebase/firestore";
import { getIdToken } from "firebase/auth";

export type MembroCondominio = {
  uid: string;
  nome?: string;
  email?: string;
  role: string;
};

type UseGestaoSindicoState = {
  sindicoAtual: MembroCondominio | null;
  moradores: MembroCondominio[];
  loading: boolean;
  error: string | null;
  definirSindico: (novoUid: string) => Promise<void>;
};

export function useGestaoSindico(
  condominioId?: string | null
): UseGestaoSindicoState {
  const [sindicoAtual, setSindicoAtual] = useState<MembroCondominio | null>(
    null
  );
  const [moradores, setMoradores] = useState<MembroCondominio[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { user: currentUser } = useUser();

  useEffect(() => {
    if (!condominioId) {
      setSindicoAtual(null);
      setMoradores([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { firestore: db } = initializeFirebase();
    const membrosRef = collection(db, "condominios", condominioId, "membros");

    const unsub = onSnapshot(
      membrosRef,
      (snap) => {
        const lista: MembroCondominio[] = snap.docs.map((d) => ({
          uid: d.id,
          ...(d.data() as any),
        }));

        const atual =
          lista.find((m) => m.role === "SINDICO") || null;

        const candidatos = lista.filter((m) =>
          ["MORADOR", "SINDICO"].includes(m.role)
        );

        setSindicoAtual(atual);
        setMoradores(candidatos);
        setLoading(false);
      },
      (err) => {
        console.error("[useGestaoSindico] erro ao carregar membros:", err);
        setError("Erro ao carregar membros do condomínio.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [condominioId]);

  const definirSindico = useCallback(async (novoUid: string) => {
    if (!condominioId) {
      throw new Error("Condomínio não selecionado.");
    }

    if (!currentUser) {
      throw new Error("Usuário não autenticado.");
    }

    try {
      setLoading(true);
      setError(null);

      const token = await getIdToken(currentUser, false);

      const res = await fetch("/api/membros/promote-sindico", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ condominioId, novoUid }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || "Erro ao definir novo síndico.");
      }
    } catch (err: any) {
      console.error("[useGestaoSindico] erro ao definir novo síndico:", err);
      setError(err?.message || "Erro ao definir novo síndico.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [condominioId, currentUser]);

  return {
    sindicoAtual,
    moradores,
    loading,
    error,
    definirSindico,
  };
}
