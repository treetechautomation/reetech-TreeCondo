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
  const cc: any = useCondominio();
  const [open, setOpen] = React.useState(false);
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);

    // Safely get context values (alinhado com useInAppNotifications)
  const condoId =
    cc?.condominioAtivoId ||
    cc?.condominioAtivo?.id ||
    cc?.condominioAtivo?.condominioId ||
    cc?.condominioId ||
    (session as any)?.activeCondominioId ||
    (session as any)?.activeCondominio?.id ||
    (session as any)?.condominioAtivoId ||
    (session as any)?.condominioId ||
    null;

  const uid = React.useMemo(() => {
    const sAny: any = session as any;
    return (
      (user as any)?.uid ||
      sAny?.uid ||
      sAny?.user?.uid ||
      sAny?.userId ||
      sAny?.auth?.uid ||
      sAny?.firebaseUser?.uid ||
      null
    );
  }, [session, user]);

  

  const moradorNome = React.useMemo(() => {
    const sAny: any = session as any;
    return (
      sAny?.user?.nome ||
      sAny?.user?.name ||
      sAny?.nome ||
      sAny?.name ||
      (user as any)?.displayName ||
      (user as any)?.email ||
      "Morador"
    );
  }, [session, user]);

  const condominioNome = React.useMemo(() => {
    const sAny: any = session as any;
    return (
      cc?.condominioAtivo?.nome ||
      cc?.condominioAtivo?.nomeCondominio ||
      cc?.condominioAtivo?.titulo ||
      cc?.condominioAtivo?.razaoSocial ||
      sAny?.activeCondominio?.nome ||
      sAny?.activeCondominio?.nomeCondominio ||
      sAny?.condominioAtivo?.nome ||
      sAny?.condominio?.nome ||
      "Condomínio"
    );
  }, [cc, session]);
const [items, setItems] = React.useState<NotifDoc[]>([]);
  const [unread, setUnread] = React.useState<number>(0);

  
  const [snapErr, setSnapErr] = React.useState<string | null>(null);
const dbg = (...a: any[]) => {
      try { console.log("[NotificationBell]", ...a); } catch {}
    };

// DBG_PERFECT_RADIX_NEON_v1
  function dumpEl(el: Element | null) {
    if (!el) return null;
    const r = (el as HTMLElement).getBoundingClientRect?.();
    const cs = getComputedStyle(el as Element);
    return {
      tag: (el as any).tagName,
      id: (el as any).id,
      cls: (el as any).className,
      rect: r ? { x: r.x, y: r.y, w: r.width, h: r.height, top: r.top, left: r.left, bottom: r.bottom, right: r.right } : null,
      style: {
        position: cs.position,
        top: cs.top,
        left: cs.left,
        right: cs.right,
        bottom: cs.bottom,
        transform: cs.transform,
        zIndex: cs.zIndex,
        opacity: cs.opacity,
        visibility: cs.visibility,
        display: cs.display,
        pointerEvents: cs.pointerEvents,
        overflow: cs.overflow,
        overflowX: cs.overflowX,
        overflowY: cs.overflowY,
        filter: (cs as any).filter,
        backdropFilter: (cs as any).backdropFilter,
      },
    };
  }

  function dumpAncestors(el: Element | null, max = 16) {
    const out: any[] = [];
    let cur: Element | null = el;
    let i = 0;
    while (cur && i < max) {
      const cs = getComputedStyle(cur);
      const interesting =
        cs.transform !== "none" ||
        cs.overflow !== "visible" ||
        cs.overflowX !== "visible" ||
        cs.overflowY !== "visible" ||
        cs.position !== "static" ||
        (cs.zIndex !== "auto" && cs.zIndex !== "0") ||
        cs.filter !== "none";

      out.push({
        i,
        tag: (cur as any).tagName,
        id: (cur as any).id,
        cls: String((cur as any).className || "").slice(0, 120),
        position: cs.position,
        zIndex: cs.zIndex,
        transform: cs.transform,
        overflow: cs.overflow,
        overflowX: cs.overflowX,
        overflowY: cs.overflowY,
        filter: (cs as any).filter,
        interesting,
      });
      cur = cur.parentElement;
      i++;
    }
    return out;
  }

  function neon(el: Element | null, label: string) {
    if (!el) return;
    const h = el as HTMLElement;
    // não destrói o style original: salva em dataset
    if (!h.dataset.__dbgOldStyle) h.dataset.__dbgOldStyle = h.getAttribute("style") || "";
    h.style.outline = "2px solid rgba(0,208,230,.8)";
    h.style.boxShadow = "0 0 0 4px , 0 18px 60px ";
    h.style.background = "";
    h.style.pointerEvents = "auto";
    h.setAttribute("data-dbg-neon", label);
  }

  function neonResetAll() {
    document.querySelectorAll("[data-dbg-neon]").forEach((el) => {
      const h = el as HTMLElement;
      const old = h.dataset.__dbgOldStyle;
      h.setAttribute("style", old || "");
      h.removeAttribute("data-dbg-neon");
      delete h.dataset.__dbgOldStyle;
    });
  }

  function findRadixDropdownParts() {
    // shadcn DropdownMenuContent normalmente vira um div com role=menu
    const menus = Array.from(document.querySelectorAll('[role="menu"]'));
    // pega o mais recente visível (ou o último da lista)
    const menu = menus.reverse().find((m) => {
      const cs = getComputedStyle(m);
      return cs.display !== "none" && cs.visibility !== "hidden";
    }) || menus[menus.length - 1] || null;

    const wrapper = menu?.closest?.("[data-radix-popper-content-wrapper]") || null;
    return { menu, wrapper };
  }

  function dbgPerfect(where: string) {
    try {
      const { menu, wrapper } = findRadixDropdownParts();
      const trig = triggerRef.current;
      const aMenu = dumpEl(menu);
      const aWrap = dumpEl(wrapper);
      const aTrig = dumpEl(trig);
      dbg("DBG_PERFECT", where, {
        trigger: aTrig,
        menu: aMenu,
        wrapper: aWrap,
        menuAncestors: dumpAncestors(menu),
        wrapperAncestors: dumpAncestors(wrapper),
      });
      neonResetAll();
      neon(trig, "trigger");
      neon(menu, "menu");
      neon(wrapper, "wrapper");
    } catch (e:any) {
      dbg("DBG_PERFECT_ERR", where, String(e?.message || e));
    }
  }


  // DBG_FLAT_V1
  function dbgFlat(where: string) {
    try {
      const { menu, wrapper } = findRadixDropdownParts();
      const trig = triggerRef.current;

      const t = dumpEl(trig);
      const me = dumpEl(menu);
      const wr = dumpEl(wrapper);

      const menuAnc = dumpAncestors(menu);
      const wrapAnc = dumpAncestors(wrapper);

      const firstInterestingMenu = menuAnc.find((a:any) => a?.interesting) || null;
      const firstInterestingWrap = wrapAnc.find((a:any) => a?.interesting) || null;

      dbg("DBG_FLAT", where, {
        viewport: { w: window.innerWidth, h: window.innerHeight, scrollX: window.scrollX, scrollY: window.scrollY },
        triggerRect: t?.rect || null,
        triggerStyle: t?.style || null,
        menuRect: me?.rect || null,
        menuStyle: me?.style || null,
        wrapperRect: wr?.rect || null,
        wrapperStyle: wr?.style || null,
        firstInterestingMenu,
        firstInterestingWrap,
      });
    } catch (e:any) {
      dbg("DBG_FLAT_ERR", where, String(e?.message || e));
    }
  }


    function probeRadixPopper() {
      try {
        const wraps = Array.from(document.querySelectorAll("[data-radix-popper-content-wrapper]"));
        const top3 = wraps.slice(0, 3).map((w) => {
          const r = w.getBoundingClientRect();
          const cs = getComputedStyle(w);
          return {
            rect: { x: r.x, y: r.y, w: r.width, h: r.height },
            style: { position: cs.position, top: cs.top, left: cs.left, transform: cs.transform, zIndex: cs.zIndex, opacity: cs.opacity, visibility: cs.visibility, pointerEvents: cs.pointerEvents }
          };
        });
        dbg("radixPopperProbe", { wrappers: wraps.length, wrappersTop3: top3 });
      } catch (e) {
        dbg("radixPopperProbeError", String(((e as any)?.message) || e));
      }
    }

    React.useEffect(() => {
      dbg("ctx", { isAuthenticated, uid, condoId, hasFirestore: !!firestore });
    }, [isAuthenticated, uid, condoId, firestore]);

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
      limit(20)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setSnapErr(null);
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
      }, (err) => {
          const code = (err && (err.code || err?.name)) ? String(err.code || err.name) : "";
          const msg = err && err.message ? String(err.message) : String(err);
          const full = [code, msg].filter(Boolean).join(": ");
          setSnapErr(full || "snapshot error");
          dbg("onSnapshotError", { code, msg, raw: err });
        });


    return () => unsub();
  }, [firestore, isAuthenticated, uid, condoId]);

  async function markRead(n: NotifDoc) {
    if (!firestore || !condoId || n.lida) return;
    try {
      await updateDoc(doc(firestore, "condominios", condoId, "notificacoes", n.id), {
        lida: true,
        updatedAt: new Date(),
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
    <DropdownMenu
        open={open}
        onOpenChange={(isOpen) => {
          dbg("onOpenChange", isOpen);
          setOpen(isOpen);
          if (isOpen) {
            dbgPerfect("open@0");
            setTimeout(() => dbgPerfect("open@50ms"), 50);
              setTimeout(() => dbgFlat("open@50ms"), 60);
              setTimeout(() => dbgPerfect("open@250ms"), 250);
              setTimeout(() => dbgFlat("open@250ms"), 260);
          }
          if (isOpen) setTimeout(() => probeRadixPopper(), 50);
        }}
        modal={false}
      >
      <DropdownMenuTrigger asChild>
        <Button ref={triggerRef} variant="ghost" size="icon" className={cn("rounded-xl relative", className)} title="Notificações">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] leading-[18px] bg-red-600 text-white text-center font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_10px_40px_rgba(0,208,230,0.35),0_18px_60px_rgba(211,234,0,0.25)]">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
          portal={false}
          side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className={cn("w-[380px] max-w-[92vw] rounded-2xl border border-white/12 shadow-[0_24px_90px_rgba(0,0,0,.45)] overflow-hidden")}
          style={{
            zIndex: 2147483647,
            backgroundColor: "#6D7B8D",
            backgroundImage:
              "linear-gradient(135deg, #6D7B8D 0%, #4B5566 45%, #2F3B48 100%)",
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
          }}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            dbg("onOpenAutoFocus.preventDefault", { type: (e as any)?.type });
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            dbg("onCloseAutoFocus.preventDefault", { type: (e as any)?.type });
          }}
onPointerDownOutside={(e) => {
              const t = (e as any)?.target as any;
              const isTrigger = !!(t && triggerRef.current && triggerRef.current.contains(t));
              dbg("onPointerDownOutside", { type: (e as any)?.type, tag: t?.tagName, id: t?.id, cls: t?.className, isTrigger });
              if (isTrigger) e.preventDefault();
            
              // DEBUG extra
              dbgPerfect("onPointerDownOutside");
            }}
            onFocusOutside={(e) => {
              const t = (e as any)?.target as any;
              const isTrigger = !!(t && triggerRef.current && triggerRef.current.contains(t));
              dbg("onFocusOutside", { type: (e as any)?.type, tag: t?.tagName, id: t?.id, cls: t?.className, isTrigger });
              if (isTrigger) e.preventDefault();
            
              // DEBUG extra
              dbgPerfect("onFocusOutside");
            }}
      >
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3 bg-black/15 text-white border-b border-white/10">
          <span>Notificações</span>
          <Link href="/notificacoes" className="text-xs text-white/70 hover:text-white hover:underline">
            Ver todas
          </Link>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
          <div className="px-4 py-2 text-[12px] text-white/80 border-b border-white/10">
              <div className="flex flex-col gap-0.5">
                <div className="truncate">
                  <span className="text-white/60">Morador:</span>{" "}
                  <span className="font-semibold text-white/95">{moradorNome}</span>
                </div>
                <div className="truncate">
                  <span className="text-white/60">Condomínio:</span>{" "}
                  <span className="font-semibold text-white/95">{condominioNome}</span>
                </div>
              </div>
            </div>
{items.length === 0 ? (
            <div className="px-4 py-5 text-sm text-white/75">Nenhuma notificação.</div>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <div className="divide-y divide-white/10">
                {items.slice(0, 8).map((n) => {
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
                        "w-full text-left px-4 py-3 transition",
                        "hover:bg-white/8 active:bg-white/10",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                        isUnread ? "bg-white/6" : "bg-transparent"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={cn("font-semibold truncate", isUnread ? "text-white" : "text-white/90")}>
                              {title}
                            </div>
                            {isUnread ? (
                              <span className="shrink-0 inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold text-white/90 bg-black/20 border border-white/10">
                                NOVA
                              </span>
                            ) : null}
                          </div>

                          {msg ? (
                            <div className="mt-1 text-[13px] leading-snug text-white/75 line-clamp-2">
                              {msg}
                            </div>
                          ) : null}
                        </div>

                        {when ? (
                          <div className="shrink-0 text-[11px] text-white/60 pt-[2px]">
                            {when}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="px-4 py-3">
                <a
                  href="/notificacoes"
                  className="inline-flex items-center justify-center w-full rounded-lg border border-white/12 bg-black/10 hover:bg-black/15 text-white/85 text-sm font-semibold py-2 transition"
                >
                  Ver todas
                </a>
              </div>
            </div>
          )}</DropdownMenuContent>
    </DropdownMenu>
  );
}
