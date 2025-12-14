"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
  runTransaction,
} from "firebase/firestore";
import { Firestore } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { criarConfiguracaoDeMenuPadrao } from "./menu.service";

/**
 * Cria um novo condomínio com uma estrutura inicial completa (bloco, unidade, síndico).
 * Esta função utiliza uma transação para garantir a atomicidade da operação.
 */
export async function criarCondominio(
  firestore: Firestore,
  adminUid: string,
  payload: {
    nome: string;
    cnpj?: string;
    cep?: string;
  }
) {
  try {
    await runTransaction(firestore, async (transaction) => {
      // 1. Criar o documento do condomínio
      const condominioRef = doc(collection(firestore, "condominios"));
      const condominioData = {
        nome: payload.nome,
        cnpj: payload.cnpj || null,
        cep: payload.cep || null,
        ativo: true,
        createdAt: serverTimestamp(),
        createdBy: adminUid,
      };
      transaction.set(condominioRef, condominioData);

      // 2. Criar um bloco padrão
      const blocoRef = doc(
        collection(firestore, `condominios/${condominioRef.id}/blocos`)
      );
      const blocoData = {
        nome: "Bloco Padrão",
        ordem: 1,
        ativo: true,
        createdAt: serverTimestamp(),
      };
      transaction.set(blocoRef, blocoData);

      // 3. Criar uma unidade padrão
      const unidadeRef = doc(
        collection(
          firestore,
          `condominios/${condominioRef.id}/blocos/${blocoRef.id}/unidades`
        )
      );
      const unidadeData = {
        numero: "101",
        andar: 1,
        tipo: "APARTAMENTO",
        ativo: true,
        createdAt: serverTimestamp(),
      };
      transaction.set(unidadeRef, unidadeData);
      
      // 4. Criar a configuração de menu (esta função não precisa estar na transação,
      //    pois é uma operação de 'set' idempotente)
      criarConfiguracaoDeMenuPadrao(firestore, condominioRef.id);

      // 5. Associar o admin criador como Síndico
      const membroRef = doc(
        firestore,
        `condominios/${condominioRef.id}/membros`,
        adminUid
      );
      const membroData = {
        role: "SINDICO",
        status: "ATIVO",
        createdAt: serverTimestamp(),
        createdBy: adminUid,
      };
      transaction.set(membroRef, membroData);

      // 6. Criar o vínculo do usuário
      const vinculoRef = doc(
        firestore,
        `userCondominios/${adminUid}/vinculos`,
        condominioRef.id
      );
      const vinculoData = {
        condominioId: condominioRef.id,
        condominioNome: payload.nome,
        role: "SINDICO",
        status: "ATIVO",
      };
      transaction.set(vinculoRef, vinculoData);
    });
  } catch (error) {
    console.error("Falha na transação de criar condomínio: ", error);
    // Mesmo com a transação, emitimos um erro genérico de criação para o listener,
    // pois a causa raiz provavelmente será permissão.
     const contextualError = new FirestorePermissionError({
        path: `condominios/${payload.nome}`,
        operation: 'create',
        requestResourceData: payload,
      });
      errorEmitter.emit('permission-error', contextualError);
    // Propaga o erro para que a UI possa reagir
    throw error;
  }
}

export async function deletarCondominio(
  firestore: Firestore,
  condominioId: string
) {
  const docRef = doc(firestore, "condominios", condominioId);

  // Usa .catch() para tratamento de erro não-bloqueante
  return deleteDoc(docRef).catch((error) => {
    const contextualError = new FirestorePermissionError({
      path: docRef.path,
      operation: "delete",
    });
    errorEmitter.emit("permission-error", contextualError);
    throw error;
  });
}
