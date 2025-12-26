"use client";

import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  updatePassword,
} from "firebase/auth";
import { initializeFirebase } from "@/firebase";

const STORAGE_KEY = "treecondo_magic_email";

/**
 * Envia link mágico para o e-mail informado.
 * Observação: este método é CLIENT-SIDE (firebase/auth).
 */
export async function sendMagicLink(email: string) {
  const { auth } = initializeFirebase();

  const actionCodeSettings = {
    url: `${window.location.origin}/login`,
    handleCodeInApp: true,
  };

  window.localStorage.setItem(STORAGE_KEY, email);
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
}

/**
 * Completa o login via link mágico se houver link na URL.
 * - Se não tiver e-mail salvo (ex: abriu em outro dispositivo), retorna { needEmail: true }
 */
export async function completeMagicLinkIfPresent(providedEmail?: string): Promise<{
  completed: boolean;
  needEmail?: boolean;
  userEmail?: string | null;
}> {
  const { auth } = initializeFirebase();
  const href = window.location.href;

  if (!isSignInWithEmailLink(auth, href)) {
    return { completed: false };
  }

  const storedEmail = window.localStorage.getItem(STORAGE_KEY) || "";
  const email = (providedEmail || storedEmail || "").trim();

  if (!email) {
    return { completed: false, needEmail: true };
  }

  const cred = await signInWithEmailLink(auth, email, href);

  // limpa para evitar reaproveitar
  window.localStorage.removeItem(STORAGE_KEY);

  // limpa o link da URL (deixa /login limpinho)
  window.history.replaceState({}, document.title, "/login");

  return { completed: true, userEmail: cred.user?.email ?? null };
}

/**
 * Depois do primeiro acesso (link mágico), o usuário cria a própria senha.
 */
export async function setPasswordAfterMagicLink(newPassword: string) {
  const { auth } = initializeFirebase();
  if (!auth.currentUser) throw new Error("Usuário não autenticado.");
  await updatePassword(auth.currentUser, newPassword);
}
