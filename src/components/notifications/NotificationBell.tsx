"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
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
  Timestamp,
} from "firebase/firestore";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// Type definition as per prompt's context
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
  updatedAt?: any;
  link?: string;
  href?: string;
  url?: string;
  path?: string;
};

// Helper to format timestamp
function formatWhen(v: any) {
  try {
    const t: Date | null = v instanceof Timestamp ? v.toDate() : v?.toDate ? v.toDate() : null;
    if (!t) return "";
    const hh = String(t.getHours()).padStart(2, "0");
    const mm = String(t.getMinutes()).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    const MM = String(t.getMonth() + 1).padStart(2, "0");
    return `${dd}/${MM} ${hh}:${mm}`;
  } catch {
    return "";
  }
}

// Helper to find the navigation link in a notification
function pickLink(n: NotifDoc): string {
  return (
    (n.link && String(n.link)) ||
    (n.href && String(n.href)) ||
    (n.url && String(n.url)) ||
    (n.path && String(n.path)) ||
    (String(n.tipo || "").toUpperCase().includes("ENCOMENDA") ? "/encomendas" : "/notificacoes")
  );
}

export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const firestore = useFirestore();
  const { user, session, isAuthenticated } = useSessionCtx();
  const [open, setOpen] = React.useState(false);

  // Safely get context values
  const condoId = (session as any)?.activeCondominioId || null;
  const uid = user?.uid || null;

  const [items, setItems] = React.useState<NotifDoc[]>([]);
  const [unread, setUnread] = React.useState<number>(0);

  const dbg = (...a: any[]) => {
    try {
      console.log("[NotificationBell]", ...a);
    } catch {}
  };

  React.useEffect(() => {
    dbg("ctx", { isAuthenticated, uid, condoId, hasFirestore: !!firestore });
  }, [isAuthenticated, uid, condoId, firestore]);

  React.useEffect(() => {
    if (!firestore || !isAuthenticated || !uid || !condoId) {
      setItems([]);
      setUnread(0);
      return;
    }

    const col = collection(firestore, "condominios", condoId, "notificacoes");
    const q = query(
      col,
      where("targetUid", "==", uid),
      where("arquivada", "==", false),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: NotifDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setItems(list);
        setUnread(list.filter((n) => !n.lida).length);
        dbg("snap", {
          count: list.length,
          uid,
          condoId,
          firstTargetUid: list[0]?.targetUid ?? null,
          firstTitle: list[0]?.title || list[0]?.titulo || null,
        });
      },
      (err) => {
        dbg("onSnapshotError", String((err as any)?.message || err));
      }
    );

    return () => unsub();
  }, [firestore, isAuthenticated, uid, condoId]);

  async function markRead(n: NotifDoc) {
    if (!firestore || !condoId || n.lida) return;
    try {
      await updateDoc(doc(firestore, "condominios", condoId, "notificacoes", n.id), {
        lida: true,
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      console.warn("[NotificationBell] markRead failed:", e?.message || String(e));
    }
  }

  async function handleItemClick(n: NotifDoc) {
    await markRead(n);
    const link = pickLink(n);
    router.push(link);
    setOpen(false);
  }

  if (!isAuthenticated || !uid || !condoId) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={(isOpen) => { dbg("onOpenChange", isOpen); setOpen(isOpen); }} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("rounded-xl relative", className)} title="Notificações">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] leading-[18px] bg-red-600 text-white text-center font-semibold shadow-[0_8px_18px_rgba(0,0,0,.22)]">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className={cn("w-[360px] max-w-[92vw] shadow-[0_18px_70px_rgba(0,0,0,.28)]")}
        style={{ zIndex: 2147483647 }}
      >
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          <Link href="/notificacoes" className="text-xs text-slate-600 hover:underline">
            Ver todas
          </Link>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="px-3 py-2 text-[11px] text-slate-600">
          DBG uid: <span className="font-mono">{uid}</span> • condo: <span className="font-mono">{condoId}</span> • items: <span className="font-mono">{items.length}</span> • unread: <span className="font-mono">{unread}</span>
        </div>

        {items.length === 0 ? (
          <div className="px-3 py-4 text-sm text-slate-500">Nenhuma notificação.</div>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            {items.slice(0, 8).map((n) => {
              const title = n.title || n.titulo || "Notificação";
              const msg = n.message || n.mensagem || "";
              const when = formatWhen(n.createdAt);
              const isUnread = !n.lida;

              return (
                <DropdownMenuItem
                  key={n.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    handleItemClick(n);
                  }}
                  className={cn("cursor-pointer items-start gap-2 py-3", isUnread && "bg-slate-50")}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className={cn("font-medium truncate", isUnread ? "text-slate-900" : "text-slate-700")}>
                        {title}
                      </div>
                      {when ? <div className="text-[11px] text-slate-500 shrink-0">{when}</div> : null}
                    </div>
                    {msg ? <div className="text-xs text-slate-600 mt-1 line-clamp-2">{msg}</div> : null}
                    {isUnread && (
                      <div className="mt-1 flex items-center">
                        <span className="h-2 w-2 rounded-full bg-blue-500 mr-2"></span>
                        <span className="text-[11px] text-blue-600 font-semibold">Nova</span>
                      </div>
                    )}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
