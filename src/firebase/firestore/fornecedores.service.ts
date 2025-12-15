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
import { getFornecedorDocRef, getFornecedoresRef } from "./paths";

/**
 * Schema (backend.json): Fornecedor
 * - nome, servico, contato, ativo, createdAt, createdBy
 */

export type Fornecedor = {
  id: string;
  nome: string;
  servico: string;
  contato?: string;
  ativo: boolean;
  createdAt: any; // Timestamp
  createdBy?: string;
  updatedAt?: any; // Timestamp
};

export type NewFornecedorPayload = {
  nome: string;
  servico: string;
  ativo: boolean;
  contato?: string;
  createdBy?: string; // UID de quem cadastrou
};

export type UpdateFornecedorPayload = Partial<Omit<Fornecedor, "id" | "createdAt" | "updatedAt">>;

/**
 * Hook para listar fornecedores do condomínio em tempo real.
 */
export function useFornecedores(condominioId: string | null) {
  const firestore = useFirestore();
  const [data, setData] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!condominioId) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const fornecedoresRef = getFornecedoresRef(condominioId, firestore);
    const q = query(fornecedoresRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Fornecedor[];
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`Erro ao ouvir fornecedores do condominio ${condominioId}:`, err);

        const contextualError = new FirestorePermissionError({
          operation: "list",
          path: fornecedoresRef.path,
        });

        errorEmitter.emit("permission-error", contextualError);
        setError(contextualError);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [condominioId, firestore]);

  return { data, loading, error };
}

/**
 * Criar fornecedor (Sindico/SuperAdmin).
 */
export async function criarFornecedor(
  firestore: Firestore,
  condominioId: string,
  payload: NewFornecedorPayload
) {
  const fornecedoresRef = getFornecedoresRef(condominioId, firestore);
  const data = {
    ...payload,
    createdAt: serverTimestamp(),
  };

  try {
    return await addDoc(fornecedoresRef, data);
  } catch (error) {
    console.error("Erro ao criar fornecedor:", error);
    const contextualError = await createFirestorePermissionError({
      path: fornecedoresRef.path,
      operation: "create",
      requestResourceData: data,
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
  }
}

/**
 * Atualizar fornecedor (Sindico/SuperAdmin).
 */
export async function atualizarFornecedor(
  firestore: Firestore,
  condominioId: string,
  fornecedorId: string,
  patch: UpdateFornecedorPayload
): Promise<void> {
  const docRef = getFornecedorDocRef(firestore, condominioId, fornecedorId);
  const data = { ...patch, updatedAt: serverTimestamp() };

  try {
    await updateDoc(docRef, data);
  } catch (error) {
    console.error("Erro ao atualizar fornecedor:", error);
    const contextualError = await createFirestorePermissionError({
      path: docRef.path,
      operation: "update",
      requestResourceData: patch,
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
  }
}

/**
 * Deletar fornecedor (Sindico/SuperAdmin).
 */
export async function deletarFornecedor(
  firestore: Firestore,
  condominioId: string,
  fornecedorId: string
): Promise<void> {
  const docRef = getFornecedorDocRef(firestore, condominioId, fornecedorId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Erro ao deletar fornecedor:", error);
    const contextualError = await createFirestorePermissionError({
      path: docRef.path,
      operation: "delete",
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
  }
}
