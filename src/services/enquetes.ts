import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  increment,
  type Firestore,
  Timestamp,
} from "firebase/firestore";

export type EnqueteTipo = "VOTACAO" | "PESQUISA" | "COLETA_TEMAS";
export type EnqueteStatus = "ABERTA" | "ENCERRADA";

export type Enquete = {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: EnqueteTipo;
  status: EnqueteStatus;
  encerraEm?: any; // Timestamp
  totalVotos?: number;
  createdAt?: any;
  updatedAt?: any;
  createdByUid?: string;
};

export type EnqueteOpcao = {
  id: string;
  titulo: string;
  ordem?: number;
  votos?: number;
};

export type MeuVoto = {
  opcaoId: string;
  createdAt?: any;
};

export function enquetesRef(firestore: Firestore, condId: string) {
  return collection(firestore, `condominios/${condId}/enquetes`);
}

export function enqueteRef(firestore: Firestore, condId: string, enqueteId: string) {
  return doc(firestore, `condominios/${condId}/enquetes/${enqueteId}`);
}

export function opcoesRef(firestore: Firestore, condId: string, enqueteId: string) {
  return collection(firestore, `condominios/${condId}/enquetes/${enqueteId}/opcoes`);
}

export function votoRef(firestore: Firestore, condId: string, enqueteId: string, uid: string) {
  return doc(firestore, `condominios/${condId}/enquetes/${enqueteId}/votos/${uid}`);
}

export function listenEnquetes(
  firestore: Firestore,
  condId: string,
  onData: (items: Enquete[]) => void,
  onError?: (e: any) => void
) {
  const qy = query(enquetesRef(firestore, condId), orderBy("updatedAt", "desc"));
  return onSnapshot(
    qy,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Enquete))),
    (e) => onError?.(e)
  );
}

export function listenOpcoes(
  firestore: Firestore,
  condId: string,
  enqueteId: string,
  onData: (items: EnqueteOpcao[]) => void,
  onError?: (e: any) => void
) {
  const qy = query(opcoesRef(firestore, condId, enqueteId), orderBy("ordem", "asc"));
  return onSnapshot(
    qy,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as EnqueteOpcao))),
    (e) => onError?.(e)
  );
}

export function listenMeuVoto(
  firestore: Firestore,
  condId: string,
  enqueteId: string,
  uid: string,
  onData: (vote: MeuVoto | null) => void
) {
  const ref = votoRef(firestore, condId, enqueteId, uid);
  return onSnapshot(ref, (snap) => {
    onData(snap.exists() ? (snap.data() as any as MeuVoto) : null);
  });
}

export async function criarEnquete(
  firestore: Firestore,
  condId: string,
  payload: {
    titulo: string;
    descricao?: string;
    tipo: EnqueteTipo;
    encerraEm?: Date | null;
    createdByUid?: string;
    opcoes: Array<{ titulo: string }>;
  }
) {
  const refCol = enquetesRef(firestore, condId);
  const now = serverTimestamp();

  // cria doc com id automático via setDoc em doc() gerado
  const docRef = doc(refCol);
  const enqueteId = docRef.id;
  
  const docPayload: any = {
    titulo: payload.titulo,
    descricao: payload.descricao || "",
    tipo: payload.tipo,
    status: "ABERTA",
    totalVotos: 0,
    createdAt: now,
    updatedAt: now,
    createdByUid: payload.createdByUid || null,
  };

  if (payload.encerraEm) {
    docPayload.encerraEm = Timestamp.fromDate(payload.encerraEm);
  }

  await setDoc(docRef, docPayload);
  
  // cria opções
  const baseOpcoes = payload.opcoes
    .filter((o) => (o.titulo || "").trim().length > 0)
    .map((o, idx) => ({ titulo: o.titulo.trim(), ordem: idx + 1, votos: 0 }));

  for (const op of baseOpcoes) {
    const opRef = doc(opcoesRef(firestore, condId, enqueteId));
    await setDoc(opRef, { ...op, createdAt: now, updatedAt: now });
  }

  return enqueteId;
}

export async function encerrarEnquete(firestore: Firestore, condId: string, enqueteId: string) {
  const ref = enqueteRef(firestore, condId, enqueteId);
  await updateDoc(ref, { status: "ENCERRADA", updatedAt: serverTimestamp() });
}

export async function votar(
  firestore: Firestore,
  condId: string,
  enqueteId: string,
  uid: string,
  opcaoId: string
) {
  const refEnq = enqueteRef(firestore, condId, enqueteId);
  const refVoto = votoRef(firestore, condId, enqueteId, uid);
  const refOpcao = doc(firestore, `condominios/${condId}/enquetes/${enqueteId}/opcoes/${opcaoId}`);

  await runTransaction(firestore, async (tx) => {
    const enqSnap = await tx.get(refEnq);
    if (!enqSnap.exists()) throw new Error("Enquete não encontrada.");

    const enq = enqSnap.data() as any;
    if (String(enq.status || "").toUpperCase() !== "ABERTA") {
      throw new Error("Enquete encerrada.");
    }
    
    const votoSnap = await tx.get(refVoto);
    if (votoSnap.exists()) {
      // idempotente: se já votou, não duplica
      throw new Error("Você já votou nesta enquete.");
    }

    const opcSnap = await tx.get(refOpcao);
    if (!opcSnap.exists()) throw new Error("Opção não encontrada.");

    tx.set(refVoto, { opcaoId, createdAt: serverTimestamp() });

    // incrementos (cache)
    tx.update(refOpcao, { votos: increment(1), updatedAt: serverTimestamp() });
    tx.update(refEnq, { totalVotos: increment(1), updatedAt: serverTimestamp() });
  });
}
