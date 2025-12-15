
'use client';

import {
  deleteDoc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Firestore,
  type FirestoreError,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { createFirestorePermissionError, FirestorePermissionError } from '../errors';
import { getMoradorDocRef, getMoradoresRef, getUserVinculoDocRef } from './paths';

// Tipos baseados no backend.json

export type Contrato = {
  inicio: any; // Timestamp
  fim: any; // Timestamp
  imobiliaria?: string;
};

export type Morador = {
  id: string; // UID do Firebase Auth
  nome: string;
  email: string;
  tipo: 'PROPRIETARIO' | 'INQUILINO' | 'DEPENDENTE';
  isResponsavel: boolean;
  status: 'ATIVO' | 'INATIVO' | 'PENDENTE';
  createdAt: any; // Timestamp
  contrato?: Contrato;
  responsavelId?: string; // UID do morador responsável
};

export type MoradorPayload = Omit<Morador, 'id' | 'createdAt'>;

export type UpsertVinculoMoradorPayload = {
  condominioId: string;
  condominioNome: string;
  blocoId: string;
  unidadeId: string;
  status: 'ATIVO' | 'INATIVO' | 'PENDENTE';
};

/**
 * Inscreve-se para receber atualizações em tempo real dos moradores de uma unidade específica.
 * @param firestore Instância do Firestore.
 * @param condominioId ID do condomínio.
 * @param blocoId ID do bloco.
 * @param unidadeId ID da unidade.
 * @param onData Callback chamado com a lista de moradores.
 * @param onError Callback chamado em caso de erro.
 * @returns Uma função para cancelar a inscrição.
 */
export function subscribeMoradores(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
  onData: (data: Morador[]) => void,
  onError: (error: FirestoreError) => void
) {
  const moradoresRef = getMoradoresRef(firestore, condominioId, blocoId, unidadeId);
  const q = query(moradoresRef, orderBy('nome', 'asc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Morador)
      );
      onData(data);
    },
    (err) => {
      console.error(
        `Erro ao ouvir moradores da unidade ${unidadeId}:`,
        err
      );
      const contextualError = new FirestorePermissionError({
        operation: 'list',
        path: moradoresRef.path,
      });
      errorEmitter.emit('permission-error', contextualError);
      onError(err);
    }
  );

  return unsubscribe;
}

/**
 * Cria ou atualiza os dados de um morador em uma unidade.
 * @param firestore Instância do Firestore.
 * @param condominioId ID do condomínio.
 * @param blocoId ID do bloco.
 * @param unidadeId ID da unidade.
 * @param uid UID do morador (será o ID do documento).
 * @param payload Dados do morador.
 */
export async function salvarMorador(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
  uid: string,
  payload: MoradorPayload
): Promise<void> {
  const moradorRef = getMoradorDocRef(firestore, condominioId, blocoId, unidadeId, uid);

  try {
    const docSnap = await getDoc(moradorRef);
    
    if (docSnap.exists()) {
      // Documento existe, atualiza sem 'createdAt'
      await setDoc(moradorRef, payload, { merge: true });
    } else {
      // Documento não existe, cria com 'createdAt'
      await setDoc(moradorRef, { ...payload, createdAt: serverTimestamp() }, { merge: true });
    }

  } catch (error: any) {
    if (error.code === 'permission-denied') {
        try {
            // Se a leitura falhou por permissão, tentamos escrever como se fosse um documento novo.
            await setDoc(moradorRef, { ...payload, createdAt: serverTimestamp() }, { merge: true });
            return; // Sucesso no fallback.
        } catch (writeError) {
            // Se a escrita do fallback também falhar, emitimos o erro e propagamos.
            console.error('Erro de fallback ao salvar morador:', writeError);
            const contextualError = await createFirestorePermissionError({
                path: moradorRef.path,
                operation: 'write', 
                requestResourceData: payload,
            });
            errorEmitter.emit('permission-error', contextualError);
            throw writeError;
        }
    }
    
    // Se o erro inicial não foi de permissão na leitura, propaga o erro original.
    console.error('Erro ao salvar morador:', error);
    const contextualError = await createFirestorePermissionError({
      path: moradorRef.path,
      operation: 'write',
      requestResourceData: payload,
    });
    errorEmitter.emit('permission-error', contextualError);
    throw error;
  }
}


/**
 * Remove um morador de uma unidade.
 * @param firestore Instância do Firestore.
 * @param condominioId ID do condomínio.
 * @param blocoId ID do bloco.
 * @param unidadeId ID da unidade.
 * @param uid UID do morador a ser removido.
 */
export async function removerMorador(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
  uid: string
): Promise<void> {
  const moradorRef = getMoradorDocRef(firestore, condominioId, blocoId, unidadeId, uid);

  try {
    await deleteDoc(moradorRef);
  } catch (error) {
    console.error("Erro ao remover morador:", error);
    const contextualError = await createFirestorePermissionError({
      path: moradorRef.path,
      operation: 'delete',
    });
    errorEmitter.emit('permission-error', contextualError);
    throw error;
  }
}

/**
 * Cria ou atualiza o documento de vínculo de acesso rápido para um morador.
 * @param firestore Instância do Firestore.
 * @param uid O UID do usuário/morador.
 * @param payload Dados do vínculo.
 */
export async function upsertVinculoMorador(
  firestore: Firestore,
  uid: string,
  payload: UpsertVinculoMoradorPayload
): Promise<void> {
  const vinculoRef = getUserVinculoDocRef(firestore, uid, payload.condominioId);
  const data = {
    ...payload,
    role: 'MORADOR',
  };

  try {
    await runTransaction(firestore, async (transaction) => {
      const vinculoDoc = await transaction.get(vinculoRef);

      if (vinculoDoc.exists()) {
        // Documento existe, atualiza com updatedAt
        transaction.update(vinculoRef, { ...data, updatedAt: serverTimestamp() });
      } else {
        // Documento não existe, cria com createdAt e updatedAt
        transaction.set(vinculoRef, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
    });
  } catch (error) {
    console.error('Erro ao fazer upsert do vínculo do morador:', error);
     const contextualError = await createFirestorePermissionError({
      path: vinculoRef.path,
      operation: 'write',
      requestResourceData: data,
    });
    errorEmitter.emit('permission-error', contextualError);
    throw error;
  }
}
