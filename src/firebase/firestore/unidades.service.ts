
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

export type Unidade = {
  id: string;
  numero: string;
  andar?: number;
  tipo: "APARTAMENTO" | "CASA";
  ocupacao: "VAGO" | "PROPRIETARIO" | "ALUGADO";
  proprietarioUid: string | null;
  inquilinoUid: string | null;
  responsavelUid: string | null;
  ativo: boolean;
  createdAt: ReturnType<typeof serverTimestamp>;
};

export type NewUnidadePayload = {
  numero: string;
  andar?: number;
};

/**
 * Hook para listar as unidades de um bloco em tempo real.
 * @param condominioId O ID do condomínio.
 * @param blocoId O ID do bloco.
 */
export function useUnidades(condominioId: string | null, blocoId: string | null) {
  const firestore = useFirestore();
  const [data, setData] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!condominioId || !blocoId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unidadesRef = collection(firestore, `condominios/${condominioId}/blocos/${blocoId}/unidades`);
    const q = query(unidadesRef, orderBy("numero", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Unidade[];
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`Erro ao ouvir unidades do bloco ${blocoId}:`, err);
        const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: `condominios/${condominioId}/blocos/${blocoId}/unidades`,
        });
        errorEmitter.emit('permission-error', contextualError);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [condominioId, blocoId, firestore]);

  return { data, loading };
}

/**
 * Cria uma nova unidade em um bloco. Apenas Super Admins.
 * @param firestore Instância do Firestore.
 * @param condominioId O ID do condomínio.
 * @param blocoId O ID do bloco.
 * @param payload Dados da nova unidade.
 */
export function criarUnidade(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  payload: NewUnidadePayload
) {
  const unidadesRef = collection(firestore, `condominios/${condominioId}/blocos/${blocoId}/unidades`);
  const data = {
    ...payload,
    tipo: "APARTAMENTO",
    ocupacao: "VAGO",
    proprietarioUid: null,
    inquilinoUid: null,
    responsavelUid: null,
    ativo: true,
    createdAt: serverTimestamp(),
  };

  addDoc(unidadesRef, data)
    .catch((error) => {
      console.error("Erro ao criar unidade: ", error);
      const contextualError = new FirestorePermissionError({
        path: `condominios/${condominioId}/blocos/${blocoId}/unidades`,
        operation: 'create',
        requestResourceData: data,
      });
      errorEmitter.emit('permission-error', contextualError);
      throw error;
    });
}

/**
 * Deleta uma unidade. Apenas Super Admins.
 * @param firestore Instância do Firestore.
 * @param condominioId O ID do condomínio.
 * @param blocoId O ID do bloco.
 * @param unidadeId O ID da unidade a ser deletada.
 */
export function deletarUnidade(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
) {
  const docRef = doc(firestore, `condominios/${condominioId}/blocos/${blocoId}/unidades`, unidadeId);

  deleteDoc(docRef)
    .catch((error) => {
      console.error("Erro ao deletar unidade: ", error);
      const contextualError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete',
      });
      errorEmitter.emit('permission-error', contextualError);
      throw error;
    });
}
