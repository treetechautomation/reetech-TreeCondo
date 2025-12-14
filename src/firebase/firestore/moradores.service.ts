
'use client';

import {
  deleteDoc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Firestore,
  type FirestoreError,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';
import { getMoradorDocRef, getMoradoresRef } from './paths';

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
    
    const data = docSnap.exists()
      ? payload // Se existe, só atualiza o payload, preservando createdAt
      : { ...payload, createdAt: serverTimestamp() }; // Se não existe, adiciona createdAt

    await setDoc(moradorRef, data, { merge: true });

  } catch (error: any) {
    // Se getDoc falhar (ex: por regras de segurança), tentamos escrever assumindo que é uma criação.
    // Isso garante que `createdAt` seja definido na primeira tentativa de escrita.
    if (error.code === 'permission-denied') {
        try {
            const dataWithTimestamp = { ...payload, createdAt: serverTimestamp() };
            await setDoc(moradorRef, dataWithTimestamp, { merge: true });
            return; // Sucesso no fallback, sai da função.
        } catch (writeError) {
             // Se a escrita do fallback também falhar, emitimos o erro e propagamos.
            const contextualError = new FirestorePermissionError({
                path: moradorRef.path,
                operation: 'write', 
                requestResourceData: payload,
            });
            errorEmitter.emit('permission-error', contextualError);
            throw writeError;
        }
    }
    
    // Se o erro não for de permissão na leitura, propaga o erro original.
    console.error('Erro ao salvar morador:', error);
    const contextualError = new FirestorePermissionError({
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
    const contextualError = new FirestorePermissionError({
      path: moradorRef.path,
      operation: 'delete',
    });
    errorEmitter.emit('permission-error', contextualError);
    throw error;
  }
}
