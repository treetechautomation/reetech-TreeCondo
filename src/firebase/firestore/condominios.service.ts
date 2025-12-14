
'use client';

import {
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
  type FirestoreError,
} from 'firebase/firestore';
import {
  getCondominioDocRef,
  getCondominiosRef,
  getMembroDocRef,
  getUserVinculoDocRef,
} from './paths';
import { createFirestorePermissionError, FirestorePermissionError } from '../errors';
import { errorEmitter } from '../error-emitter';

// Tipos baseados no backend.json
export type Condominio = {
  id: string;
  nome: string;
  cnpj?: string;
  cep?: string;
  ativo: boolean;
  createdAt: any; // serverTimestamp()
  createdBy: string;
};

export type NewCondominioPayload = Pick<Condominio, 'nome' | 'cnpj' | 'cep'>;
export type UpdateCondominioPayload = Partial<NewCondominioPayload & { ativo: boolean }>;

/**
 * Inscreve-se para receber atualizações em tempo real da coleção de condomínios.
 * Apenas Super Admins devem ter permissão para esta função.
 * @param firestore Instância do Firestore.
 * @param onData Callback chamado com a lista de condomínios.
 * @param onError Callback chamado em caso de erro de permissão ou outros.
 * @returns Uma função para cancelar a inscrição (unsubscribe).
 */
export function subscribeCondominios(
  firestore: Firestore,
  onData: (data: Condominio[]) => void,
  onError: (error: FirestoreError) => void
) {
  const condominiosRef = getCondominiosRef(firestore);
  const q = query(condominiosRef, orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Condominio)
      );
      onData(data);
    },
    (err) => {
      // Listeners são síncronos, então usamos o construtor síncrono do erro.
      const contextualError = new FirestorePermissionError({
        operation: 'list',
        path: condominiosRef.path,
      });
      errorEmitter.emit('permission-error', contextualError);
      onError(err);
    }
  );

  return unsubscribe;
}

/**
 * Cria um novo condomínio e toda a sua estrutura inicial necessária de forma atômica.
 * @param firestore Instância do Firestore.
 * @param superAdminUid UID do Super Admin que está criando o condomínio.
 * @param payload Dados do novo condomínio.
 */
export async function criarCondominio(
  firestore: Firestore,
  superAdminUid: string,
  payload: NewCondominioPayload
): Promise<void> {
  const condominioRef = doc(collection(firestore, 'condominios'));
  const membroRef = getMembroDocRef(firestore, condominioRef.id, superAdminUid);
  const vinculoRef = getUserVinculoDocRef(firestore, superAdminUid, condominioRef.id);
      
  try {
    await runTransaction(firestore, async (transaction) => {
      
      // 1. Cria o documento principal do condomínio
      transaction.set(condominioRef, {
        ...payload,
        ativo: true,
        createdAt: serverTimestamp(),
        createdBy: superAdminUid,
      });

      // 2. Associa o criador como o primeiro síndico
      transaction.set(membroRef, {
        role: 'SINDICO',
        status: 'ATIVO',
        createdAt: serverTimestamp(),
        createdBy: superAdminUid,
      });

      // 3. Cria o vínculo de acesso para o síndico
      transaction.set(vinculoRef, {
        condominioId: condominioRef.id,
        condominioNome: payload.nome,
        role: 'SINDICO',
        status: 'ATIVO',
      });
    });
  } catch (error) {
    console.error('Falha na transação de criar condomínio:', error);
    // Operações async usam a factory async para incluir claims.
    const contextualError = await createFirestorePermissionError({
      path: `condominios/${condominioRef.id}`,
      operation: 'write', // transação é uma escrita
      requestResourceData: payload
    });
    errorEmitter.emit('permission-error', contextualError);
    // Propaga o erro para que a UI possa lidar com ele.
    throw error;
  }
}

/**
 * Atualiza os dados de um condomínio.
 * @param firestore Instância do Firestore.
 * @param condominioId ID do condomínio a ser atualizado.
 * @param patch Objeto com os campos a serem atualizados.
 */
export async function atualizarCondominio(
  firestore: Firestore,
  condominioId: string,
  patch: UpdateCondominioPayload
): Promise<void> {
  const docRef = getCondominioDocRef(firestore, condominioId);
  const data = { ...patch, updatedAt: serverTimestamp() };
  try {
    await updateDoc(docRef, data);
  } catch (error) {
    console.error('Erro ao atualizar condomínio:', error);
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
 * Deleta um condomínio.
 * ATENÇÃO: Esta é uma operação destrutiva e não remove subcoleções automaticamente.
 * @param firestore Instância do Firestore.
 * @param condominioId ID do condomínio a ser deletado.
 */
export async function deletarCondominio(
  firestore: Firestore,
  condominioId: string
): Promise<void> {
  const docRef = getCondominioDocRef(firestore, condominioId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Erro ao deletar condomínio:', error);
    const contextualError = await createFirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    });
    errorEmitter.emit('permission-error', contextualError);
    throw error;
  }
}
