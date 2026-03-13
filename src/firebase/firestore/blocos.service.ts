
"use client";

import {
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { errorEmitter } from "../error-emitter";
import { createFirestorePermissionError } from "../errors";
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
 * Cria um novo bloco em um condomínio. Apenas Super Admins ou Síndicos.
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

export async function upsertBlocoEspecial(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  payload: NewBlocoPayload
): Promise<void> {
  const docRef = doc(firestore, `condominios/${condominioId}/blocos`, blocoId);

  const data = {
    nome: payload.nome,
    ordem: payload.ordem ?? 0,
    ativo: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.error("Erro ao upsert do bloco especial: ", error);
    const contextualError = await createFirestorePermissionError({
      path: docRef.path,
      operation: "create",
      requestResourceData: data,
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
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
  if (blocoId === "ADM") {
    throw new Error("Bloco ADM não pode ser removido.");
  }
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
