
"use client";

import {
  addDoc,
  deleteDoc,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { errorEmitter } from "../error-emitter";
import { createFirestorePermissionError } from "../errors";
import { getUnidadeDocRef, getUnidadesRef } from "./paths";

export type Unidade = {
  id: string;
  numero: string;
  andar?: number;
  tipo: "APARTAMENTO" | "CASA";
  ocupacao: "VAGO" | "PROPRIETARIO" | "ALUGADO";
  proprietarioUid: string | null;
  inquilinoUid: string | null;
  responsavelUid: string | null;
  ativo: boolean;
  createdAt: any;
  updatedAt?: any;
};

export type NewUnidadePayload = {
  numero: string;
  andar?: number;
};

export type UpdateUnidadePayload = Partial<Omit<Unidade, "id" | "createdAt" | "updatedAt">>;

export type SetOcupacaoUnidadePayload = {
  ocupacao: 'VAGO' | 'PROPRIETARIO' | 'ALUGADO';
  proprietarioUid?: string | null;
  inquilinoUid?: string | null;
  responsavelUid?: string | null;
}

/**
 * Cria uma nova unidade em um bloco. Apenas Super Admins.
 * @param firestore Instância do Firestore.
 * @param condominioId O ID do condomínio.
 * @param blocoId O ID do bloco.
 * @param payload Dados da nova unidade.
 */
export async function criarUnidade(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  payload: NewUnidadePayload
) {
  const unidadesRef = getUnidadesRef(condominioId, blocoId, firestore);
  const data = {
    ...payload,
    tipo: "APARTAMENTO",
    ocupacao: "VAGO",
    proprietarioUid: null,
    inquilinoUid: null,
    responsavelUid: null,
    ativo: true,
    createdAt: serverTimestamp(),
  };

  try {
    return await addDoc(unidadesRef, data);
  } catch (error) {
      console.error("Erro ao criar unidade: ", error);
      const contextualError = await createFirestorePermissionError({
        path: `condominios/${condominioId}/blocos/${blocoId}/unidades`,
        operation: 'create',
        requestResourceData: data,
      });
      errorEmitter.emit('permission-error', contextualError);
      throw error;
  }
}

/**
 * Atualiza os dados de uma unidade.
 * @param firestore Instância do Firestore.
 * @param condominioId ID do condomínio.
 * @param blocoId ID do bloco.
 * @param unidadeId ID da unidade a ser atualizada.
 * @param patch Objeto com os campos a serem atualizados.
 */
export async function atualizarUnidade(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
  patch: UpdateUnidadePayload
): Promise<void> {
  const docRef = getUnidadeDocRef(firestore, condominioId, blocoId, unidadeId);
  const data = { ...patch, updatedAt: serverTimestamp() };
  try {
    return await updateDoc(docRef, data);
  } catch(error) {
     console.error("Erro ao atualizar unidade: ", error);
      const contextualError = await createFirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data,
      });
      errorEmitter.emit('permission-error', contextualError);
      throw error;
  }
}

/**
 * Deleta uma unidade. Apenas Super Admins.
 * @param firestore Instância do Firestore.
 * @param condominioId O ID do condomínio.
 * @param blocoId O ID do bloco.
 * @param unidadeId O ID da unidade a ser deletada.
 */
export async function deletarUnidade(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
) {
  const docRef = getUnidadeDocRef(firestore, condominioId, blocoId, unidadeId);
  try {
    return await deleteDoc(docRef);
  } catch(error) {
      console.error("Erro ao deletar unidade: ", error);
      const contextualError = await createFirestorePermissionError({
        path: docRef.path,
        operation: 'delete',
      });
      errorEmitter.emit('permission-error', contextualError);
      throw error;
  }
}

/**
 * Define o status de ocupação de uma unidade e atualiza os UIDs relacionados de forma atômica.
 * @param firestore Instância do Firestore.
 * @param condominioId O ID do condomínio.
 * @param blocoId O ID do bloco.
 * @param unidadeId O ID da unidade.
 * @param data Payload com o novo status de ocupação e UIDs.
 */
export async function setOcupacaoUnidade(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
  data: SetOcupacaoUnidadePayload
) {
    const unidadeRef = getUnidadeDocRef(firestore, condominioId, blocoId, unidadeId);

    let updatePayload: UpdateUnidadePayload;

    if (data.ocupacao === 'VAGO') {
        updatePayload = {
            ocupacao: 'VAGO',
            proprietarioUid: null,
            inquilinoUid: null,
            responsavelUid: null,
        };
    } else if (data.ocupacao === 'PROPRIETARIO') {
        if (!data.proprietarioUid) {
            throw new Error("Para ocupação 'PROPRIETARIO', o proprietarioUid é obrigatório.");
        }
        updatePayload = {
            ocupacao: 'PROPRIETARIO',
            proprietarioUid: data.proprietarioUid,
            inquilinoUid: null,
            responsavelUid: data.proprietarioUid,
        };
    } else if (data.ocupacao === 'ALUGADO') {
        if (!data.inquilinoUid) {
            throw new Error("Para ocupação 'ALUGADO', o inquilinoUid é obrigatório.");
        }
        if (!data.proprietarioUid) {
            throw new Error("Para ocupação 'ALUGADO', o proprietarioUid é obrigatório.");
        }
        updatePayload = {
            ocupacao: 'ALUGADO',
            proprietarioUid: data.proprietarioUid,
            inquilinoUid: data.inquilinoUid,
            responsavelUid: data.inquilinoUid,
        };
    } else {
        throw new Error(`Ocupação inválida: ${data.ocupacao}`);
    }

    try {
        await runTransaction(firestore, async (transaction) => {
            transaction.update(unidadeRef, { ...updatePayload, updatedAt: serverTimestamp() });
        });
    } catch (error) {
        console.error("Erro na transação de setOcupacaoUnidade: ", error);
        
        const contextualError = await createFirestorePermissionError({
            path: unidadeRef.path,
            operation: 'update',
            requestResourceData: updatePayload
        });
        errorEmitter.emit('permission-error', contextualError);
        throw error;
    }
}
