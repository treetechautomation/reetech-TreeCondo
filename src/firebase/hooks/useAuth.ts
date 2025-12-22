"use client";

import {
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/firebase";

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const auth = getFirebaseAuth();

  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });

    return unsub;
  }, [auth]);

  const login = useCallback(
    async (email: string, senha: string) => {
      setIsLoading(true);
      try {
        await signInWithEmailAndPassword(auth, email, senha);
      } finally {
        setIsLoading(false);
      }
    },
    [auth]
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
    } finally {
      setIsLoading(false);
    }
  }, [auth]);

  return { user, isLoading, login, logout };
}
