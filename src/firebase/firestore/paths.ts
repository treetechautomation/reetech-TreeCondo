
import { collection, doc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

/**
 * Funções para obter referências de coleções e documentos no Firestore,
 * garantindo a consistência dos caminhos em toda a aplicação.
 */

// Coleções
export const getCondominiosRef = (db: Firestore) => collection(db, 'condominios');
export const getBlocosRef = (db: Firestore, condominioId: string) => collection(db, `condominios/${condominioId}/blocos`);
export const getUnidadesRef = (db: Firestore, condominioId: string, blocoId: string) => collection(db, `condominios/${condominioId}/blocos/${blocoId}/unidades`);
export const getMoradoresRef = (db: Firestore, condominioId: string, blocoId: string, unidadeId: string) => collection(db, `condominios/${condominioId}/blocos/${blocoId}/unidades/${unidadeId}/moradores`);
export const getVeiculosRef = (db: Firestore, condominioId: string, blocoId: string, unidadeId: string) => collection(db, `condominios/${condominioId}/blocos/${blocoId}/unidades/${unidadeId}/veiculos`);
export const getPetsRef = (db: Firestore, condominioId: string, blocoId: string, unidadeId: string) => collection(db, `condominios/${condominioId}/blocos/${blocoId}/unidades/${unidadeId}/pets`);
export const getMembrosRef = (db: Firestore, condominioId: string) => collection(db, `condominios/${condominioId}/membros`);
export const getFuncionariosRef = (db: Firestore, condominioId: string) => collection(db, `condominios/${condominioId}/funcionarios`);
export const getFornecedoresRef = (db: Firestore, condominioId: string) => collection(db, `condominios/${condominioId}/fornecedores`);
export const getUserVinculosRef = (db: Firestore, uid: string) => collection(db, `userCondominios/${uid}/vinculos`);

// Documentos
export const getCondominioDocRef = (db: Firestore, condominioId: string) => doc(db, 'condominios', condominioId);
export const getBlocoDocRef = (db: Firestore, condominioId: string, blocoId: string) => doc(db, `condominios/${condominioId}/blocos`, blocoId);
export const getUnidadeDocRef = (db: Firestore, condominioId: string, blocoId: string, unidadeId: string) => doc(db, `condominios/${condominioId}/blocos/${blocoId}/unidades`, unidadeId);
export const getMoradorDocRef = (db: Firestore, condominioId: string, blocoId: string, unidadeId: string, uid: string) => doc(db, `condominios/${condominioId}/blocos/${blocoId}/unidades/${unidadeId}/moradores`, uid);
export const getMembroDocRef = (db: Firestore, condominioId: string, uid: string) => doc(db, `condominios/${condominioId}/membros`, uid);
export const getUserVinculoDocRef = (db: Firestore, uid: string, condominioId: string) => doc(db, `userCondominios/${uid}/vinculos`, condominioId);
export const getConfigMenuDocRef = (db: Firestore, condominioId: string) => doc(db, `condominios/${condominioId}/config/menu`);
export const getFuncionarioDocRef = (db: Firestore, condominioId: string, funcionarioId: string) => doc(db, `condominios/${condominioId}/funcionarios`, funcionarioId);
export const getFornecedorDocRef = (db: Firestore, condominioId: string, fornecedorId: string) => doc(db, `condominios/${condominioId}/fornecedores`, fornecedorId);
export const getVeiculoDocRef = (db: Firestore, condominioId: string, blocoId: string, unidadeId: string, veiculoId: string) => doc(db, `condominios/${condominioId}/blocos/${blocoId}/unidades/${unidadeId}/veiculos`, veiculoId);
export const getPetDocRef = (db: Firestore, condominioId: string, blocoId: string, unidadeId: string, petId: string) => doc(db, `condominios/${condominioId}/blocos/${blocoId}/unidades/${unidadeId}/pets`, petId);

