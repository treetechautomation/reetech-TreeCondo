import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import type { FichaMorador } from "../validators/ficha.schema";

export async function loadFicha(params: {
  firestore: Firestore;
  condominioId: string;
  uid: string;
}): Promise<{ ficha: FichaMorador | null; membro: any | null }> {
  const { firestore, condominioId, uid } = params;

  const membroRef = doc(firestore, `condominios/${condominioId}/membros/${uid}`);
  const snap = await getDoc(membroRef);

  if (!snap.exists()) return { ficha: null, membro: null };

  const data = snap.data();
  return {
    ficha: (data?.ficha ?? null) as FichaMorador | null,
    membro: data ?? null,
  };
}

export async function saveFicha(params: {
  firestore: Firestore;
  condominioId: string;
  uid: string;
  ficha: FichaMorador;
  updatedByUid?: string | null;
}): Promise<void> {
  const { firestore, condominioId, uid, ficha, updatedByUid } = params;

  const membroRef = doc(firestore, `condominios/${condominioId}/membros/${uid}`);

  await setDoc(
    membroRef,
    {
      ficha,
      fichaUpdatedAt: serverTimestamp(),
      fichaUpdatedBy: updatedByUid ?? null,
      updatedAt: serverTimestamp(),
      updatedBy: updatedByUid ?? null,
    },
    { merge: true }
  );
}
