"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Firestore,
  type FirestoreError,
} from "firebase/firestore";

import { useFirestore } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { createFirestorePermissionError, FirestorePermissionError } from "@/firebase/errors";
import { getPetsRef } from "./paths";

/**
 * Schema (backend.json): Pet
 * - nome, raca, porte (PEQUENO|MEDIO|GRANDE), ownerUid, createdAt
 */

export type Pet = {
  id: string;
  nome: string;
  raca: string;
  porte: "PEQUENO" | "MEDIO" | "GRANDE";
  ownerUid: string;
  createdAt: any; // Timestamp
  updatedAt?: any; // Timestamp
};

export type NewPetPayload = {
  nome: string;
  raca: string;
  porte: "PEQUENO" | "MEDIO" | "GRANDE";
  ownerUid: string;
};

export type UpdatePetPayload = Partial<Omit<Pet, "id" | "createdAt" | "updatedAt">>;

/**
 * Hook para listar pets de uma unidade em tempo real.
 */
export function usePets(
  condominioId: string | null,
  blocoId: string | null,
  unidadeId: string | null
) {
  const firestore = useFirestore();
  const [data, setData] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!condominioId || !blocoId || !unidadeId) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const petsRef = getPetsRef(firestore, condominioId, blocoId, unidadeId);
    const q = query(petsRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Pet[];
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`Erro ao ouvir pets da unidade ${unidadeId}:`, err);

        const contextualError = new FirestorePermissionError({
          operation: "list",
          path: petsRef.path,
        });

        errorEmitter.emit("permission-error", contextualError);
        setError(contextualError);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [condominioId, blocoId, unidadeId, firestore]);

  return { data, loading, error };
}

/**
 * Criar pet (Sindico/SuperAdmin ou Morador dono).
 */
export async function criarPet(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
  payload: NewPetPayload
) {
  const petsRef = getPetsRef(firestore, condominioId, blocoId, unidadeId);
  const data = {
    ...payload,
    createdAt: serverTimestamp(),
  };

  try {
    return await addDoc(petsRef, data);
  } catch (error) {
    console.error("Erro ao criar pet:", error);
    const contextualError = await createFirestorePermissionError({
      path: petsRef.path,
      operation: "create",
      requestResourceData: data,
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
  }
}

/**
 * Atualizar pet (não pode trocar ownerUid pelas rules).
 */
export async function atualizarPet(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
  petId: string,
  patch: UpdatePetPayload
): Promise<void> {
  const docRefPath = `condominios/${condominioId}/blocos/${blocoId}/unidades/${unidadeId}/pets/${petId}`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { doc } = require("firebase/firestore");
    const docRef = doc(firestore, docRefPath);

    const data = { ...patch, updatedAt: serverTimestamp() };
    await updateDoc(docRef, data);
  } catch (error) {
    console.error("Erro ao atualizar pet:", error);
    const contextualError = await createFirestorePermissionError({
      path: docRefPath,
      operation: "update",
      requestResourceData: patch,
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
  }
}

/**
 * Deletar pet.
 */
export async function deletarPet(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
  petId: string
): Promise<void> {
  const docRefPath = `condominios/${condominioId}/blocos/${blocoId}/unidades/${unidadeId}/pets/${petId}`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { doc } = require("firebase/firestore");
    const docRef = doc(firestore, docRefPath);

    await deleteDoc(docRef);
  } catch (error) {
    console.error("Erro ao deletar pet:", error);
    const contextualError = await createFirestorePermissionError({
      path: docRefPath,
      operation: "delete",
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
  }
}
