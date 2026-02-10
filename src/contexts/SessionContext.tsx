"use client";

import React, {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { registerFcmToken } from "@/lib/fcm";
import { useFirestore, getFirebaseApp } from "@/firebase";
import { useSessionBase, type Session } from "@/hooks/useSession";

export type SessionContextType = {
  session: Session | null;
  user: Session["user"] | null;
  isSessionLoading: boolean;
  isUserLoading: boolean;
  isAuthenticated: boolean;
  activeCondominioId: string | null;
  setActiveCondominioId: (id: string | null) => void;
  claims: Record<string, any> | null;
};

const SessionContext = createContext<SessionContextType | undefined>(
  undefined,
);

export function SessionProvider({ children }: { children: ReactNode }) {

  // ---- FCM (Push Notifications) ----
  // registra token no login (web). Requer NEXT_PUBLIC_FIREBASE_VAPID_KEY e SW /firebase-messaging-sw.js
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
