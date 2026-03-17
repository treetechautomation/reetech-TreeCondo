
'use client';

import { doc, setDoc, Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { createFirestorePermissionError } from '@/firebase/errors';

/**
 * Estrutura de permissões de menu para um único papel.
 */
export const permissoesPadrao = {
  sindico: {
    anuncios: true,
    reservas: true,
    reunioes: true,
    incidentes: true,
    encomendas: true,
    documentos: true,
    enquetes: true,
    acesso: true,
    cadastros: true,
  },
  morador: {
    anuncios: true,
    reservas: true,
    reunioes: true,
    incidentes: true,
    encomendas: true,
    documentos: true,
    enquetes: true,
    acesso: true,
    cadastros: false,
  },
  porteiro: {
    anuncios: false,
    reservas: false,
    reunioes: false,
    incidentes: true,
    encomendas: true,
    documentos: false,
    enquetes: false,
    acesso: true,
    cadastros: false,
  },
};

/**
 * Cria o documento de configuração de menu padrão para um condomínio.
 * @param firestore Instância do Firestore.
 * @param condominioId O ID do condomínio.
 */
export function criarConfiguracaoDeMenuPadrao(
  firestore: Firestore,
  condominioId: string
) {
  const menuConfigRef = doc(
    firestore,
    `condominios/${condominioId}/config/menu`
  );

  // Não use await, o erro será capturado pelo listener global
  setDoc(menuConfigRef, permissoesPadrao, { merge: true }).catch(async (error) => {
    const contextualError = await createFirestorePermissionError({
      path: menuConfigRef.path,
      operation: 'create',
      requestResourceData: permissoesPadrao,
    });
    errorEmitter.emit('permission-error', contextualError);
    // Propaga o erro para que a UI possa reagir, se necessário
    throw error;
  });
}
