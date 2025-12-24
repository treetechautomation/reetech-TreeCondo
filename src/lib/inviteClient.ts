"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeFirebase } from "@/firebase";

export async function acceptInviteClient(conviteId: string) {
  const { app } = initializeFirebase();
  const fn = httpsCallable(getFunctions(app, "us-central1"), "acceptInvite");
  const res = await fn({ conviteId });
  return res.data as any;
}
