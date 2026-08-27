/**
 * P1.0 — Ponto de entrada público da camada de domínio de Pessoas.
 *
 * Consumidores devem importar somente daqui (`@/lib/pessoas/domain`), nunca
 * de `./rules` diretamente — isso mantém a divisão interna de arquivos
 * livre para crescer (ver Padrão Oficial de Camada de Domínio) sem afetar
 * quem consome.
 */
export {
  isResident,
  hasResidentialLink,
  requiresResidentialUnit,
  isProfessionalSyndic,
  isAdministrator,
  isEmployee,
  type CategoriaPessoa,
  type PessoaVinculoSnapshot,
} from "./rules";
