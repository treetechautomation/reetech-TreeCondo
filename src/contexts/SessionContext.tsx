"use client";

import React, { useContext, type ReactNode } from "react";
import { registerFcmToken } from "@/lib/fcm";
import { useFirestore, getFirebaseApp } from "@/firebase";
import { useSessionBase, SessionContext, type SessionContextType } from "@/hooks/useSession";

export function SessionProvider({ children }: { children: ReactNode }) {
  const firestore = useFirestore();
  const app = getFirebaseApp();
  const value = useSessionBase();

  React.useEffect(() => {
    const uid = (value as any)?.user?.uid ?? null;
    if (!uid || !firestore || !app) return;
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) return;

    registerFcmToken({ app, firestore, uid }).catch(() => undefined);
  }, [(value as any)?.user?.uid, firestore, app]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionCtx(): SessionContextType {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error(
      "useSessionCtx deve ser usado dentro de SessionProvider",
    );
  }
  return ctx;
}
