
"use client";

import {
  addDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";

import { errorEmitter } from "@/firebase/error-emitter";
import { createFirestorePermissionError } from "@/firebase/errors";
import { getVeiculoDocRef, getVeiculosRef } from "./paths";

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
  const docRef = getVeiculoDocRef(firestore, condominioId, blocoId, unidadeId, veiculoId);
  const data = { ...patch, updatedAt: serverTimestamp() };

  try {
    await updateDoc(docRef, data);
  } catch (error) {
    console.error("Erro ao atualizar veículo:", error);
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
 * Deletar veículo.
 */
export async function deletarVeiculo(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
  veiculoId: string
): Promise<void> {
  const docRef = getVeiculoDocRef(firestore, condominioId, blocoId, unidadeId, veiculoId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Erro ao deletar veículo:", error);
    const contextualError = await createFirestorePermissionError({
      path: docRef.path,
      operation: "delete",
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
  }
}
