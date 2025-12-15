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
import { getVeiculosRef } from "./paths";

/**
 * Schema (backend.json): Veiculo
 * - placa, modelo, cor?, tipo (CARRO|MOTO), ownerUid, createdAt
 */

export type Veiculo = {
  id: string;
  placa: string;
  modelo: string;
  cor?: string;
  tipo: "CARRO" | "MOTO";
  ownerUid: string;
  createdAt: any; // Timestamp
  updatedAt?: any; // Timestamp
};

export type NewVeiculoPayload = {
  placa: string;
  modelo: string;
  cor?: string;
  tipo: "CARRO" | "MOTO";
  ownerUid: string;
};

export type UpdateVeiculoPayload = Partial<Omit<Veiculo, "id" | "createdAt" | "updatedAt">>;

/**
 * Hook para listar veículos de uma unidade em tempo real.
 */
export function useVeiculos(
  condominioId: string | null,
  blocoId: string | null,
  unidadeId: string | null
) {
  const firestore = useFirestore();
  const [data, setData] = useState<Veiculo[]>([]);
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

    const veiculosRef = getVeiculosRef(firestore, condominioId, blocoId, unidadeId);
    const q = query(veiculosRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Veiculo[];
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`Erro ao ouvir veículos da unidade ${unidadeId}:`, err);

        const contextualError = new FirestorePermissionError({
          operation: "list",
          path: veiculosRef.path,
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
 * Criar veículo (Sindico/SuperAdmin ou Morador dono).
 */
export async function criarVeiculo(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
  payload: NewVeiculoPayload
) {
  const veiculosRef = getVeiculosRef(firestore, condominioId, blocoId, unidadeId);
  const data = {
    ...payload,
    createdAt: serverTimestamp(),
  };

  try {
    return await addDoc(veiculosRef, data);
  } catch (error) {
    console.error("Erro ao criar veículo:", error);
    const contextualError = await createFirestorePermissionError({
      path: veiculosRef.path,
      operation: "create",
      requestResourceData: data,
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
  }
}

/**
 * Atualizar veículo (não pode trocar ownerUid pelas rules).
 */
export async function atualizarVeiculo(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
  veiculoId: string,
  patch: UpdateVeiculoPayload
): Promise<void> {
  const docRefPath = `condominios/${condominioId}/blocos/${blocoId}/unidades/${unidadeId}/veiculos/${veiculoId}`;

  try {
    // docRef pelo caminho (evita criar helper extra agora)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { doc } = require("firebase/firestore");
    const docRef = doc(firestore, docRefPath);

    const data = { ...patch, updatedAt: serverTimestamp() };
    await updateDoc(docRef, data);
  } catch (error) {
    console.error("Erro ao atualizar veículo:", error);
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
 * Deletar veículo.
 */
export async function deletarVeiculo(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
  veiculoId: string
): Promise<void> {
  const docRefPath = `condominios/${condominioId}/blocos/${blocoId}/unidades/${unidadeId}/veiculos/${veiculoId}`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { doc } = require("firebase/firestore");
    const docRef = doc(firestore, docRefPath);

    await deleteDoc(docRef);
  } catch (error) {
    console.error("Erro ao deletar veículo:", error);
    const contextualError = await createFirestorePermissionError({
      path: docRefPath,
      operation: "delete",
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
  }
}
