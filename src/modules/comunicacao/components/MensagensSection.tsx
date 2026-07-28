"use client";

import * as React from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  limit,
} from "firebase/firestore";

import { useCondominio } from "@/contexts/CondominioContext";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { hasRole } from "@/lib/acl";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Membro = {
  id: string;
  nome?: string;
  email?: string;

  // seu projeto tem variações; suportamos ambas:
  blocoId?: string | null;
  unidadeId?: string | null;

  bloco?: string | null;
  apartamento?: string | null;

  role?: string;
  status?: string;
};

type Bloco = { id: string; nome: string };

type Thread = {
  id: string;
  tipo: "CONDOMINIO" | "BLOCO" | "UNIDADE" | "MORADOR";
  alvo: {
    blocoId?: string | null;
    unidade?: string | null;
    uid?: string | null;
  };
  titulo: string;
  updatedAt?: any;
  lastMessage?: string;
};

type Msg = {
  id: string;
  texto: string;
  createdAt?: any;
  createdByUid?: string;
  createdByNome?: string;
};

function GlassCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "rounded-3xl border border-black/5 bg-white/65 text-slate-900 shadow-sm backdrop-blur-xl",
        className
      )}
      {...props}
    />
  );
}

function buildThreadId(payload: {
  tipo: Thread["tipo"];
  blocoId?: string | null;
  unidade?: string | null;
  uid?: string | null;
}) {
  if (payload.tipo === "CONDOMINIO") return "condominio";
  if (payload.tipo === "BLOCO") return `bloco_${payload.blocoId ?? "x"}`;
  if (payload.tipo === "UNIDADE") return `unidade_${payload.blocoId ?? "x"}_${String(payload.unidade ?? "").replace(/\s+/g, "")}`;
  return `morador_${payload.uid ?? "x"}`;
}

function labelDestino(t: Thread) {
  if (t.tipo === "CONDOMINIO") return "Condomínio (todos)";
  if (t.tipo === "BLOCO") return `Bloco`;
  if (t.tipo === "UNIDADE") return `Unidade`;
  return `Morador`;
}

export function MensagensSection() {
  const firestore = useFirestore();
  const { session } = useSessionCtx();
  const { condominioAtivoId } = useCondominio();

  const canManage = hasRole(session, ["SUPER_ADMIN", "ADMIN", "SINDICO"]);
  const myUid = session?.user?.uid ?? null;
  const myNome = session?.user?.displayName ?? session?.user?.email ?? "Admin";

  const [tipo, setTipo] = React.useState<Thread["tipo"]>("CONDOMINIO");
  const [blocoId, setBlocoId] = React.useState<string>("");
  const [unidade, setUnidade] = React.useState<string>("");
  const [moradorUid, setMoradorUid] = React.useState<string>("");

  const [threadAtual, setThreadAtual] = React.useState<Thread | null>(null);
  const [texto, setTexto] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);

  // Blocos (pra filtro)
  const blocosQuery = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId) return null;
    return query(collection(firestore, "condominios", condominioAtivoId, "blocos"), orderBy("nome", "asc"));
  }, [firestore, condominioAtivoId]);
  const { data: blocos } = useCollection<Bloco>(blocosQuery);

  // Moradores (pra selecionar pessoa)
  const moradoresQuery = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId) return null;
    // pega apenas MORADOR (e ATIVO se existir)
    // alguns docs podem não ter role/status, então não travamos nisso.
    return query(
      collection(firestore, "condominios", condominioAtivoId, "membros"),
      limit(300)
    );
  }, [firestore, condominioAtivoId]);
  const { data: membrosAll } = useCollection<Membro>(moradoresQuery);

  const moradores = React.useMemo(() => {
    const arr = (membrosAll ?? []).map((m) => ({ ...m }));
    return arr
      .filter((m) => (m.role ? m.role === "MORADOR" : true))
      .filter((m) => (m.status ? m.status === "ATIVO" : true))
      .sort((a, b) => String(a.nome ?? "").localeCompare(String(b.nome ?? ""), "pt-BR"));
  }, [membrosAll]);

  function normUnidade(s: string) {
    return String(s ?? "").trim().replace(/\s+/g, "");
  }

    const unidadesDoBloco = React.useMemo(() => {
      if (!blocoId) return [];
      const set = new Set<string>();
      (moradores ?? []).forEach((m) => {
        const mBloco = String(m.blocoId ?? m.bloco ?? "");
        if (mBloco !== String(blocoId)) return;
        const u = normUnidade(String(m.unidadeId ?? m.apartamento ?? ""));
        if (u) set.add(u);
      });
      return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
    }, [moradores, blocoId]);

  const moradoresDaUnidade = React.useMemo(() => {
      if (!blocoId || !unidade.trim()) return [];
      const u = normUnidade(unidade);

      return (moradores ?? []).filter((m) => {
        const mBloco = String(m.blocoId ?? m.bloco ?? "");
        const mUnid = normUnidade(String(m.unidadeId ?? m.apartamento ?? ""));
        return mBloco === String(blocoId) && mUnid === u;
      });
    }, [moradores, blocoId, unidade]);

  // Threads Query para Administradores (vê todos os threads)
  const threadsAdminQuery = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId || !canManage) return null;
    return query(collection(firestore, "condominios", condominioAtivoId, "threads"), orderBy("updatedAt", "desc"));
  }, [firestore, condominioAtivoId, canManage]);
  const { data: threadsAdmin, isLoading: loadingAdmin } = useCollection<Thread>(threadsAdminQuery);

  // Threads Query para Moradores - 1. Comunicados Globais
  const threadsGlobalQuery = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId || canManage) return null;
    return query(collection(firestore, "condominios", condominioAtivoId, "threads"), where("tipo", "==", "CONDOMINIO"));
  }, [firestore, condominioAtivoId, canManage]);
  const { data: threadsGlobal, isLoading: loadingGlobal } = useCollection<Thread>(threadsGlobalQuery);

  // Threads Query para Moradores - 2. Conversas direcionadas ao morador
  const threadsTargetedQuery = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId || canManage || !myUid) return null;
    return query(collection(firestore, "condominios", condominioAtivoId, "threads"), where("toUids", "array-contains", myUid));
  }, [firestore, condominioAtivoId, canManage, myUid]);
  const { data: threadsTargeted, isLoading: loadingTargeted } = useCollection<Thread>(threadsTargetedQuery);

  const threads = React.useMemo(() => {
    if (canManage) {
      return threadsAdmin ?? [];
    }
    const combined = [...(threadsGlobal ?? []), ...(threadsTargeted ?? [])];
    const unique = new Map<string, Thread>();
    combined.forEach((t) => {
      if (t?.id) unique.set(t.id, t);
    });
    return Array.from(unique.values()).sort((a, b) => {
      const da = a.updatedAt?.toMillis?.() ?? (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0);
      const db = b.updatedAt?.toMillis?.() ?? (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0);
      return db - da;
    });
  }, [canManage, threadsAdmin, threadsGlobal, threadsTargeted]);

  const loadingThreads = canManage ? loadingAdmin : (loadingGlobal || loadingTargeted);
// Mensagens do thread atual
  const msgsQuery = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId || !threadAtual?.id) return null;
    return query(
      collection(firestore, "condominios", condominioAtivoId, "threads", threadAtual.id, "mensagens"),
      orderBy("createdAt", "asc")
    );
  }, [firestore, condominioAtivoId, threadAtual?.id]);
  const { data: msgs, isLoading: loadingMsgs } = useCollection<Msg>(msgsQuery);

  async function ensureThreadAndOpen() {
    setErr(null);
    if (!canManage) {
      setErr("Somente síndico/administrador pode enviar mensagens.");
      return;
    }
    if (!firestore || !condominioAtivoId) {
      setErr("Selecione um condomínio.");
      return;
    }

    // validações por tipo
    if (tipo === "BLOCO" && !blocoId) return setErr("Selecione o bloco.");
    if (tipo === "UNIDADE" && (!blocoId || !unidade.trim())) return setErr("Selecione o bloco e informe a unidade.");
    if (tipo === "UNIDADE" && moradoresDaUnidade.length === 0) return setErr("Nenhum morador encontrado para esta unidade neste bloco.");
if (tipo === "MORADOR" && !moradorUid) return setErr("Selecione o morador.");

      // resolve destinatários
      const resolvedUid =
          tipo === "MORADOR" ? (moradorUid || null) :
          null;
const toUids =
        tipo === "CONDOMINIO" ? null :
        tipo === "BLOCO" ? (moradores ?? []).filter((m) => String(m.blocoId ?? m.bloco ?? "") === String(blocoId)).map((m) => m.id) :
        tipo === "UNIDADE" ? (moradoresDaUnidade.map((m) => m.id)) :
        tipo === "MORADOR" ? (resolvedUid ? [resolvedUid] : []) :
        null;

    const threadId = buildThreadId({
      tipo,
      blocoId: blocoId || null,
      unidade: unidade.trim() || null,
      uid: (tipo === "UNIDADE" ? null : (moradorUid || null)),
    });

    const titulo =
      tipo === "CONDOMINIO"
        ? "Condomínio (todos)"
        : tipo === "BLOCO"
        ? `Bloco ${String(blocos?.find((b) => b.id === blocoId)?.nome ?? blocoId)}`
        : tipo === "UNIDADE"
        ? `Unidade ${unidade.trim()} • Bloco ${String(blocos?.find((b) => b.id === blocoId)?.nome ?? blocoId)}`
        : `Morador ${String(moradores.find((m) => m.id === moradorUid)?.nome ?? moradorUid)}`;

    const ref = doc(firestore, "condominios", condominioAtivoId, "threads", threadId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        tipo,
        alvo: {
            unidadeId: tipo === "UNIDADE" ? unidade.trim() : null,
            uidMorador: null,
            blocoId: blocoId || null,
          unidade: unidade.trim() || null,
          uid: (tipo === "UNIDADE" ? null : (moradorUid || null)),
        },
        titulo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: "",            moradorReplyEnabled: false,

          toUids: toUids ?? null,
      });
    }

    setThreadAtual({
      id: threadId,
      tipo,
      alvo: { blocoId: blocoId || null, unidade: unidade.trim() || null, uid: (tipo === "UNIDADE" ? null : (moradorUid || null)) },
      titulo,
    } as any);
  }

    const isMorador = hasRole(session, ["MORADOR"]);
    const canReplyAsMorador =
      !!isMorador &&
      !!threadAtual &&
      (threadAtual as any).tipo === "MORADOR" &&
      ((threadAtual as any).alvo?.uid ?? null) === (myUid ?? null) &&
      (threadAtual as any).moradorReplyEnabled === true;

    const canSend = canManage || canReplyAsMorador;


  async function send() {
    setErr(null);
    if (!canSend) return setErr("Você só pode responder quando o síndico/administrador liberar esta conversa.");
    if (!firestore || !condominioAtivoId) return setErr("Selecione um condomínio.");
    if (!threadAtual?.id) return setErr("Crie/abra uma conversa primeiro.");

    const t = texto.trim();
    if (!t) return;

    setSending(true);
    try {
      await addDoc(
        collection(firestore, "condominios", condominioAtivoId, "threads", threadAtual.id, "mensagens"),
        {
          texto: t,
          createdAt: serverTimestamp(),
          createdByUid: myUid,
          createdByNome: myNome,
        }
      );

      // atualiza resumo da thread
      await setDoc(
        doc(firestore, "condominios", condominioAtivoId, "threads", threadAtual.id),
        { updatedAt: serverTimestamp(), lastMessage: t },
        { merge: true }
      );

      setTexto("");
    } catch (e: any) {
      setErr(e?.message || "Falha ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* LADO ESQUERDO: criar/abrir thread */}
      <GlassCard className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Mensagens</CardTitle>
          <CardDescription>
            {canManage ? "Envie comunicação direcionada por condomínio, bloco, unidade ou morador." : "Mensagens recebidas do condomínio e dos administradores."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!condominioAtivoId && (
            <div className="text-sm text-amber-700">Selecione um condomínio no topo para usar as mensagens.</div>
          )}

          <div className="space-y-2">
              <div className="text-sm font-medium">Destino</div>

              <select
                className="h-10 w-full rounded-xl border bg-white/60 px-3 text-sm"
                value={tipo}
                onChange={(e) => {
                  const v = e.target.value as any;
                  setTipo(v);
                  setThreadAtual(null);
                  setErr(null);

                  // limpa seleções dependentes ao trocar tipo
                  if (v !== "BLOCO" && v !== "UNIDADE") setBlocoId("");
                  if (v !== "UNIDADE") setUnidade("");
                  if (v !== "MORADOR") setMoradorUid("");
                }}
                disabled={!canSend}
              >
                <option value="CONDOMINIO">Condomínio (todos)</option>
                <option value="BLOCO">Bloco</option>
                <option value="UNIDADE">Unidade / Apto</option>
                <option value="MORADOR">Morador (individual)</option>
              </select>

              {(tipo === "BLOCO" || tipo === "UNIDADE") && (
                <div className="space-y-1">
                  <div className="text-sm">Bloco</div>
                  <select
                    className="h-10 w-full rounded-xl border bg-white/60 px-3 text-sm"
                    value={blocoId}
                    onChange={(e) => {
                      setBlocoId(e.target.value);
                      setUnidade("");
                    }}
                    disabled={!canManage || !condominioAtivoId}
                  >
                    <option value="">Selecione...</option>
                    {(blocos ?? []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {tipo === "UNIDADE" && (
                <div className="space-y-1">
                  <div className="text-sm">Unidade / Apto</div>

                  <select
                    className="h-10 w-full rounded-xl border bg-white/60 px-3 text-sm"
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value)}
                    disabled={!canManage || !condominioAtivoId || !blocoId}
                  >
                    <option value="">
                      {!blocoId ? "Selecione o bloco primeiro..." : "Selecione..."}
                    </option>
                    {unidadesDoBloco.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>

                  {blocoId && unidade.trim() && (
                    <div className="text-xs">
                      {moradoresDaUnidade.length > 0 ? (
                          <span className="text-emerald-700">
                            ✅ {moradoresDaUnidade.length} morador(es) encontrado(s):{" "}
                            {moradoresDaUnidade
                              .slice(0, 3)
                              .map((m) => m.nome ?? m.email ?? m.id)
                              .join(", ")}
                            {moradoresDaUnidade.length > 3 ? "..." : ""}
                          </span>
                        ) : (
                          <span className="text-amber-700">
                            ⚠️ Nenhum morador encontrado para esta unidade neste bloco.
                          </span>
                        )}
                    </div>
                  )}
                </div>
              )}

              {tipo === "MORADOR" && (
                <div className="space-y-1">
                  <div className="text-sm">Morador</div>
                  <select
                    className="h-10 w-full rounded-xl border bg-white/60 px-3 text-sm"
                    value={moradorUid}
                    onChange={(e) => setMoradorUid(e.target.value)}
                    disabled={!canManage || !condominioAtivoId}
                  >
                    <option value="">Selecione...</option>
                    {moradores.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome ?? m.email ?? m.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

{err && <div className="text-sm text-red-600">{err}</div>}

          <Button
            className="w-full"
            onClick={ensureThreadAndOpen}
            disabled={!canManage || !condominioAtivoId}
          >
            Abrir conversa
          </Button>

          <div className="pt-2 border-t">
            <div className="text-sm font-medium mb-2">Conversas recentes</div>
            {loadingThreads ? (
              <div className="text-sm text-slate-600">Carregando...</div>
            ) : (threads ?? []).length === 0 ? (
              <div className="text-sm text-slate-600">Nenhuma conversa criada ainda.</div>
            ) : (
              <div className="space-y-2">
                {(threads ?? []).slice(0, 8).map((t) => (
                  <button
                    key={t.id}
                    className={cn(
                      "w-full text-left rounded-xl border p-3 hover:bg-white/60 transition",
                      threadAtual?.id === t.id ? "bg-white/70" : "bg-white/40"
                    )}
                    onClick={() => setThreadAtual(t)}
                  >
                    <div className="text-sm font-semibold">{t.titulo ?? labelDestino(t)}</div>
                    <div className="text-xs text-slate-600 line-clamp-1">{t.lastMessage ?? "—"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </GlassCard>

      {/* DIREITA: chat */}
      <GlassCard className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Conversa</CardTitle>
          <CardDescription>
            {threadAtual ? threadAtual.titulo : "Abra uma conversa para começar."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!threadAtual ? (
            <div className="text-sm text-slate-600">
              Selecione o destino e clique em <b>Abrir conversa</b>, ou abra uma conversa recente.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border bg-white/50 p-4 min-h-[320px] max-h-[420px] overflow-auto space-y-2">
                {loadingMsgs ? (
                  <div className="text-sm text-slate-600">Carregando mensagens...</div>
                ) : (msgs ?? []).length === 0 ? (
                  <div className="text-sm text-slate-600">Nenhuma mensagem ainda.</div>
                ) : (
                  (msgs ?? []).map((m) => {
                    const isMe = m.createdByUid && myUid && m.createdByUid === myUid;
                    return (
                      <div key={m.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl border px-3 py-2 text-sm",
                            isMe ? "bg-white/80" : "bg-white/60"
                          )}
                        >
                          <div className="text-xs text-slate-500 mb-1">
                            {m.createdByNome ?? "—"}
                          </div>
                          <div className="whitespace-pre-wrap">{m.texto}</div>
                        </div>
                      </div>
                    );
                  })
                )}


                {canManage && threadAtual?.tipo === "MORADOR" && (
                  <div className="rounded-2xl border bg-white/50 p-3 text-sm flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">Resposta do morador</div>
                      <div className="text-xs text-slate-600">
                        Ative para permitir que o morador responda nesta conversa.
                      </div>
                    </div>

                    <Button
                      variant={(threadAtual as any).moradorReplyEnabled ? "default" : "secondary"}
                      onClick={async () => {
                        try {
                          if (!firestore || !condominioAtivoId || !threadAtual?.id) return;
                          const next = !((threadAtual as any).moradorReplyEnabled === true);
                          await setDoc(
                            doc(firestore, "condominios", condominioAtivoId, "threads", threadAtual.id),
                            { moradorReplyEnabled: next },
                            { merge: true }
                          );
                          setThreadAtual((prev: any) => (prev ? { ...prev, moradorReplyEnabled: next } : prev));
                        } catch (e: any) {
                          setErr(e?.message || "Falha ao atualizar permissão de resposta do morador.");
                        }
                      }}
                    >
                      {(threadAtual as any).moradorReplyEnabled ? "Desabilitar" : "Habilitar"}
                    </Button>
                  </div>
                )}

                {!canManage &&
                  threadAtual?.tipo === "MORADOR" &&
                  ((threadAtual as any).alvo?.uid ?? null) === (myUid ?? null) &&
                  (threadAtual as any).moradorReplyEnabled !== true && (
                    <div className="text-sm text-amber-700">
                      Aguarde: o síndico/administrador ainda não liberou sua resposta nesta conversa.
                    </div>
                  )}

              </div>

              <div className="flex gap-2">
                <Input
                  className="tc-input"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Digite a mensagem..."
                  disabled={!canSend}
                />
                <Button onClick={send} disabled={!canSend || sending || !texto.trim()}>
                  {sending ? "Enviando..." : "Enviar"}
                </Button>
              </div>

              {!canSend && (
                  <div className="text-xs text-slate-600">
                    Você não pode enviar mensagens nesta conversa.
                  </div>
                )}
            </>
          )}
        </CardContent>
      </GlassCard>
    </div>
  );
}
