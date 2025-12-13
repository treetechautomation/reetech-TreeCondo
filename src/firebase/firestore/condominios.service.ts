"use client";

import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { Firestore } from "firebase/firestore";

export async function criarCondominio(
  firestore: Firestore,
  adminUid: string,
  payload: {
    nome: string;
    cnpj?: string;
    cep?: string;
    sindico?: string;
    contato?: string;
  }
) {
  const ref = await addDoc(collection(firestore, "condominios"), {
    nome: payload.nome,
    cnpj: payload.cnpj ?? null,
    cep: payload.cep ?? null,
    sindico: payload.sindico ?? null,
    contato: payload.contato ?? null,
    ativo: true,
    createdAt: serverTimestamp(),
    createdBy: adminUid,
  });

  return ref.id;
}

export async function deletarCondominio(firestore: Firestore, condominioId: string) {
  await deleteDoc(doc(firestore, "condominios", condominioId));
}
