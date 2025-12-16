"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useSession, Session } from "@/hooks/useSession";

interface SessionContextType {
  session: Session | null;
  isSessionLoading: boolean;
  error: Error | null;
  setActiveCondominioId: (condominioId: string) => void;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { session, isSessionLoading, error, setActiveCondominioId, refreshSession } = useSession();

  const value = {
    session,
    isSessionLoading,
    error,
    setActiveCondominioId,
    refreshSession,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionCtx() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSessionCtx must be used within a SessionProvider");
  }
  return context;
}
