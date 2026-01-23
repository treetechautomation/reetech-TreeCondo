"use client";

import * as React from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useReservas } from "@/hooks/useReservas";
import { useFirestore } from "@/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function moneyBRLFromCentavos(v?: number) {
  const n = Number(v ?? 0) / 100;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AgendaReservasPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const condId = session?.activeCondominioId ?? null;
  const user = session?.user ?? null;
  const role: string | null = (session as any)?.role ?? null;

  const firestore = useFirestore();
  const podeVer = !isSessionLoading && !!session && !!condId;

  const [dateStr, setDateStr] = React.useState(() => toISODateLocal(new Date()));
  const [loadingCheckinId, setLoadingCheckinId] = React.useState<string | null>(null);

  // reaproveita o hook que já existe
  const { reservas, loadingReservas } = useReservas(condId, dateStr);

  const isPorteiro = role === "PORTEIRO";
  const isAdminLike = role === "SINDICO" || role === "ADMIN" || role === "ADMIN_CONDOMINIO";

  // Porteiro vê só aprovadas do dia; admin também pode ver pra auditoria
  const reservasDoDia = React.useMemo(() => {
    const base = reservas || [];
    return base.filter((r: any) => String(r.status) === "APROVADA");
  }, [reservas]);

  // cache de membros por uid (nome/bloco/unidade)
  const [membrosByUid, setMembrosByUid] = React.useState<Record<string, any>>({});

  React.useEffect(() => {
    if (!firestore || !condId) return;
    if (!isPorteiro && !isAdminLike) return;

    const uids = Array.from(new Set(reservasDoDia.map((r: any) => r.uid).filter(Boolean)));
    if (uids.length === 0) return;

    let cancelled = false;

    (async () => {
      const next: Record<string, any> = {};
      for (const uid of uids) {
        try {
          // membros/{uid} tem nome/blocoId/unidadeId (conforme seu print)
          const snap = await getDoc(doc(firestore, "condominios", String(condId), "membros", String(uid)));
          if (snap.exists()) next[uid] = snap.data();
        } catch (e) {
          // silencioso (não quebra a tela)
          console.error("[Agenda] falha ao carregar membro", uid, e);
        }
      }
      if (!cancelled) setMembrosByUid((prev) => ({ ...prev, ...next }));
    })();

    return () => {
      cancelled = true;
    };
  }, [firestore, condId, isPorteiro, isAdminLike, reservasDoDia.map((r: any) => r.uid).join("|")]);

  async function handleCheckin(reservaId: string) {
    if (!podeVer) return;
    if (!firestore || !condId) return;

    // Somente PORTEIRO (ou admin pra teste)
    if (!isPorteiro && !isAdminLike) {
      alert("Sem permissão para registrar entrada.");
      return;
    }

    setLoadingCheckinId(reservaId);
    try {
      await updateDoc(doc(firestore, "condominios", String(condId), "reservas", String(reservaId)), {
        statusAcesso: "ENTROU",
        entradaEm: serverTimestamp(),
        porteiroUid: user?.uid ?? null,
      });
      alert("✅ Entrada registrada (check-in).");
    } catch (e) {
      console.error("[Agenda] erro no check-in:", e);
      alert("❌ Erro ao registrar entrada. Veja o console.");
    } finally {
      setLoadingCheckinId(null);
    }
  }

  return (
    <AppLayout pageTitle="Agenda de Reservas" headerActions={null}>
      {!podeVer ? (
        <div className="rounded-2xl border bg-card p-6">
          <div className="text-sm text-muted-foreground">Carregando sessão/condomínio...</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top bar */}
          <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="text-sm text-muted-foreground">Dia</div>
              <input
                className="h-10 rounded-xl border bg-background px-3 text-sm"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>

            <div className="text-xs text-muted-foreground">
              {loadingReservas ? "Carregando..." : `${reservasDoDia.length} reserva(s) aprovada(s)`}
            </div>
          </div>

          {/* Lista */}
          <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Reservas aprovadas do dia</div>
              <div className="text-xs text-muted-foreground">{isPorteiro ? "Modo porteiro" : "Modo auditoria"}</div>
            </div>

            {loadingReservas ? (
              <div className="mt-4 text-sm text-muted-foreground">Buscando reservas...</div>
            ) : reservasDoDia.length === 0 ? (
              <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                Nenhuma reserva aprovada para este dia.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {reservasDoDia.map((r: any) => {
                  const m = membrosByUid[r.uid] || null;
                  const nome = m?.nome || m?.displayName || m?.name || "";
                  const bloco = m?.blocoId || m?.bloco || m?.blocoNome || "";
                  const unidade = m?.unidadeId || m?.unidade || m?.unidadeNome || m?.apto || "";

                  const entrou = String(r.statusAcesso || "") === "ENTROU";

                  return (
                    <div key={r.id} className="rounded-xl border p-4 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">
                          Área: <span className="text-muted-foreground">{r.areaId}</span>
                        </div>

                        <div className="text-sm">
                          {entrou ? (
                            <span className="font-semibold">✅ Entrou</span>
                          ) : (
                            <span className="font-semibold">🟢 Aguardando entrada</span>
                          )}
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        Morador: <span className="font-medium">{nome || r.uid}</span>
                        {bloco || unidade ? (
                          <span className="text-muted-foreground">
                            {" "}
                            • {bloco ? `Bloco ${bloco}` : ""}
                            {bloco && unidade ? " • " : ""}
                            {unidade ? `Unidade/Apto ${unidade}` : ""}
                          </span>
                        ) : null}
                      </div>

                      <div className="text-sm text-muted-foreground">
                        Valor: {moneyBRLFromCentavos(r.valorCobrado)}
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline">
                          <Link href={`/reservas/convidados-checkin/${r.id}`}>Convidados</Link>
                        </Button>

                        <Button
                          variant="default"
                          onClick={() => handleCheckin(r.id)}
                          disabled={entrou || loadingCheckinId === r.id}
                        >
                          {loadingCheckinId === r.id ? "Registrando..." : entrou ? "Já registrado" : "Registrar entrada"}
                        </Button>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Reserva ID: {r.id} • UID: {r.uid}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
