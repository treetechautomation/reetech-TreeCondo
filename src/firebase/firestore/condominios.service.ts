"use client";

import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { Firestore } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export async function criarCondominio(
  firestore: Firestore,
  adminUid: string,
  payload: {
    nome: string;
    cnpj?: string;
    cep?: string;
    sindico?: string;
    contato?: string;
  }
) {
  const condominiosCollection = collection(firestore, "condominios");
  const data = {
    nome: payload.nome,
    cnpj: payload.cnpj ?? null,
    cep: payload.cep ?? null,
    sindico: payload.sindico ?? null,
    contato: payload.contato ?? null,
    ativo: true,
    createdAt: serverTimestamp(),
    createdBy: adminUid,
  };

  // Não use await, use .catch() para tratamento de erro não-bloqueante
  return addDoc(condominiosCollection, data)
    .catch(error => {
      const contextualError = new FirestorePermissionError({
        path: condominiosCollection.path,
        operation: 'create',
        requestResourceData: data,
      });
      // Emite o erro para o listener global
      errorEmitter.emit('permission-error', contextualError);
      // Propaga o erro original para que a UI possa reagir se necessário
      throw error;
    });
}

export async function deletarCondominio(firestore: Firestore, condominioId: string) {
    const docRef = doc(firestore, "condominios", condominioId);
    
    // Usa .catch() para tratamento de erro não-bloqueante
    return deleteDoc(docRef)
        .catch(error => {
            const contextualError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', contextualError);
            throw error;
        });
}
