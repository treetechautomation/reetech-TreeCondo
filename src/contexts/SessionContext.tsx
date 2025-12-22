"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
} from "react";

import {
  useSessionBase,
  type Session,
} from "@/hooks/useSession";

interface SessionContextValue {
  session: Session | null;
  isSessionLoading: boolean;
  setActiveCondominioId: (id: string | null) => void;
  refreshClaims: () => Promise<void> | void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const {
    session,
    isSessionLoading,
    setActiveCondominioId,
    refreshClaims,
  } = useSessionBase();

  return (
    <SessionContext.Provider
      value={{
        session,
        isSessionLoading,
        setActiveCondominioId,
        refreshClaims,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionCtx(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSessionCtx must be used within SessionProvider");
  }
  return ctx;
}
