
'use client';

import {
  collection,
  deleteDoc,
  doc,
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
  const moradoresRef = collection(
    firestore,
    `/condominios/${condominioId}/blocos/${blocoId}/unidades/${unidadeId}/moradores`
  );
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
  const moradorRef = doc(
    firestore,
    `/condominios/${condominioId}/blocos/${blocoId}/unidades/${unidadeId}/moradores`,
    uid
  );

  try {
    const docSnap = await getDoc(moradorRef);
    const data = {
      ...payload,
      // Adiciona createdAt apenas se o documento não existir
      ...(!docSnap.exists() && { createdAt: serverTimestamp() }),
    };

    // Usamos `setDoc` com `merge` para criar ou atualizar o documento.
    setDoc(moradorRef, data, { merge: true }).catch((error) => {
      const contextualError = new FirestorePermissionError({
        path: moradorRef.path,
        operation: docSnap.exists() ? 'update' : 'create',
        requestResourceData: data,
      });
      errorEmitter.emit('permission-error', contextualError);
      throw error; // Re-throw para a UI
    });
  } catch (error) {
    console.error('Erro ao verificar documento do morador antes de salvar:', error);
    // Mesmo se a leitura falhar (ex: por regras), tentamos a escrita
    // e deixamos o .catch() lidar com o erro de permissão.
    setDoc(moradorRef, payload, { merge: true }).catch((writeError) => {
        const contextualError = new FirestorePermissionError({
          path: moradorRef.path,
          operation: 'write', // Operação genérica pois não sabemos se existia
          requestResourceData: payload,
        });
        errorEmitter.emit('permission-error', contextualError);
        throw writeError; // Re-throw para a UI
    });
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
export function removerMorador(
  firestore: Firestore,
  condominioId: string,
  blocoId: string,
  unidadeId: string,
  uid: string
): void {
  const moradorRef = doc(
    firestore,
    `/condominios/${condominioId}/blocos/${blocoId}/unidades/${unidadeId}/moradores`,
    uid
  );

  deleteDoc(moradorRef).catch((error) => {
    const contextualError = new FirestorePermissionError({
      path: moradorRef.path,
      operation: 'delete',
    });
    errorEmitter.emit('permission-error', contextualError);
    throw error; // Re-throw para a UI
  });
}
