
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
import { getPetDocRef, getPetsRef } from "./paths";

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
  const docRef = getPetDocRef(firestore, condominioId, blocoId, unidadeId, petId);
  const data = { ...patch, updatedAt: serverTimestamp() };

  try {
    await updateDoc(docRef, data);
  } catch (error) {
    console.error("Erro ao atualizar pet:", error);
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
 * Deletar pet.
 */
export async function deletarPet(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
  petId: string
): Promise<void> {
  const docRef = getPetDocRef(firestore, condominioId, blocoId, unidadeId, petId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Erro ao deletar pet:", error);
    const contextualError = await createFirestorePermissionError({
      path: docRef.path,
      operation: "delete",
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
  }
}
