/**
 * ACCESS.4 — EMISSÃO DE PIN COM DETECÇÃO DE COLISÃO (§19).
 *
 * Um lookup por PIN é sempre `WHERE pinLookupHash == X` dentro de
 * `accessCredentials` de UM condomínio — se dois documentos
 * compartilharem o mesmo hash, essa query se torna ambígua
 * independentemente do status da autorização associada (mesmo uma
 * autorização REVOGADA ainda pode ter uma permanência aberta esperando
 * SAÍDA, então "ignorar colisões com autorizações revogadas" não é
 * seguro). Por isso a checagem de colisão é contra QUALQUER credential
 * existente no condomínio com o mesmo hash, sem exceção — mais simples
 * e estritamente mais correto.
 *
 * NOTA DE ESCALABILIDADE (residual, não bloqueante para o MVP): como
 * credentials nunca são apagadas neste gate (retenção é trabalho futuro
 * do ACCESS.2 "Retention"), o espaço de 1.000.000 de PINs por
 * condomínio vai se preenchendo ao longo do tempo, aumentando a taxa de
 * colisão/retry. Aceitável para o volume esperado do MVP; a decisão de
 * arquivar/expirar credentials antigas pertence a um gate futuro.
 */

import { generatePin, computePinLookupHash } from "./credential";
import { AccessApiError } from "./apiErrors";

export const PIN_GENERATION_MAX_ATTEMPTS = 10;

export interface IssuedPin {
  rawPin: string;
  pinLookupHash: string;
}

async function pinLookupHashExists(
  db: FirebaseFirestore.Firestore,
  condominioId: string,
  pinLookupHash: string,
): Promise<boolean> {
  const snap = await db
    .collection("condominios")
    .doc(condominioId)
    .collection("accessCredentials")
    .where("pinLookupHash", "==", pinLookupHash)
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * Gera um PIN sem colisão dentro do condomínio, tentando novamente até
 * `PIN_GENERATION_MAX_ATTEMPTS` vezes. Lança `AccessApiError`
 * (`PIN_GENERATION_FAILED`) se o limite for excedido — nunca retorna um
 * PIN colidente silenciosamente.
 */
export async function issueNonCollidingPin(
  db: FirebaseFirestore.Firestore,
  condominioId: string,
  hmacKey: string,
): Promise<IssuedPin> {
  for (let attempt = 0; attempt < PIN_GENERATION_MAX_ATTEMPTS; attempt++) {
    const rawPin = generatePin();
    const pinLookupHash = computePinLookupHash(rawPin, condominioId, hmacKey);
    const collides = await pinLookupHashExists(db, condominioId, pinLookupHash);
    if (!collides) return { rawPin, pinLookupHash };
  }
  throw new AccessApiError(
    "PIN_GENERATION_FAILED",
    "Não foi possível gerar um PIN único para este condomínio após múltiplas tentativas.",
  );
}
