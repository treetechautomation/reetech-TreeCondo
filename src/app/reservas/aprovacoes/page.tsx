"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useReservas } from "@/hooks/useReservas";
import { useFirestore } from "@/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ReservasAprovacoesPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const condId = session?.activeCondominioId ?? null;
  const role = session?.role ?? null;
  const user = session?.user ?? null;

  const firestore = useFirestore();

  const podeVer = !isSessionLoading && !!session && !!condId;
  const canAprovar = podeVer && ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO"].includes(String(role ?? ""));

  const [dateStr, setDateStr] = React.useState(() => toISODateLocal(new Date()));
  const { reservas, loadingReservas } = useReservas(condId, dateStr);

  const pendentes = React.useMemo(() => {
    return (reservas || []).filter((r: any) => String(r.status ?? "") === "PENDENTE");
  }, [reservas]);

  async function setStatus(reservaId: string, status: "APROVADA" | "REJEITADA") {
    if (!firestore || !condId || !user?.uid) return;

    await updateDoc(doc(firestore, "condominios", condId, "reservas", reservaId), {
      status,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: user.uid,
      ...(status === "APROVADA" ? { aprovadoEm: serverTimestamp(), aprovadoPor: user.uid } : {}),
      ...(status === "REJEITADA" ? { rejeitadoEm: serverTimestamp(), rejeitadoPor: user.uid } : {}),
    });
  }

  return (
    <AppLayout pageTitle="Aprovações de Reservas" headerActions={null}>
      {!podeVer ? (
        <div className="rounded-2xl border bg-card p-6">
          <div className="text-sm text-muted-foreground">Carregando sessão/condomínio...</div>
        </div>
      ) : !canAprovar ? (
        <div className="rounded-2xl border bg-card p-6">
          <div className="font-medium">Sem permissão</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Apenas SÍNDICO/ADMIN podem aprovar ou rejeitar reservas.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
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
              {loadingReservas ? "Carregando..." : `${pendentes.length} pendente(s)`}
            </div>
          </div>

          <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-4 shadow-sm">
            <div className="font-semibold">Pendentes</div>

            {loadingReservas ? (
              <div className="mt-4 text-sm text-muted-foreground">Buscando reservas...</div>
            ) : pendentes.length === 0 ? (
              <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                Nenhuma reserva pendente neste dia.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {pendentes.map((r: any) => (
                  <div key={r.id} className="rounded-xl border p-4 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">
                        Área: <span className="text-muted-foreground">{r.areaId}</span>
                      </div>
                      <div className="text-sm">
                        Status: <span className="font-semibold">{r.status}</span>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">Reserva ID: {r.id} • UID: {r.uid}</div>

                    <div className="flex gap-2">
                      <Button onClick={() => setStatus(r.id, "APROVADA")}>Aprovar</Button>
                      <Button variant="secondary" onClick={() => setStatus(r.id, "REJEITADA")}>
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
