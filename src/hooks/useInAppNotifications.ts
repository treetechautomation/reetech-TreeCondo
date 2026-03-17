"use client";

import * as React from "react";
import { collection, limit, onSnapshot, orderBy, query, where, Timestamp } from "firebase/firestore";

import { useToast } from "@/hooks/use-toast";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useCondominio } from "@/contexts/CondominioContext";
import { useFirestore } from "@/firebase";

type Notif = {
  tipo?: string;
  title?: string;
  message?: string;
  titulo?: string;
  mensagem?: string;
  url?: string;
  targetUid?: string;
  lida?: boolean;
  arquivada?: boolean;
  createdAt?: Timestamp;
};

export function useInAppNotifications() {
  const { toast } = useToast();
  const { session } = useSessionCtx();
  const cc: any = useCondominio();
  const db = useFirestore();

  const condominioAtivoId =
    cc?.condominioAtivoId ||
    cc?.condominioAtivo?.id ||
    cc?.condominioAtivo?.condominioId ||
    cc?.condominioId ||
    null;

  const uid = React.useMemo(() => {
    const sAny: any = session as any;
    return (
      sAny?.uid ||
      sAny?.user?.uid ||
      sAny?.userId ||
      sAny?.auth?.uid ||
      sAny?.firebaseUser?.uid ||
      null
    );
  }, [session]);

  const shown = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    const condId = condominioAtivoId;

    if (!db || !uid || !condId) return;

    const ref = collection(db, "condominios", String(condId), "notificacoes");

    const q = query(
      ref,
      where("targetUid", "==", String(uid)),
      where("lida", "==", false),
      where("arquivada", "==", false),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type !== "added") continue;

          const id = ch.doc.id;
          if (shown.current.has(id)) continue;
          shown.current.add(id);

          const n = (ch.doc.data() || {}) as Notif;

          const title = String(n.title || n.titulo || "TreeCondo").slice(0, 90);
          const desc = String(n.message || n.mensagem || "").slice(0, 220);

          toast({
            title,
            description: desc || undefined,
          });
}
      },
      (err) => {
        console.warn("[INAPP NOTIF] snapshot error", err);
      }
    );

    return () => unsub();
  }, [db, uid, condominioAtivoId, toast]);
}
