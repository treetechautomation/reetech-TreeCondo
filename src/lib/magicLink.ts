"use client";

import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  type Auth,
} from "firebase/auth";
import { initializeFirebase } from "@/firebase";
import { acceptInviteClient } from "@/lib/inviteClient";

const LS_EMAIL_KEY = "treecondo_magic_email";

export function getMagicEmail() {
  try {
    return window.localStorage.getItem(LS_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function setMagicEmail(email: string) {
  try {
    window.localStorage.setItem(LS_EMAIL_KEY, email);
  } catch {}
}

export function clearMagicEmail() {
  try {
    window.localStorage.removeItem(LS_EMAIL_KEY);
  } catch {}
}

export async function sendMagicLink(email: string, continueUrl: string) {
  const { auth } = initializeFirebase();

  // importante: o email usado aqui deve ser o mesmo no completeMagicLink
  setMagicEmail(email);

  const actionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: true,
  };

  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
}

export function hasMagicLinkInUrl(href?: string) {
  const url = href || (typeof window !== "undefined" ? window.location.href : "");
  if (!url) return false;
  const { auth } = initializeFirebase();
  return isSignInWithEmailLink(auth, url);
}

export async function completeMagicLink(href?: string) {
  const url = href || window.location.href;
  const { auth } = initializeFirebase();
  
  if (!isSignInWithEmailLink(auth, url)) return { ok: false, reason: "no_link" } as const;

  const stored = getMagicEmail();

  // Se perdeu localStorage (outro navegador/celular), tenta usar ?email=
  const u = new URL(url);
  const emailFromUrl = u.searchParams.get("email");
  const email = (stored || emailFromUrl || "").trim();

  if (!email) {
    return { ok: false, reason: "missing_email" } as const;
  }

  const cred = await signInWithEmailLink(auth as Auth, email, url);

  // limpa pra não reaproveitar
  clearMagicEmail();

  // Se tiver conviteId, aceita o convite (cria vínculo)
  const conviteId = u.searchParams.get("conviteId");
  if (conviteId) {
    try {
      await acceptInviteClient(conviteId);
    } catch (e: any) {
      // retorna erro amigável pro front mostrar
      return { ok: false, reason: "accept_invite_failed", error: e?.message || String(e) } as const;
    }
  }

  return { ok: true, user: cred.user } as const;
}
