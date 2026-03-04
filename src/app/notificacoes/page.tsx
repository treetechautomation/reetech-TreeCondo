"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch,
} from "firebase/firestore";

type NotifDoc = {
  id: string;
  title?: string;
  message?: string;
  titulo?: string;
  mensagem?: string;
  tipo?: string;
  targetUid?: string;
  lida?: boolean;
  arquivada?: boolean;
  createdAt?: any;
};

export default function NotificacoesPage() {
  const firestore = useFirestore();
  const { user, session, isAuthenticated } = useSessionCtx();

  const condoId = (session as any)?.activeCondominioId || session?.activeCondominioId || null;
  const uid = (user as any)?.uid || null;

  const [items, setItems] = React.useState<NotifDoc[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore || !isAuthenticated || !uid || !condoId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const col = collection(firestore, "condominios", condoId, "notificacoes");
    const q = query(
      col,
      where("targetUid", "==", uid),
      where("arquivada", "==", false),
      orderBy("createdAt", "desc"),
      limit(200)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: NotifDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setItems(list);
        setLoading(false);
      },
      (err) => {
        console.warn("[/notificacoes] onSnapshot error:", err?.message || String(err));
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, isAuthenticated, uid, condoId]);

  async function markOne(id: string) {
    if (!firestore || !condoId) return;
    await updateDoc(doc(firestore, "condominios", condoId, "notificacoes", id), {
      lida: true,
      updatedAt: new Date(),
    } as any);
  }

  async function markAll() {
    if (!firestore || !condoId) return;
    const unread = items.filter((n) => !n.lida);
    if (!unread.length) return;

    const batch = writeBatch(firestore);
    unread.forEach((n) => {
      batch.update(doc(firestore, "condominios", condoId, "notificacoes", n.id), {
        lida: true,
        updatedAt: new Date(),
      } as any);
    });
    await batch.commit();
  }

  const unreadCount = items.filter((n) => !n.lida).length;

  return (
    <AppLayout
      pageTitle="Notificações"
      headerActions={
        <Button variant="outline" onClick={markAll} disabled={!items.length || unreadCount === 0}>
          Marcar todas como lidas {unreadCount > 0 ? `(${unreadCount})` : ""}
        </Button>
      }
    >
      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-slate-600">Carregando…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-slate-600">Nenhuma notificação.</div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => {
              const title = n.title || n.titulo || "Notificação";
              const msg = n.message || n.mensagem || "";
              const isUnread = !n.lida;

              return (
                <button
                  key={n.id}
                  onClick={() => markOne(n.id)}
                  className={[
                    "w-full text-left rounded-2xl p-4 border transition-all",
                    "bg-white/70 backdrop-blur-xl",
                    isUnread
                      ? "border-red-200 hover:border-red-300"
                      : "border-white/40 hover:border-white/60",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={["font-semibold", isUnread ? "text-slate-900" : "text-slate-700"].join(" ")}>
                        {title}
                      </div>
                      {msg ? <div className="text-sm text-slate-600 mt-1">{msg}</div> : null}
                    </div>
                    {isUnread ? <span className="text-xs text-red-600 font-semibold">não lida</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
