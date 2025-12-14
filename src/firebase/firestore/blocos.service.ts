
"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { errorEmitter } from "../error-emitter";
import { createFirestorePermissionError, FirestorePermissionError } from "../errors";
import { getBlocoDocRef, getBlocosRef } from "./paths";

export type Bloco = {
  id: string;
  nome: string;
  ordem?: number;
  ativo: boolean;
  createdAt: any;
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
    const blocosCollectionRef = getBlocosRef(firestore, condominioId);
    const q = query(blocosCollectionRef, orderBy("ordem", "asc"), orderBy("nome", "asc"));

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
            path: blocosCollectionRef.path,
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
): Promise<DocumentReference> {
  const blocosCollectionRef = getBlocosRef(firestore, condominioId);
  const data = {
    ...payload,
    ativo: true,
    createdAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(blocosCollectionRef, data);
    return docRef;
  } catch (error) {
    console.error("Erro ao criar bloco: ", error);
    const contextualError = await createFirestorePermissionError({
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
): Promise<void> {
  const docRef = getBlocoDocRef(firestore, condominioId, blocoId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Erro ao deletar bloco: ", error);
    const contextualError = await createFirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    });
    errorEmitter.emit('permission-error', contextualError);
    throw error; // Propaga o erro para a UI
  }
}
