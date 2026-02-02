"use client";

import { doc, setDoc, serverTimestamp, type Firestore } from "firebase/firestore";

type RoleKey = "sindico" | "morador" | "porteiro";

export async function saveMenuPermissions(params: {
  firestore: Firestore;
  condominioId: string;
  modules: Record<string, Record<RoleKey, boolean>>;
  updatedBy: string;
}) {
  const { firestore, condominioId, modules, updatedBy } = params;

  const ref = doc(firestore, `condominios/${condominioId}/config/menuPermissions`);

  await setDoc(
    ref,
    {
      modules,
      updatedBy,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
