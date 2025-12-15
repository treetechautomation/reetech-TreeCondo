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
import { getFuncionariosRef } from "./paths";

/**
 * Schema (backend.json): Funcionario
 * - nome, cargo (PORTEIRO|ZELADOR|FAXINEIRO), horario, contato, status (ATIVO|FERIAS|INATIVO),
 * - createdAt, createdBy
 */

export type Funcionario = {
  id: string;
  nome: string;
  cargo: "PORTEIRO" | "ZELADOR" | "FAXINEIRO";
  horario?: string;
  contato?: string;
  status: "ATIVO" | "FERIAS" | "INATIVO";
  createdAt: any; // Timestamp
  createdBy?: string;
  updatedAt?: any; // Timestamp
};

export type NewFuncionarioPayload = {
  nome: string;
  cargo: "PORTEIRO" | "ZELADOR" | "FAXINEIRO";
  status: "ATIVO" | "FERIAS" | "INATIVO";
  horario?: string;
  contato?: string;
  createdBy?: string; // UID de quem cadastrou
};

export type UpdateFuncionarioPayload = Partial<Omit<Funcionario, "id" | "createdAt" | "updatedAt">>;

/**
 * Hook para listar funcionarios do condomínio em tempo real.
 */
export function useFuncionarios(condominioId: string | null) {
  const firestore = useFirestore();
  const [data, setData] = useState<Funcionario[]>([]);
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

    const funcionariosRef = getFuncionariosRef(firestore, condominioId);
    const q = query(funcionariosRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Funcionario[];
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`Erro ao ouvir funcionarios do condominio ${condominioId}:`, err);

        const contextualError = new FirestorePermissionError({
          operation: "list",
          path: funcionariosRef.path,
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
 * Criar funcionario (Sindico/SuperAdmin).
 */
export async function criarFuncionario(
  firestore: Firestore,
  condominioId: string,
  payload: NewFuncionarioPayload
) {
  const funcionariosRef = getFuncionariosRef(firestore, condominioId);
  const data = {
    ...payload,
    createdAt: serverTimestamp(),
  };

  try {
    return await addDoc(funcionariosRef, data);
  } catch (error) {
    console.error("Erro ao criar funcionario:", error);
    const contextualError = await createFirestorePermissionError({
      path: funcionariosRef.path,
      operation: "create",
      requestResourceData: data,
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
  }
}

/**
 * Atualizar funcionario (Sindico/SuperAdmin).
 */
export async function atualizarFuncionario(
  firestore: Firestore,
  condominioId: string,
  funcionarioId: string,
  patch: UpdateFuncionarioPayload
): Promise<void> {
  const docRefPath = `condominios/${condominioId}/funcionarios/${funcionarioId}`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { doc } = require("firebase/firestore");
    const docRef = doc(firestore, docRefPath);

    const data = { ...patch, updatedAt: serverTimestamp() };
    await updateDoc(docRef, data);
  } catch (error) {
    console.error("Erro ao atualizar funcionario:", error);
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
 * Deletar funcionario (Sindico/SuperAdmin).
 */
export async function deletarFuncionario(
  firestore: Firestore,
  condominioId: string,
  funcionarioId: string
): Promise<void> {
  const docRefPath = `condominios/${condominioId}/funcionarios/${funcionarioId}`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { doc } = require("firebase/firestore");
    const docRef = doc(firestore, docRefPath);

    await deleteDoc(docRef);
  } catch (error) {
    console.error("Erro ao deletar funcionario:", error);
    const contextualError = await createFirestorePermissionError({
      path: docRefPath,
      operation: "delete",
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
  }
}
