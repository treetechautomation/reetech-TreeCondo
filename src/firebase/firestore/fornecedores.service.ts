
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
 * Criar fornecedor (Sindico/SuperAdmin).
 */
export async function criarFornecedor(
  firestore: Firestore,
  condominioId: string,
  payload: NewFornecedorPayload
) {
  const fornecedoresRef = getFornecedoresRef(firestore, condominioId);
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
