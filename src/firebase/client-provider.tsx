"use client";

import type { ReactNode } from "react";
import { initializeFirebase } from "./index";

/**
 * Provider mínimo: apenas inicializa o Firebase no client
 * e renderiza os children.
 */
export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  initializeFirebase();
  return <>{children}</>;
}
