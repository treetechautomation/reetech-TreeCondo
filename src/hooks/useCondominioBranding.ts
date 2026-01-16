"use client";

import * as React from "react";
import { useFirestore } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore";

type Branding = {
  logoUrl?: string | null;
  nomeFantasia?: string | null;
};

function resolveFirestore(maybe: any) {
  return maybe?.firestore ?? maybe;
}

export function useCondominioBranding(condominioId: string | null) {
  const firestoreRaw = useFirestore();
  const firestore = React.useMemo(() => resolveFirestore(firestoreRaw), [firestoreRaw]);

  const [branding, setBranding] = React.useState<Branding | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!condominioId || !firestore) {
      setBranding(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(firestore, "condominios", condominioId, "config", "branding");

    return onSnapshot(
      ref,
      (snap) => {
        setBranding((snap.exists() ? (snap.data() as any) : null) as Branding | null);
        setLoading(false);
      },
      () => {
        setBranding(null);
        setLoading(false);
      }
    );
  }, [firestore, condominioId]);

  return { branding, loading };
}
