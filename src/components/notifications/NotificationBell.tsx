"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useCondominio } from "@/contexts/CondominioContext";
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
  serverTimestamp,
} from "firebase/firestore";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

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
  link?: string;
  href?: string;
  url?: string;
  path?: string;
};

function formatWhen(v: any) {
  try {
    const t: Date | null =
      v instanceof Timestamp ? v.toDate() : v?.toDate ? v.toDate() : null;
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

function pickLink(n: NotifDoc): string {
  return (
    (n.link && String(n.link)) ||
    (n.href && String(n.href)) ||
    (n.url && String(n.url)) ||
    (n.path && String(n.path)) ||
    (String(n.tipo || "").toUpperCase().includes("ENCOMENDA")
      ? "/encomendas"
      : "/notificacoes")
  );
}

export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const firestore = useFirestore();
  const { session, isAuthenticated } = useSessionCtx();
  const { condominioAtivoId } = useCondominio();

  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotifDoc[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [snapErr, setSnapErr] = React.useState<string | null>(null);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const prevIdsRef = React.useRef<string[]>([]);

  const uid = session?.user?.uid ?? null;
  const condoId = condominioAtivoId ?? null;

  React.useEffect(() => {
    audioRef.current = new Audio("/sounds/notificacao.mp3");
    if (audioRef.current) {
      audioRef.current.volume = 0.8;
    }
  }, []);

  React.useEffect(() => {
    if (!firestore || !isAuthenticated || !uid || !condoId) {
      setItems([]);
      setUnread(0);
      setSnapErr(null);
      return;
    }

    const col = collection(firestore, "condominios", String(condoId), "notificacoes");
    const q = query(
      col,
      where("targetUid", "==", String(uid)),
      where("arquivada", "==", false),
      orderBy("createdAt", "desc"),
      limit(8)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setSnapErr(null);
        const list: NotifDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setItems(list);
        setUnread(list.filter((n) => !n.lida).length);
      },
      (err) => {
        const code = (err as any)?.code ?? "unknown";
        const msg = (err as any)?.message ?? String(err);
        setSnapErr(`${code}: ${msg}`);
        console.error("[NotificationBell] onSnapshotError:", err);
      }
    );

    return () => unsub();
  }, [firestore, isAuthenticated, uid, condoId]);

  // 🔊 tocar som somente para novas notificações
  React.useEffect(() => {
    const currentIds = items.map((i) => i.id);

    const newItems = currentIds.filter(
      (id) => !prevIdsRef.current.includes(id)
    );

    if (newItems.length > 0 && prevIdsRef.current.length > 0) {
      try {
        audioRef.current?.play();

        try {
          (globalThis as any).__showRealtimeToast?.({
            id: newItems[0],
            title: "🚪 Novo acesso",
            message: "Novo registro na portaria",
            link: "/acesso"
          });
        } catch {}

      } catch {}
    }

    prevIdsRef.current = currentIds;
  }, [items]);

  async function markRead(n: NotifDoc) {
    if (!firestore || !condoId || n.lida) return;
    try {
      await updateDoc(doc(firestore, "condominios", String(condoId), "notificacoes", n.id), {
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
    setOpen(false);
    router.push(link);
  }

  if (!isAuthenticated || !uid || !condoId) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("rounded-xl relative", className)}
          title="Notificações"
          type="button"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] leading-[18px] bg-red-600 text-white text-center font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_10px_40px_rgba(0,208,230,0.35),0_18px_60px_rgba(211,234,0,0.25)]">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className={cn(
          "w-[380px] max-w-[92vw] p-0 rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl z-[2147483647]"
        )}
        style={{ zIndex: 2147483647 }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold">Notificações</span>
          <Link
            href="/notificacoes"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            onClick={() => setOpen(false)}
          >
            Ver todas
          </Link>
        </div>

        <div className="px-4 py-1 text-[10px] text-muted-foreground border-b">
          uid:{uid?.slice(0, 5)} condo:{String(condoId).slice(0, 5)} items:{items.length} unread:{unread}
        </div>

        {snapErr ? (
          <div className="px-4 py-5 text-sm text-destructive">{snapErr}</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-5 text-sm text-muted-foreground">
            Nenhuma notificação nova.
          </div>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <div className="divide-y divide-border">
              {items.map((n) => {
                const title = n.title || n.titulo || "Notificação";
                const msg = n.message || n.mensagem || "";
                const when = formatWhen(n.createdAt);
                const isUnread = !n.lida;

                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className={cn(
                      "w-full text-left px-4 py-3 transition-colors",
                      "hover:bg-accent active:bg-accent/80",
                      "focus:outline-none focus-visible:bg-accent",
                      isUnread && "bg-accent/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={cn(
                              "font-semibold truncate",
                              isUnread ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {title}
                          </div>
                          {isUnread && (
                            <span className="shrink-0 inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold text-primary-foreground bg-primary border border-primary/50">
                              NOVA
                            </span>
                          )}
                        </div>

                        {msg && (
                          <div className="mt-1 text-[13px] leading-snug text-muted-foreground line-clamp-2">
                            {msg}
                          </div>
                        )}
                      </div>

                      {when && (
                        <div className="shrink-0 text-[11px] text-muted-foreground pt-[2px]">
                          {when}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
