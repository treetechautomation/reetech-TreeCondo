import {
  Firestore,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

export type VeiculoDoc = {
  marca: string;
  modelo: string;
  cor: string;
  ano: number;
  placa: string;
  tagNumero: string; // UPPER
  createdAt?: any;
  updatedAt?: any;
};

export type Veiculo = VeiculoDoc & { id: string };

function normTag(tag: string) {
  return String(tag || "").trim().toUpperCase();
}

function veiculosCol(db: Firestore, condominioId: string, uid: string) {
  return collection(db, `condominios/${condominioId}/membros/${uid}/veiculos`);
}

function veiculoRef(db: Firestore, condominioId: string, uid: string, veiculoId: string) {
  return doc(db, `condominios/${condominioId}/membros/${uid}/veiculos/${veiculoId}`);
}

function tagRef(db: Firestore, condominioId: string, tagNumero: string) {
  return doc(db, `condominios/${condominioId}/tagsVeiculos/${tagNumero}`);
}

export async function listVeiculos(db: Firestore, condominioId: string, uid: string) {
  const q = query(veiculosCol(db, condominioId, uid), orderBy("tagNumero", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Veiculo[];
}

/**
 * Create com unicidade de TAG via índice /tagsVeiculos/{tagNumero}
 */
export async function createVeiculo(
  db: Firestore,
  condominioId: string,
  uid: string,
  input: VeiculoDoc
) {
  const tagNumero = normTag(input.tagNumero);
  if (!tagNumero) throw new Error("TAG obrigatória.");

  const newRef = doc(veiculosCol(db, condominioId, uid)); // id gerado
  const tRef = tagRef(db, condominioId, tagNumero);

  await runTransaction(db, async (tx) => {
    const tSnap = await tx.get(tRef);
    if (tSnap.exists()) {
      throw new Error(`TAG ${tagNumero} já está cadastrada neste condomínio.`);
    }

    tx.set(newRef, {
      ...input,
      tagNumero,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.set(tRef, {
      uid,
      veiculoId: newRef.id,
      tagNumero,
      createdAt: serverTimestamp(),
    });
  });

  return newRef.id;
}

/**
 * Update com troca segura de TAG (se mudou):
 * - valida nova TAG livre
 * - cria novo índice
 * - apaga índice antigo
 */
export async function updateVeiculo(
  db: Firestore,
  condominioId: string,
  uid: string,
  veiculoId: string,
  input: Partial<VeiculoDoc>
) {
  const vRef = veiculoRef(db, condominioId, uid, veiculoId);

  await runTransaction(db, async (tx) => {
    const vSnap = await tx.get(vRef);
    if (!vSnap.exists()) throw new Error("Veículo não encontrado.");

    const atual = vSnap.data() as VeiculoDoc;
    const tagAtual = normTag(atual.tagNumero);
    const tagNova = normTag(input.tagNumero ?? tagAtual);

    if (!tagNova) throw new Error("TAG obrigatória.");

    // Se mudou a TAG, precisamos trocar o índice
    if (tagNova !== tagAtual) {
      const oldTagRef = tagRef(db, condominioId, tagAtual);
      const newTagRef = tagRef(db, condominioId, tagNova);

      const newTagSnap = await tx.get(newTagRef);
      if (newTagSnap.exists()) {
        throw new Error(`TAG ${tagNova} já está cadastrada neste condomínio.`);
      }

      // cria novo índice
      tx.set(newTagRef, {
        uid,
        veiculoId,
        tagNumero: tagNova,
        createdAt: serverTimestamp(),
      });

      // remove índice antigo (se existir)
      const oldTagSnap = await tx.get(oldTagRef);
      if (oldTagSnap.exists()) tx.delete(oldTagRef);
    }

    tx.set(
      vRef,
      {
        ...input,
        tagNumero: tagNova,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });
}

/**
 * Delete: apaga o veículo e o índice da TAG.
 */
export async function deleteVeiculo(
  db: Firestore,
  condominioId: string,
  uid: string,
  veiculoId: string
) {
  const vRef = veiculoRef(db, condominioId, uid, veiculoId);

  await runTransaction(db, async (tx) => {
    const vSnap = await tx.get(vRef);
    if (!vSnap.exists()) return;

    const v = vSnap.data() as VeiculoDoc;
    const tagNumero = normTag(v.tagNumero);

    tx.delete(vRef);

    if (tagNumero) {
      const tRef = tagRef(db, condominioId, tagNumero);
      const tSnap = await tx.get(tRef);
      // só apaga se apontar pro mesmo veículo (proteção extra)
      if (tSnap.exists() && (tSnap.data() as any)?.veiculoId === veiculoId) {
        tx.delete(tRef);
      }
    }
  });
}
