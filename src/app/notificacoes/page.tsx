"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  Bell,
  BellOff,
  Package,
  DoorOpen,
  AlertTriangle,
  Calendar,
  MessageSquare,
  CheckCheck,
  Filter,
  Inbox,
  ChevronDown,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const TIPO_ICONS: Record<string, React.ReactNode> = {
  ENCOMENDA_CHEGOU: <Package className="h-4 w-4 text-amber-500" />,
  ACESSO_PORTARIA: <DoorOpen className="h-4 w-4 text-blue-500" />,
  INCIDENTE_NOVO: <AlertTriangle className="h-4 w-4 text-red-500" />,
  RESERVA_APROVADA: <Calendar className="h-4 w-4 text-emerald-500" />,
  RESERVA_CANCELADA: <Calendar className="h-4 w-4 text-rose-500" />,
  COMUNICADO: <MessageSquare className="h-4 w-4 text-purple-500" />,
};

const TIPO_LABELS: Record<string, string> = {
  ENCOMENDA_CHEGOU: "Encomenda",
  ACESSO_PORTARIA: "Acesso",
  INCIDENTE_NOVO: "Incidente",
  RESERVA_APROVADA: "Reserva",
  RESERVA_CANCELADA: "Reserva",
  COMUNICADO: "Comunicado",
};

const TIPO_CORES: Record<string, string> = {
  ENCOMENDA_CHEGOU: "bg-amber-50 border-amber-200",
  ACESSO_PORTARIA: "bg-blue-50 border-blue-200",
  INCIDENTE_NOVO: "bg-red-50 border-red-200",
  RESERVA_APROVADA: "bg-emerald-50 border-emerald-200",
  RESERVA_CANCELADA: "bg-rose-50 border-rose-200",
  COMUNICADO: "bg-purple-50 border-purple-200",
};

function formatTs(ts: any): string {
  if (!ts) return "";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "agora mesmo";
    if (diff < 3_600_000) return formatDistanceToNow(d, { locale: ptBR, addSuffix: true });
    if (diff < 86_400_000) return format(d, "HH:mm", { locale: ptBR });
    return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "";
  }
}

const PAGE_SIZE = 30;

export default function NotificacoesPage() {
  const firestore = useFirestore();
  const { user, session, isAuthenticated } = useSessionCtx();

  const condoId = session?.activeCondominioId || null;
  const uid = user?.uid || null;

  const [items, setItems] = React.useState<NotifDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filterTipo, setFilterTipo] = React.useState<string>("TODOS");
  const [filterLida, setFilterLida] = React.useState<"TODAS" | "NAO_LIDAS" | "LIDAS">("TODAS");
  const [lastDoc, setLastDoc] = React.useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  // Tipos únicos encontrados nas notificações
  const tipos = React.useMemo(() => {
    const set = new Set(items.map((n) => n.tipo || "").filter(Boolean));
    return Array.from(set);
  }, [items]);

  // Snapshot em tempo real para as primeiras notificações
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
      limit(PAGE_SIZE)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: NotifDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setItems(list);
        setLastDoc(snap.docs[snap.docs.length - 1] || null);
        setHasMore(snap.docs.length === PAGE_SIZE);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [firestore, isAuthenticated, uid, condoId]);

  // Carregar mais notificações (paginação)
  async function loadMore() {
    if (!firestore || !condoId || !uid || !lastDoc) return;
    setLoadingMore(true);
    try {
      const col = collection(firestore, "condominios", condoId, "notificacoes");
      const q = query(
        col,
        where("targetUid", "==", uid),
        where("arquivada", "==", false),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const more: NotifDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setItems((prev) => [...prev, ...more]);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  async function markOne(id: string) {
    if (!firestore || !condoId) return;
    await updateDoc(doc(firestore, "condominios", condoId, "notificacoes", id), {
      lida: true,
      updatedAt: new Date(),
    } as any);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
  }

  async function markAll() {
    if (!firestore || !condoId) return;
    const unread = filtered.filter((n) => !n.lida);
    if (!unread.length) return;
    const batch = writeBatch(firestore);
    unread.forEach((n) => {
      batch.update(doc(firestore, "condominios", condoId, "notificacoes", n.id), {
        lida: true,
        updatedAt: new Date(),
      } as any);
    });
    await batch.commit();
    setItems((prev) => prev.map((n) => ({ ...n, lida: true })));
  }

  async function archiveOne(id: string) {
    if (!firestore || !condoId) return;
    await updateDoc(doc(firestore, "condominios", condoId, "notificacoes", id), {
      arquivada: true,
      updatedAt: new Date(),
    } as any);
    setItems((prev) => prev.filter((n) => n.id !== id));
  }

  // Filtragem local
  const filtered = React.useMemo(() => {
    return items.filter((n) => {
      if (filterTipo !== "TODOS" && n.tipo !== filterTipo) return false;
      if (filterLida === "NAO_LIDAS" && n.lida) return false;
      if (filterLida === "LIDAS" && !n.lida) return false;
      return true;
    });
  }, [items, filterTipo, filterLida]);

  const unreadCount = items.filter((n) => !n.lida).length;

  return (
    <AppLayout
      pageTitle="Notificações"
      headerActions={
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white text-xs px-2">
              {unreadCount} não {unreadCount === 1 ? "lida" : "lidas"}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={markAll}
            disabled={!filtered.some((n) => !n.lida)}
            className="gap-2"
            title="Marcar todas como lidas"
          >
            <CheckCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Marcar todas como lidas</span>
            <span className="sm:hidden">Lidas</span>
          </Button>
        </div>
      }
    >
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Filtro por leitura */}
        <div className="flex rounded-xl border bg-card overflow-hidden">
          {(["TODAS", "NAO_LIDAS", "LIDAS"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterLida(v)}
              className={[
                "px-3 py-1.5 font-medium transition-all",
                filterLida === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              ].join(" ")}
            >
              {v === "TODAS" ? "Todas" : v === "NAO_LIDAS" ? "Não lidas" : "Lidas"}
            </button>
          ))}
        </div>

        {/* Filtro por tipo */}
        {tipos.length > 1 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <button
              onClick={() => setFilterTipo("TODOS")}
              className={[
                "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                filterTipo === "TODOS"
                  ? "bg-primary text-primary-foreground border-slate-800"
                  : "bg-card text-muted-foreground border hover:bg-muted",
              ].join(" ")}
            >
              Todos
            </button>
            {tipos.map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFilterTipo(tipo)}
                className={[
                  "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1",
                  filterTipo === tipo
                    ? "bg-primary text-primary-foreground border-slate-800"
                    : "bg-card text-muted-foreground border hover:bg-muted",
                ].join(" ")}
              >
                {TIPO_ICONS[tipo] || <Bell className="h-3 w-3" />}
                {TIPO_LABELS[tipo] || tipo}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nenhuma notificação encontrada"
            description={filterTipo !== "TODOS" || filterLida !== "TODAS" ? "Tente remover os filtros" : "Você está em dia!"}
          />
        ) : (
          filtered.map((n) => {
            const title = n.title || n.titulo || "Notificação";
            const msg = n.message || n.mensagem || "";
            const isUnread = !n.lida;
            const tipo = n.tipo || "";
            const corClass = TIPO_CORES[tipo] || "bg-card border";

            return (
              <div
                key={n.id}
                className={[
                  "w-full text-left rounded-2xl p-4 border transition-all group relative",
                  isUnread ? corClass : "bg-card/50 border-border/30",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  {/* Ícone do tipo */}
                  <div className="h-9 w-9 rounded-xl bg-card flex items-center justify-center shrink-0 shadow-sm">
                    {TIPO_ICONS[tipo] || <Bell className="h-4 w-4 text-muted-foreground" />}
                  </div>

                  {/* Conteúdo */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={["font-semibold text-sm", isUnread ? "text-foreground" : "text-muted-foreground"].join(" ")}>
                        {title}
                      </span>
                      {isUnread && (
                        <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                      )}
                      {TIPO_LABELS[tipo] && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {TIPO_LABELS[tipo]}
                        </Badge>
                      )}
                    </div>
                    {msg && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{msg}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">{formatTs(n.createdAt)}</p>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {isUnread && (
                      <button
                        onClick={() => markOne(n.id)}
                        className="h-7 w-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition"
                        title="Marcar como lida"
                      >
                        <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                      </button>
                    )}
                    <button
                      onClick={() => archiveOne(n.id)}
                      className="h-7 w-7 rounded-lg bg-muted hover:bg-muted flex items-center justify-center transition"
                      title="Arquivar"
                    >
                      <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Carregar mais */}
        {hasMore && !loading && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={loadingMore}
              className="gap-2"
            >
              {loadingMore ? (
                <span className="h-4 w-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {loadingMore ? "Carregando…" : "Carregar mais"}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
