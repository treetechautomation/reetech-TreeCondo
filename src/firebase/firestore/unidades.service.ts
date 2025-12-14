
"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { errorEmitter } from "../error-emitter";
import { FirestorePermissionError } from "../errors";
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
}

/**
 * Hook para listar as unidades de um bloco em tempo real.
 * @param condominioId O ID do condomínio.
 * @param blocoId O ID do bloco.
 */
export function useUnidades(condominioId: string | null, blocoId: string | null) {
  const firestore = useFirestore();
  const [data, setData] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!condominioId || !blocoId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unidadesRef = getUnidadesRef(firestore, condominioId, blocoId);
    const q = query(unidadesRef, orderBy("numero", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Unidade[];
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`Erro ao ouvir unidades do bloco ${blocoId}:`, err);
        const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: `condominios/${condominioId}/blocos/${blocoId}/unidades`,
        });
        errorEmitter.emit('permission-error', contextualError);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [condominioId, blocoId, firestore]);

  return { data, loading };
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
  const unidadesRef = getUnidadesRef(firestore, condominioId, blocoId);
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
      const contextualError = new FirestorePermissionError({
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
      const contextualError = new FirestorePermissionError({
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
      const contextualError = new FirestorePermissionError({
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
  
  await runTransaction(firestore, async (transaction) => {
    // A leitura dentro da transação é opcional aqui, pois estamos sobrescrevendo os campos.
    // Mas seria necessária se a lógica dependesse do estado atual do documento.
    
    let updatePayload: UpdateUnidadePayload = { ocupacao: data.ocupacao };

    if (data.ocupacao === 'VAGO') {
      updatePayload = {
        ...updatePayload,
        proprietarioUid: null,
        inquilinoUid: null,
        responsavelUid: null,
      };
    } else if (data.ocupacao === 'PROPRIETARIO') {
      if (!data.proprietarioUid) {
        throw new Error("Para ocupação 'PROPRIETARIO', o proprietarioUid é obrigatório.");
      }
      updatePayload = {
        ...updatePayload,
        proprietarioUid: data.proprietarioUid,
        inquilinoUid: null, // Garante que não há inquilino
        responsavelUid: data.proprietarioUid, // Responsável é o proprietário
      };
    } else if (data.ocupacao === 'ALUGADO') {
      if (!data.inquilinoUid) {
        throw new Error("Para ocupação 'ALUGADO', o inquilinoUid é obrigatório.");
      }
       updatePayload = {
        ...updatePayload,
        // O proprietário existente é mantido se não for passado um novo.
        // Se data.proprietarioUid for undefined, o campo não é alterado.
        ...(data.proprietarioUid !== undefined && { proprietarioUid: data.proprietarioUid }),
        inquilinoUid: data.inquilinoUid,
        responsavelUid: data.inquilinoUid, // Responsável é o inquilino
      };
    } else {
        throw new Error(`Ocupação inválida: ${data.ocupacao}`);
    }
    
    transaction.update(unidadeRef, { ...updatePayload, updatedAt: serverTimestamp() });
  }).catch(error => {
    // Trata tanto os erros de validação (throw new Error) quanto os erros do Firestore (regras de segurança)
    console.error("Erro na transação de setOcupacaoUnidade: ", error);
    if (!(error instanceof FirestorePermissionError)) {
        const contextualError = new FirestorePermissionError({
            path: unidadeRef.path,
            operation: 'update',
            requestResourceData: data
        });
        errorEmitter.emit('permission-error', contextualError);
    }
    throw error;
  });
}
