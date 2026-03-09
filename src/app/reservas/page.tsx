"use client";

import * as React from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useReservas } from "@/hooks/useReservas";
import { AreaCard } from "@/components/reservas/AreaCard";
import { CalendarMonth } from "@/components/reservas/CalendarMonth";
import { AreaOpcaoDialog } from "@/components/reservas/AreaOpcaoDialog";

import { useFirestore } from "@/firebase";
import {
  addDoc,
  collection,
  Timestamp,
  serverTimestamp,
  getDoc,
  getDocs,
  doc,
  setDoc,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import { isDiaDisponivelPorArea, startOfDayUTC } from "@/lib/reservasDisponibilidade";

import {
  isSunday,
  getStatusForNewReserva,
  requiresApproval,
  getPoliticasReservas,
  type ReservasPoliticas
} from "@/lib/reservasPoliticas";

function moneyBRLFromCentavos(v?: number) {
  const n = Number(v ?? 0) / 100;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}


function isBlockedISODate(dateStrYYYYMMDD: string, politicas: any) {
  // domingo bloqueado pela política
  if ((politicas?.bloquearDomingo ?? true) && isSunday(dateStrYYYYMMDD)) return true;
  return false;
}

export default function ReservasPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const condId = session?.activeCondominioId ?? null;
  const user = session?.user ?? null;
  const role = session?.role ?? null;


  const meuUid = user?.uid ?? null;
  const firestore = useFirestore();
  const podeVer = !isSessionLoading && !!session && !!condId;

  const isAdminLike = role === "SINDICO" || role === "ADMIN" || role === "ADMIN_CONDOMINIO";
  const isMoradorLike = role === "MORADOR" || role === "SINDICO";

  const [dateStr, setDateStr] = React.useState(() => toISODateLocal(new Date()));
  const [areaFilter, setAreaFilter] = React.useState<string | "ALL">("ALL");

  const [selectedAreaId, setSelectedAreaId] = React.useState<string>("ALL");

  const [opcoesOpen, setOpcoesOpen] = React.useState(false);
  const [areaParaOpcaoId, setAreaParaOpcaoId] = React.useState<string | null>(null);

  const [selectedOpcaoId, setSelectedOpcaoId] = React.useState<string | null>(null);

  const [selectedOpcaoMeta, setSelectedOpcaoMeta] = React.useState<{
    opcaoId: string;
    opcaoNome: string;
    precoCentavos: number;
    bloqueiaAreaId?: string | null;
  } | null>(null);

  const [isChecking, setIsChecking] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);

  const { areas, reservas, loadingAreas, loadingReservas } = useReservas(condId, dateStr);


    const [politicas, setPoliticas] = React.useState<ReservasPoliticas | null>(null);

    // carrega políticas de reserva por condomínio (dinâmico)
    React.useEffect(() => {
      let cancelledP = false;

      async function loadPoliticas() {
        try {
          if (!firestore || !condId) {
            if (!cancelledP) setPoliticas(null);
            return;
          }
          const p = await getPoliticasReservas(firestore, condId);
          if (!cancelledP) setPoliticas(p);
        } catch (e) {
          console.error("[Reservas] erro ao carregar politicas:", e);
          if (!cancelledP) setPoliticas(null);
        }
      }

      loadPoliticas();
      return () => {
        cancelledP = true;
      };
    }, [firestore, condId]);

  const [membrosByUid, setMembrosByUid] = React.useState<Record<string, any>>({});

  const [filaByArea, setFilaByArea] = React.useState<Record<string, any[]>>({})

  const reservasFiltradas = React.useMemo(() => {
    if (areaFilter === "ALL") return reservas;
    return reservas.filter((r) => r.areaId === areaFilter);
  }, [reservas, areaFilter]);

  const reservasVisiveis = React.useMemo(() => {
    return reservasFiltradas || [];
  }, [reservasFiltradas]);

React.useEffect(() => {
    let cancelled = false;

    async function fetchMembros() {
      if (!firestore || !condId || !isAdminLike) {
        return;
      }

      const uidsReservas = (reservasVisiveis || []).map((r: any) => r?.uid).filter(Boolean);
        const uidsFila = Object.values(filaByArea || {})
          .flatMap((items: any) => Array.isArray(items) ? items.map((f: any) => f?.uid).filter(Boolean) : []);

        const uidsToFetch = Array.from(new Set([...uidsReservas, ...uidsFila]))
        .filter(uid => !membrosByUid[uid]);

      if (uidsToFetch.length === 0) return;

      const newMembros: Record<string, any> = {};
      for (const uid of uidsToFetch) {
        try {
          const snap = await getDoc(doc(firestore, "condominios", condId, "membros", uid));
          if (snap.exists()) {
            newMembros[uid] = snap.data();
          }
        } catch (e) {
          console.error(`Falha ao buscar membro ${uid}:`, e);
        }
      }

      if (!cancelled && Object.keys(newMembros).length > 0) {
        setMembrosByUid(prev => ({ ...prev, ...newMembros }));
      }
    }

    fetchMembros();

    return () => { cancelled = true; }
  }, [firestore, condId, isAdminLike, reservasVisiveis, filaByArea, membrosByUid]);

  

  const [slotsDoDia,setSlotsDoDia] = React.useState<Record<string,{occupied:boolean,filaCount:number}>>({})
  React.useEffect(()=>{

    if(!firestore || !condId || !dateStr){
      setSlotsDoDia({})
      return
    }

    const q = query(
      collection(firestore,"condominios",String(condId),"reservasSlots"),
      where("dateStr","==",dateStr)
    )

    return onSnapshot(q, (snap: any) => {
      const next: Record<string, { occupied: boolean; filaCount: number }> = {};

      snap.forEach((d: any) => {
        const data = d.data() || {};
        const areaId = String(data.areaId || "");
        if (!areaId) return;

        next[areaId] = {
          occupied: Boolean(data.occupied === true),
          filaCount: Number(data.filaCount || 0),
        };
      });

      setSlotsDoDia(next);
    }, (err: any) => {
      console.error("erro slots", err);
      setSlotsDoDia({});
    })

  },[firestore,condId,dateStr])


  React.useEffect(() => {
    let alive = true;

    async function loadFilaDoDia() {
      if (!firestore || !condId || !dateStr || !(areas || []).length) {
        setFilaByArea({});
        return;
      }

      try {
        const entries = await Promise.all(
          (areas || []).map(async (a: any) => {
            const areaId = String(a?.id || "");
            if (!areaId) return [areaId, []];

            const slotId = areaId + "__" + dateStr;

            const filaCol = collection(
              firestore,
              "condominios",
              String(condId),
              "reservasSlots",
              slotId,
              "fila"
            );

            const snap = await getDocs(filaCol);

            const items = snap.docs
              .map((d: any) => {
                const data = d.data() || {};
                const createdAt = data?.createdAt || null;
                const createdAtMs =
                  createdAt && typeof createdAt.toDate === "function"
                    ? createdAt.toDate().getTime()
                    : 0;

                return {
                  id: d.id,
                  uid: String(data?.uid || d.id || ""),
                  status: String(data?.status || "AGUARDANDO"),
                  opcaoId: data?.opcaoId ?? null,
                  opcaoNome: data?.opcaoNome ?? null,
                  valorCobrado: Number(data?.valorCobrado || 0),
                  capacidadeMax: data?.capacidadeMax ?? null,
                  createdAt,
                  createdAtMs,
                };
              })
              .sort((a: any, b: any) => a.createdAtMs - b.createdAtMs);

            return [areaId, items];
          })
        );

        if (!alive) return;
        setFilaByArea(Object.fromEntries(entries));
      } catch (e) {
        console.error("[Reservas] erro ao carregar fila do dia:", e);
        if (alive) setFilaByArea({});
      }
    }

    loadFilaDoDia();

    return () => {
      alive = false;
    };
  }, [firestore, condId, dateStr, areas]);



  const areaParaOpcao = React.useMemo(() => {
    if (!areaParaOpcaoId) return null;
    return (areas || []).find((x: any) => x.id === areaParaOpcaoId) ?? null;
  }, [areas, areaParaOpcaoId]);

  function handleSelectAll() {
    setSelectedAreaId("ALL");
    setAreaFilter("ALL");
    setSelectedOpcaoId(null);
    setSelectedOpcaoMeta(null);
    setAreaParaOpcaoId(null);
    setOpcoesOpen(false);
  }

  function handleSelectArea(area: any) {
    if (!area?.id) return;

    setSelectedAreaId(area.id);
    setAreaFilter(area.id);

    const hasOpcoes = Array.isArray(area.opcoes) && area.opcoes.length > 0;

    if (hasOpcoes) {
      setSelectedOpcaoId(null);
      setSelectedOpcaoMeta(null);
      setAreaParaOpcaoId(area.id);
      setOpcoesOpen(true);
      return;
    }

    setAreaParaOpcaoId(null);
    setOpcoesOpen(false);
    setSelectedOpcaoId("base");
    setSelectedOpcaoMeta({
      opcaoId: "base",
      opcaoNome: String(area.nome ?? area.id),
      precoCentavos: Number(area.preco || 0),
      bloqueiaAreaId: null,
    });
  }

  const podeReservar =
    podeVer && isMoradorLike && selectedAreaId !== "ALL" && !!selectedOpcaoMeta && !isChecking && !isCreating;

  async function handleSolicitarReserva() {
      if (!podeVer || !podeReservar) return;

      if ((politicas?.bloquearDomingo ?? true) && isSunday(dateStr)) {
        alert("❌ Não é permitido fazer reservas aos domingos.");
        return;
      }

      if (!condId || selectedAreaId === "ALL" || !selectedOpcaoMeta) {
        alert("Selecione uma área e uma opção para reservar.");
        return;
      }
      if (!firestore || !user?.uid) {
        alert("Sessão inválida. Recarregue a página.");
        return;
      }

      const statusInicial = getStatusForNewReserva(dateStr, politicas || { bloquearDomingo: true, autoAprovarAposHoras: 24, exigirAprovacaoQuandoMenosQueHoras: 24, cancelamentoMinHoras: 48 });
      const precisaAprovacao = requiresApproval(dateStr, politicas || { bloquearDomingo: true, autoAprovarAposHoras: 24, exigirAprovacaoQuandoMenosQueHoras: 24, cancelamentoMinHoras: 48 });

      setIsChecking(true);
      try {
        // decisão de RESERVA ou FILA agora é feita na API
      } finally {
        setIsChecking(false);
      }

    setIsCreating(true);
    try {
      const dataIni = startOfDayUTC(dateStr);


        const areaSel = (areas || []).find((a: any) => String(a.id) === String(selectedAreaId)) ?? null;
        const capacidadeMaxSel = (Number.isFinite(Number(areaSel?.capacidadeMax)) ? Number(areaSel?.capacidadeMax) : null);
      const resp = await apiPostAuth("/api/reservas/criar", {
          condominioId: condId,
          areaId: selectedAreaId,
          dateStr,
          opcaoId: selectedOpcaoMeta.opcaoId,
          opcaoNome: selectedOpcaoMeta.opcaoNome,
          valorCobrado: Number(selectedOpcaoMeta.precoCentavos) || 0,
          capacidadeMax: capacidadeMaxSel,
          // mantém compat com sua lógica atual:
          statusInicial,
          precisaAprovacao,
        });

        if (resp?.mode === "FILA") {
          alert(`✅ Dia ocupado. Você entrou na fila de espera (posição ~${resp?.filaCount || "?"}/3).`);
        } else {
          alert("✅ Reserva enviada (PENDENTE).");
        }
      } catch (e: any) {
        const msg = String(e?.message || e || "");
        console.error("[Reservas] erro ao criar reserva:", e);

        if (msg.includes("já tem fila")) {
          alert("⚠️ Você já está na fila desta área para este dia.");
        } else if (msg.includes("já tem reserva")) {
          alert("⚠️ Você já tem uma reserva nesta área para este dia.");
        } else if (msg.includes("Fila cheia")) {
          alert("❌ Esta área já está com a fila cheia para este dia.");
        } else {
          alert("❌ " + (msg || "Erro ao criar reserva."));
        }
      } finally {
      setIsCreating(false);
    }
  }

  async function handleCancelarFila(areaId: string, targetUid?: string) {
    if (!condId) return;

    try {
      await apiPostAuth("/api/reservas/fila-cancelar", {
        condominioId: condId,
        areaId,
        dateStr,
        ...(targetUid ? { targetUid } : {}),
      });

      alert(targetUid && targetUid !== meuUid
        ? "✅ Usuário removido da fila."
        : "✅ Você saiu da fila de espera.");

      window.location.reload();
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      alert("❌ " + (msg || "Erro ao cancelar fila."));
    }
  }

async function apiPostAuth(path: string, body: any) {
  const authMod: any = await import("firebase/auth");
  const { getAuth } = authMod;
  const auth = getAuth();
  const u = auth?.currentUser;
  if (!u) throw new Error("Sem usuário autenticado.");
  const token = await u.getIdToken();
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Erro ${r.status}`);
  return data;
}

function canCancelBy48h(dateTs: any, minHoras = 48) {
  try {
    // dateTs pode ser Timestamp do firestore com .toDate()
    const d = (dateTs && typeof dateTs.toDate === "function") ? dateTs.toDate() : null;
    if (!d) return false;
    const ms = d.getTime() - (minHoras * 60 * 60 * 1000);
    return Date.now() <= ms;
  } catch {
    return false;
  }
}

return (

    <AppLayout
      pageTitle="Reservas"
        headerActions={
          isMoradorLike ? null : (
            <Button asChild variant="default">
              <Link href="/reservas/agenda">
                Ver solicitações
              </Link>
            </Button>
          )
        }
    >
      {!podeVer ? (
        <div className="rounded-2xl border bg-card p-6">
          <div className="text-sm text-[#0D4459]">Carregando sessão/condomínio...</div>
        </div>
      ) : (
        <div className="space-y-6">
          
          
<div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between shadow-sm">
  <div className="text-sm text-[#0D4459]">
    <span className="text-[#0D4459] font-medium">
  Selecione um dia no calendário da área desejada.
  </span>
  </div>
  <div className="text-xs text-[#0D4459]">
    {selectedAreaId === "ALL" ? "Selecione um dia no calendário da área desejada" : "Área selecionada"}
    {selectedOpcaoMeta ? ` • ${moneyBRLFromCentavos(selectedOpcaoMeta.precoCentavos)}` : ""}
    {dateStr ? ` • ${dateStr}` : ""}
  </div>
</div>
<div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Áreas reserváveis</div>
              <div className="text-xs text-[#0D4459]">{loadingAreas ? "Carregando..." : `${areas.length} área(s)`}</div>
            </div>
            {loadingAreas ? (
              <div className="mt-4 text-sm text-[#0D4459]">Buscando áreas...</div>
            ) : areas.length === 0 ? (
              <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-sm">
                <div className="font-medium">Nenhuma área configurada neste condomínio.</div>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant={areaFilter === "ALL" ? "default" : "secondary"} onClick={handleSelectAll}>
                    Todas
                  </Button>
                </div>
                <div className="flex flex-col gap-3">
                  {areas.map((a: any) => (
  <AreaCard
    key={a.id}
    area={a as any}
    selected={selectedAreaId === a.id}
    onSelect={() => handleSelectArea(a)}
    availability={(() => {
      const slotDaArea = slotsDoDia[String(a.id)] || { occupied: false, filaCount: 0 };
      const filaCountDaArea = Number(slotDaArea.filaCount || 0) || 0;
      const occupiedDaArea = Boolean(slotDaArea.occupied === true);
      return filaCountDaArea >= 3
        ? "unavailable"
        : (occupiedDaArea || filaCountDaArea > 0)
          ? "queued"
          : "available";
    })()}
    availabilityLabel={(() => {
      const slotDaArea = slotsDoDia[String(a.id)] || { occupied: false, filaCount: 0 };
      const filaCountDaArea = Number(slotDaArea.filaCount || 0) || 0;
      const occupiedDaArea = Boolean(slotDaArea.occupied === true);
      return filaCountDaArea >= 3
        ? "Indisponível"
        : (occupiedDaArea || filaCountDaArea > 0)
          ? "Em fila / ocupada"
          : "Disponível";
    })()}
    action={isMoradorLike ? (
      <Button
        type="button"
        variant={selectedAreaId === a.id ? "default" : "outline"}
        className="w-full"
        disabled={
          selectedAreaId !== a.id ||
          !selectedOpcaoMeta ||
          isChecking ||
          isCreating
        }
        onClick={(ev) => {
          ev.stopPropagation();
          handleSolicitarReserva();
        }}
      >
        {selectedAreaId !== a.id
          ? "Selecione esta área"
          : isChecking
            ? "Verificando..."
            : isCreating
              ? "Enviando..."
              : "Confirmar reserva"}
      </Button>
    ) : null}
  >
    <CalendarMonth
      firestore={firestore as any}
      condominioId={condId}
      areaId={String(a.id)}
      selectedDateStr={dateStr}
      bloquearDomingo={Boolean(politicas?.bloquearDomingo ?? true)}
      onSelectDateStr={(iso: string) => {
        setDateStr(iso);
        handleSelectArea(a);
      }}
    />
  

  {(() => {

    const reservasDaArea = (reservas || []).filter((r: any) => String(r.areaId) === String(a.id));

      const slotDaArea = slotsDoDia[String(a.id)] || {occupied:false,filaCount:0}

      const filaCountDaArea = Number(slotDaArea.filaCount||0)
      const occupiedDaArea = Boolean(slotDaArea.occupied===true)

      const areaAvailability =
        filaCountDaArea>=3
          ? "unavailable"
          : (occupiedDaArea || filaCountDaArea>0)
            ? "queued"
            : "available"

      const areaAvailabilityLabel =
        filaCountDaArea>=3
          ? "Indisponível"
          : (occupiedDaArea || filaCountDaArea>0)
            ? "Em fila / ocupada"
            : "Disponível"


  

    

        const filaDaArea = Array.isArray(filaByArea[String(a.id)])
          ? filaByArea[String(a.id)]
          : [];

        const filaUI = (
          <div className="mt-4 rounded-xl border border-[#FFDE21]/40 bg-[#FFDE21]/10 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-[#8A6A00]">Fila de espera desta área</div>
              <div className="text-xs text-[#8A6A00]">
                {filaDaArea.length} pessoa(s)
              </div>
            </div>

            {filaDaArea.length === 0 ? (
              <div className="mt-3 rounded-xl border bg-white/70 p-3 text-sm text-[#8A6A00]">
                Ninguém na fila de espera para esta área neste dia.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {filaDaArea.map((f: any, idx: number) => {
                  const mf = membrosByUid[f.uid] || null;
                  const nomeFila = mf?.nome || mf?.displayName || mf?.name || f.uid || "Morador";
                  const blocoFila = mf?.blocoId || mf?.bloco || mf?.blocoNome || "";
                  const unidadeFila = mf?.unidadeId || mf?.unidade || mf?.unidadeNome || mf?.apto || "";
                  const souEuNaFila = !!meuUid && String(f.uid) === String(meuUid);

                  return (
                    <div
                      key={f.id || f.uid || idx}
                      className="rounded-xl border border-[#FFDE21]/40 bg-white/70 p-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#8A6A00]">
                            #{idx + 1} • {nomeFila}
                          </div>

                          <div className="text-xs text-[#8A6A00]">
                            Status: {String(f.status || "AGUARDANDO")}
                            {blocoFila || unidadeFila ? (
                              <>
                                {" • "}
                                {blocoFila ? "Bloco " + blocoFila : ""}
                                {blocoFila && unidadeFila ? " • " : ""}
                                {unidadeFila ? "Unidade " + unidadeFila : ""}
                              </>
                            ) : null}
                          </div>

                          <div className="text-xs text-[#8A6A00]">
                            Valor: {moneyBRLFromCentavos(f.valorCobrado)}
                            {f?.opcaoNome ? " • Opção: " + String(f.opcaoNome) : ""}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {souEuNaFila ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancelarFila(String(a.id))}
                            >
                              Desistir da fila
                            </Button>
                          ) : null}

                          {isAdminLike ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelarFila(String(a.id), String(f.uid))}
                            >
                              Remover da fila
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      return (
        <>
          <div className="mt-3 rounded-xl border border-black/5 bg-white/55 p-4 shadow-sm">

        <div className="flex items-center justify-between gap-2">

          <div className="text-sm font-semibold text-[#0D4459]">Reservas desta área no dia</div>

          <div className="text-xs text-[#0D4459]">

            {loadingReservas ? "Carregando..." : `${reservasDaArea.length} reserva(s)`}

          </div>

        </div>

  

        {loadingReservas ? (

          <div className="mt-3 text-sm text-[#0D4459]">Buscando reservas...</div>

        ) : reservasDaArea.length === 0 ? (

          <div className="mt-3 rounded-xl border bg-muted/20 p-3 text-sm text-[#0D4459]">

            Nenhuma reserva para esta área neste dia.

          </div>

        ) : (

          <div className="mt-3 space-y-2">

            {reservasDaArea.map((r: any) => {

              if (isAdminLike) {

                const m = membrosByUid[r.uid] || null;

                const nome = m?.nome || m?.displayName || m?.name || "Morador";

                const bloco = m?.blocoNome || m?.blocoId || m?.bloco || "";

                const unidade = m?.unidadeNome || m?.unidadeId || m?.unidade || m?.apto || "";

  

                return (

                  <div key={r.id} className="rounded-xl border p-4 flex flex-col gap-1">

                    <div className="flex flex-wrap items-center justify-between gap-2">

                      <div className="font-medium">

                        Status: <span className="text-[#0D4459]">{r.status}</span>

                      </div>

                      <div className="text-sm text-[#0D4459]">

                        Valor: <span className="font-semibold">{moneyBRLFromCentavos(r.valorCobrado)}</span>

                      </div>

                    </div>

                    <div className="text-sm text-[#0D4459]">
                        Morador: <span className="font-medium">{nome}</span>
                      </div>

                      {(bloco || unidade) ? (
                        <div className="text-sm text-[#0D4459]">
                          {bloco ? <>Bloco: <span className="font-medium">{bloco}</span></> : null}
                          {bloco && unidade ? <span> • </span> : null}
                          {unidade ? <>Unidade: <span className="font-medium">{unidade}</span></> : null}
                        </div>
                      ) : null}

                  </div>

                );

              }

  

              if (meuUid && r.uid === meuUid) {

                const isAprovada = String(r.status) === "APROVADA";

                return (

                  <div key={r.id} className="rounded-xl border p-4 flex flex-col gap-2">

                    <div className="flex flex-wrap items-center justify-between gap-2">

                      <div className="font-medium">

                        Status: <span className="text-[#0D4459]">{r.status}</span>

                      </div>

                      <div className="text-sm text-[#0D4459]">

                        Valor: <span className="font-semibold">{moneyBRLFromCentavos(r.valorCobrado)}</span>

                      </div>

                    </div>

  

                    {isAprovada && (

                      <div className="flex items-center justify-end gap-2">

                        <Button

                          variant="destructive"

                          size="sm"

                          disabled={!canCancelBy48h(r.data, 48)}

                          onClick={async () => {

                            try {

                              if (!confirm("Cancelar esta reserva?")) return;

                              await apiPostAuth("/api/reservas/cancelar", { condominioId: condId, reservaId: r.id });

                              alert("✅ Reserva cancelada.");

                              window.location.reload();

                            } catch (e: any) {

                              alert("❌ " + String(e?.message || e));

                            }

                          }}

                          title={!canCancelBy48h(r.data, 48) ? "Só é possível cancelar até 48h antes." : "Cancelar reserva"}

                        >

                          Cancelar

                        </Button>

  

                        <Button asChild variant="outline">

                          <Link href={`/reservas/convidados/${r.id}`}>Convidados</Link>

                        </Button>

                      </div>

                    )}

  

                    <div className="text-xs text-[#0D4459]">

                      Reserva ID: {r.id}

                    </div>

                  </div>

                );

              }

  

              return (

                <div key={r.id} className="rounded-xl border p-4 flex items-center justify-between">

                  <div className="font-medium text-[#0D4459]">Reservado</div>

                  <div className="text-sm font-semibold text-primary">{r.status || "RESERVADO"}</div>

                </div>

              );

            })}

          </div>

        )}
        </div>

          {filaUI}
        </>

      );

    })()}

  </AreaCard>
))}
                </div>
              </div>
            )}
          </div>
            {areaParaOpcao ? (
              <AreaOpcaoDialog
                open={opcoesOpen}
                onOpenChange={(v: boolean) => {
                  setOpcoesOpen(v);
                  if (!v) setAreaParaOpcaoId(null);
                }}
                areaNome={String(areaParaOpcao.nome ?? areaParaOpcao.id)}
                precoBaseCentavos={Number(areaParaOpcao.preco || 0)}
                opcoes={(areaParaOpcao.opcoes || []) as any}
                selectedOpcaoId={selectedOpcaoId}
                onConfirm={(p: any) => {
                  setSelectedOpcaoId(p.opcaoId);
                  setSelectedOpcaoMeta(p);
                  setSelectedAreaId(areaParaOpcao.id);
                  setAreaFilter(areaParaOpcao.id);
                  setOpcoesOpen(false);
                  setAreaParaOpcaoId(null);
                }}
              />
            ) : null}
        </div>
      )}
    </AppLayout>
  );
}
