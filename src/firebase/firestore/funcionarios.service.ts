
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
import { getFuncionarioDocRef, getFuncionariosRef } from "./paths";

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
  const docRef = getFuncionarioDocRef(firestore, condominioId, funcionarioId);
  const data = { ...patch, updatedAt: serverTimestamp() };
  
  try {
    await updateDoc(docRef, data);
  } catch (error) {
    console.error("Erro ao atualizar funcionario:", error);
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
 * Deletar funcionario (Sindico/SuperAdmin).
 */
export async function deletarFuncionario(
  firestore: Firestore,
  condominioId: string,
  funcionarioId: string
): Promise<void> {
  const docRef = getFuncionarioDocRef(firestore, condominioId, funcionarioId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Erro ao deletar funcionario:", error);
    const contextualError = await createFirestorePermissionError({
      path: docRef.path,
      operation: "delete",
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
  }
}
