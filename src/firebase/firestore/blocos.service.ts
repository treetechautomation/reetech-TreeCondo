
"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { errorEmitter } from "../error-emitter";
import { FirestorePermissionError } from "../errors";

export type Bloco = {
  id: string;
  nome: string;
  ordem?: number;
  ativo: boolean;
  createdAt: ReturnType<typeof serverTimestamp>;
};

export type NewBlocoPayload = {
  nome: string;
  ordem?: number;
};

/**
 * Hook para listar os blocos de um condomínio em tempo real.
 * @param condominioId O ID do condomínio.
 */
export function useBlocos(condominioId: string | null) {
  const firestore = useFirestore();
  const [data, setData] = useState<Bloco[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!condominioId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const blocosRef = collection(firestore, `condominios/${condominioId}/blocos`);
    const q = query(blocosRef, orderBy("ordem", "asc"), orderBy("nome", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Bloco[];
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`Erro ao ouvir blocos do condomínio ${condominioId}:`, err);
        const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: `condominios/${condominioId}/blocos`,
        });
        errorEmitter.emit('permission-error', contextualError);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [condominioId, firestore]);

  return { data, loading };
}

/**
 * Cria um novo bloco em um condomínio. Apenas Super Admins.
 * @param firestore Instância do Firestore.
 * @param condominioId O ID do condomínio.
 * @param payload Dados do novo bloco.
 */
export async function criarBloco(
  firestore: Firestore,
  condominioId: string,
  payload: NewBlocoPayload
) {
  const blocosRef = collection(firestore, `condominios/${condominioId}/blocos`);
  const data = {
    ...payload,
    ativo: true,
    createdAt: serverTimestamp(),
  };

  try {
    return await addDoc(blocosRef, data);
  } catch (error) {
    console.error("Erro ao criar bloco: ", error);
    const contextualError = new FirestorePermissionError({
      path: `condominios/${condominioId}/blocos`,
      operation: 'create',
      requestResourceData: data,
    });
    errorEmitter.emit('permission-error', contextualError);
    throw error; // Propaga o erro para a UI
  }
}

/**
 * Deleta um bloco. Apenas Super Admins.
 * @param firestore Instância do Firestore.
 * @param condominioId O ID do condomínio.
 * @param blocoId O ID do bloco a ser deletado.
 */
export async function deletarBloco(
  firestore: Firestore,
  condominioId: string,
  blocoId: string
) {
  const docRef = doc(firestore, `condominios/${condominioId}/blocos`, blocoId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Erro ao deletar bloco: ", error);
    const contextualError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    });
    errorEmitter.emit('permission-error', contextualError);
    throw error; // Propaga o erro para a UI
  }
}
