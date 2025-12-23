"use client";

import { useCallback, useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { initializeFirebase } from "@/firebase";

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, senha: string) => {
    setIsLoading(true);
    try {
      const { auth } = initializeFirebase();
      await signInWithEmailAndPassword(auth, email, senha);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      const { auth } = initializeFirebase();
      await signOut(auth);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { login, logout, isLoading };
}
