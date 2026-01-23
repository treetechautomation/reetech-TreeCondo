"use client";

import React, {
  createContext,
  useContext,
  type ReactNode,
} from "react";
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
  const value = useSessionBase();
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
