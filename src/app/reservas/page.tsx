"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useReservas } from "@/hooks/useReservas";
import { AreaCard } from "@/components/reservas/AreaCard";
import { CalendarMonth } from "@/components/reservas/CalendarMonth";
import AreaInteractiveMap from "@/components/reservas/AreaInteractiveMap";
import { AreaOpcaoDialog } from "@/components/reservas/AreaOpcaoDialog";
import { ArrowLeft } from "lucide-react";

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
  where,
  updateDoc,
} from "firebase/firestore";

import { normNFD } from "@/lib/normalization/text";
import {
  isSunday,

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
  const router = useRouter();
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

  const [selectedOpcaoId, setSelectedOpcaoId] = React.useState<string | null>(null);

  const [selectedOpcaoMeta, setSelectedOpcaoMeta] = React.useState<{
    opcaoId: string;
    opcaoNome: string;
    precoCentavos: number;
    bloqueiaAreaId?: string | null;
  } | null>(null);

  const [isChecking, setIsChecking] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [cancelReservaId, setCancelReservaId] = React.useState<string | null>(null);
  const [isCancellingReserva, setIsCancellingReserva] = React.useState(false);

  const [openOpcoesDialog, setOpenOpcoesDialog] = React.useState(false);
  const [dialogArea, setDialogArea] = React.useState<any | null>(null);

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
  const fetchedUidsRef = React.useRef<Set<string>>(new Set());
  const [moradoresReservaManual, setMoradoresReservaManual] = React.useState<any[]>([]);
  const [targetUidReserva, setTargetUidReserva] = React.useState<string>("");
  const [blocoFiltroReserva, setBlocoFiltroReserva] = React.useState<string>("TODOS");

  const [filaByArea, setFilaByArea] = React.useState<Record<string, any[]>>({})

  // Checkout Modal / payment States
  const [cobrancasReservas, setCobrancasReservas] = React.useState<Record<string, any>>({});
  const [showCheckoutModal, setShowCheckoutModal] = React.useState(false);
  const [selectedReservaForPayment, setSelectedReservaForPayment] = React.useState<any | null>(null);
  const [paymentOption, setPaymentOption] = React.useState<"PIX" | "CARD">("PIX");
  const [isProcessingPayment, setIsProcessingPayment] = React.useState(false);

  // Credit Card Form States
  const [cardNumber, setCardNumber] = React.useState("");
  const [cardName, setCardName] = React.useState("");
  const [cardExpiry, setCardExpiry] = React.useState("");
  const [cardCvv, setCardCvv] = React.useState("");

  React.useEffect(() => {
    if (!firestore || !condId || !meuUid) return;
    const q = query(
      collection(firestore, "condominios", condId, "financeiro"),
      where("moradorId", "==", meuUid),
      where("status", "==", "pendente")
    );
    return onSnapshot(q, (snap) => {
      const mapping: Record<string, any> = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data.reservaId) {
          mapping[data.reservaId] = { id: d.id, ...data };
        }
      });
      setCobrancasReservas(mapping);
    });
  }, [firestore, condId, meuUid]);

  const handlePayTaxa = async () => {
    // P0.4: pagamento eletrônico em implantação.
    // Nenhuma escrita é executada: NÃO marca cobrança como paga, NÃO altera a
    // reserva para APROVADA e NÃO executa qualquer simulação de pagamento.
    alert("Pagamento eletrônico disponível em breve.");
  };

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
      if (!firestore || !condId) {
        return;
      }

      const uidsReservas = (reservasVisiveis || []).map((r: any) => r?.uid).filter(Boolean);
      const uidsFila = Object.values(filaByArea || {})
        .flatMap((items: any) => Array.isArray(items) ? items.map((f: any) => f?.uid).filter(Boolean) : []);

      const uidsToFetch = Array.from(new Set([...uidsReservas, ...uidsFila]))
        .filter(uid => !fetchedUidsRef.current.has(uid));

      if (uidsToFetch.length === 0) return;

      // Marcar imediatamente para evitar requisições duplicadas concorrentes
      uidsToFetch.forEach(uid => fetchedUidsRef.current.add(uid));

      const newMembros: Record<string, any> = {};
      for (const uid of uidsToFetch) {
        try {
          const snap = await getDoc(doc(firestore, "condominios", condId, "membros", uid));
          if (snap.exists()) {
            newMembros[uid] = snap.data();
          } else {
            newMembros[uid] = { nome: "Usuário Excluído" };
          }
        } catch (e) {
          console.error(`Falha ao buscar membro ${uid}:`, e);
          // Se falhar (ex: erro de permissão definitivo), mantemos no Ref para evitar spam em loop
        }
      }

      if (!cancelled && Object.keys(newMembros).length > 0) {
        setMembrosByUid(prev => ({ ...prev, ...newMembros }));
      }
    }

    fetchMembros();

    return () => { cancelled = true; }
  }, [firestore, condId, reservasVisiveis, filaByArea]);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchMoradoresReservaManual() {
      if (!firestore || !condId || !isAdminLike) {
        if (!cancelled) {
          setMoradoresReservaManual([]);
          setTargetUidReserva("");
        }
        return;
      }

      try {
        const membrosRef = collection(firestore, "condominios", condId, "membros");
        const qMembros = query(membrosRef, where("status", "in", ["ATIVO", "PENDENTE"]));
        const snap = await getDocs(qMembros);

        const items = snap.docs
          .map((d: any) => {
            const data = d.data() || {};
            return {
              uid: String(d.id),
              nome: String(data?.nome || data?.displayName || data?.name || d.id),
              bloco: String(data?.blocoNome || data?.blocoId || data?.bloco || ""),
              unidade: String(data?.unidadeNome || data?.unidadeId || data?.unidade || data?.apto || ""),
              status: String(data?.status || ""),
              role: String(data?.role || ""),
            };
          })
          .filter((item: any) => item.uid)
          .sort((a: any, b: any) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));

        if (!cancelled) {
          setMoradoresReservaManual(items);
          setTargetUidReserva((prev) => {
            if (prev && items.some((m: any) => String(m.uid) === String(prev))) return prev;
            return items[0]?.uid || "";
          });
        }
      } catch (e) {
        console.error("[Reservas] erro ao carregar moradores para reserva manual:", e);
        if (!cancelled) {
          setMoradoresReservaManual([]);
          setTargetUidReserva("");
        }
      }
    }

    fetchMoradoresReservaManual();

    return () => {
      cancelled = true;
    };
  }, [firestore, condId, isAdminLike]);

  const blocosReservaManual = React.useMemo(() => {
    return Array.from(
      new Set(
        moradoresReservaManual
          .map((m: any) => String(m?.bloco || "").trim())
          .filter(Boolean)
      )
    ).sort((a: string, b: string) => a.localeCompare(b, "pt-BR"));
  }, [moradoresReservaManual]);

  const moradoresReservaManualFiltrados = React.useMemo(() => {
    if (blocoFiltroReserva === "TODOS") return moradoresReservaManual;
    return moradoresReservaManual.filter(
      (m: any) => String(m?.bloco || "").trim() === blocoFiltroReserva
    );
  }, [moradoresReservaManual, blocoFiltroReserva]);

  React.useEffect(() => {
    if (!isAdminLike) return;

    if (blocoFiltroReserva !== "TODOS" && !blocosReservaManual.includes(blocoFiltroReserva)) {
      setBlocoFiltroReserva("TODOS");
      return;
    }

    setTargetUidReserva((prev) => {
      if (prev && moradoresReservaManualFiltrados.some((m: any) => String(m.uid) === String(prev))) {
        return prev;
      }
      return moradoresReservaManualFiltrados[0]?.uid || "";
    });
  }, [isAdminLike, blocoFiltroReserva, blocosReservaManual, moradoresReservaManualFiltrados]);

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



  function getAreaOptionItems(area: any) {
    const base = {
      opcaoId: "base",
      opcaoNome: String(area?.nome ?? area?.id ?? "Área"),
      precoCentavos: Number(area?.preco || 0),
      bloqueiaAreaId: null as string | null,
    };

    const normalizeText = (v: any) =>
      String(v ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    const extras = Array.isArray(area?.opcoes)
      ? area.opcoes
          .map((o: any) => ({
            opcaoId: String(o?.id ?? "").trim(),
            opcaoNome: String(o?.nome ?? "").trim(),
            precoCentavos: Number(
              o?.preco ??
              o?.precoCentavos ??
              o?.valor ??
              o?.valorCentavos ??
              o?.valorCobrado ??
              o?.valorCobradoCentavos ??
              0
            ) || 0,
            bloqueiaAreaId: o?.bloqueiaAreaId ?? o?.bloqueia ?? o?.bloqueiaId ?? null,
          }))
          .filter((o: any) => o.opcaoId && o.opcaoNome && o.opcaoId.toLowerCase() !== "base")
          .filter((o: any) => {
            const mesmoNome = normNFD(o.opcaoNome) === normNFD(base.opcaoNome);
            const mesmoPreco = Number(o.precoCentavos || 0) === Number(base.precoCentavos || 0);
            const mesmoBloqueio = String(o.bloqueiaAreaId || "") === String(base.bloqueiaAreaId || "");
            return !(mesmoNome && mesmoPreco && mesmoBloqueio);
          })
      : [];

    return [base, ...extras];
  }

  function handleSelectAll() {
    setSelectedAreaId("ALL");
    setAreaFilter("ALL");
    setSelectedOpcaoId(null);
    setSelectedOpcaoMeta(null);
  }

  function handleSelectArea(area: any) {
    if (!area?.id) return;

    setSelectedAreaId(area.id);
    setAreaFilter(area.id);

    const optionItems = getAreaOptionItems(area);
    const currentStillValid =
      selectedAreaId === area.id &&
      selectedOpcaoId &&
      optionItems.some((o: any) => String(o.opcaoId) === String(selectedOpcaoId));

    const chosen =
      currentStillValid
        ? optionItems.find((o: any) => String(o.opcaoId) === String(selectedOpcaoId))
        : optionItems[0];

    setSelectedOpcaoId(String(chosen?.opcaoId || "base"));
    setSelectedOpcaoMeta({
      opcaoId: String(chosen?.opcaoId || "base"),
      opcaoNome: String(chosen?.opcaoNome || area.nome || area.id),
      precoCentavos: Number(chosen?.precoCentavos || area.preco || 0),
      bloqueiaAreaId: chosen?.bloqueiaAreaId ?? null,
    });
  }

  const podeReservar =
    podeVer &&
    (isMoradorLike || isAdminLike) &&
    selectedAreaId !== "ALL" &&
    !!selectedOpcaoMeta &&
    !isChecking &&
    !isCreating &&
    (!isAdminLike || !!targetUidReserva);

  async function handleSolicitarReserva(forcedOpcaoMeta?: typeof selectedOpcaoMeta) {
    const activeMeta = forcedOpcaoMeta || selectedOpcaoMeta;

    const isAllowed = podeVer &&
      (isMoradorLike || isAdminLike) &&
      selectedAreaId !== "ALL" &&
      !!activeMeta &&
      !isChecking &&
      !isCreating &&
      (!isAdminLike || !!targetUidReserva);

    if (!isAllowed) return;

    if ((politicas?.bloquearDomingo ?? true) && isSunday(dateStr)) {
      alert("❌ Não é permitido fazer reservas aos domingos.");
      return;
    }

    if (!condId || selectedAreaId === "ALL" || !activeMeta) {
      alert("Selecione uma área e uma opção para reservar.");
      return;
    }
    if (!firestore || !user?.uid) {
      alert("Sessão inválida. Recarregue a página.");
      return;
    }

    setIsChecking(true);
    try {
      // decisão de RESERVA ou FILA agora é feita na API
    } finally {
      setIsChecking(false);
    }

    setIsCreating(true);
    try {
      const resp = await apiPostAuth("/api/reservas/criar", {
          condominioId: condId,
          areaId: selectedAreaId,
          dateStr,
          opcaoId: activeMeta.opcaoId,
          ...(isAdminLike && targetUidReserva ? { targetUid: targetUidReserva } : {}),
        });

        if (resp?.mode === "FILA") {
          alert(
            isAdminLike && targetUidReserva
              ? `✅ Reserva manual enviada para fila de espera (posição ~${resp?.filaCount || "?"}/3).`
              : `✅ Dia ocupado. Você entrou na fila de espera (posição ~${resp?.filaCount || "?"}/3).`
          );
          router.refresh();
        } else {
          alert(
            isAdminLike && targetUidReserva
              ? "✅ Reserva manual criada com sucesso."
              : "✅ Reserva enviada (PENDENTE)."
          );
          router.refresh();
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

      router.refresh();
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

async function handleAssumirOfertaFila(areaId: string) {
  if (!condId || !dateStr) return;

  try {
    await apiPostAuth("/api/reservas/fila-assumir", {
      condominioId: condId,
      areaId,
      dateStr,
    });
    alert("✅ Reserva assumida com sucesso.");
    router.refresh();
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    alert("❌ " + (msg || "Erro ao assumir vaga da fila."));
  }
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

async function confirmarCancelamentoReserva() {
    if (!cancelReservaId || !condId) return;
    try {
      setIsCancellingReserva(true);
      await apiPostAuth("/api/reservas/cancelar", { condominioId: condId, reservaId: cancelReservaId });
      setCancelReservaId(null);
      alert("✅ Reserva cancelada.");
      router.refresh();
    } catch (e: any) {
      alert("❌ " + String(e?.message || e));
    } finally {
      setIsCancellingReserva(false);
    }
  }

  function formatReservaDataHora(dateTs: any) {
  try {
    const d = (dateTs && typeof dateTs.toDate === "function")
      ? dateTs.toDate()
      : null;

    if (!d) return { data: "—", hora: "—" };

    return {
      data: d.toLocaleDateString("pt-BR"),
      hora: d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      }),
    };
  } catch {
    return { data: "—", hora: "—" };
  }
}

return (
    <>
      {showCheckoutModal && selectedReservaForPayment && cobrancasReservas[selectedReservaForPayment.id] && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                💳 Checkout da Reserva
              </h3>
              <button 
                type="button" 
                onClick={() => {
                  setShowCheckoutModal(false);
                  setSelectedReservaForPayment(null);
                }} 
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1.5">
                <div className="text-xs text-white/50 uppercase font-bold tracking-wider">Resumo da Reserva</div>
                <div className="font-bold text-white text-md">
                  {selectedReservaForPayment.opcaoNome || "Área Comum"}
                </div>
                <div className="text-xs text-white/70">
                  Data: {formatReservaDataHora(selectedReservaForPayment.data).data}
                </div>
                <div className="text-xs text-[#D3EA00] font-black text-md pt-1">
                  Taxa: {moneyBRLFromCentavos(selectedReservaForPayment.valorCobrado)}
                </div>
              </div>

              <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPaymentOption("PIX")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                    paymentOption === "PIX" 
                      ? "bg-gradient-to-r from-[primary] to-[#D3EA00] text-slate-900" 
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Pix Instantâneo
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentOption("CARD")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
                    paymentOption === "CARD" 
                      ? "bg-gradient-to-r from-[primary] to-[#D3EA00] text-slate-900" 
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Cartão de Crédito
                </button>
              </div>

              {paymentOption === "PIX" ? (
                <div className="space-y-4 text-center">
                  <div className="bg-white p-3 rounded-2xl w-fit mx-auto border border-white/10 shadow-lg">
                    <div className="h-40 w-40 flex items-center justify-center bg-slate-100 text-slate-900 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold font-mono">PIX SIMULADO</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-white/60">Copie a chave Pix abaixo ou escaneie o código com o app do seu banco para pagar.</p>
                    <input
                      readOnly
                      value={cobrancasReservas[selectedReservaForPayment.id].pixCopiaCola}
                      className="w-full text-xs bg-white/5 border border-white/10 text-white/50 p-2.5 rounded-lg select-all outline-none font-mono truncate text-center"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(cobrancasReservas[selectedReservaForPayment.id].pixCopiaCola);
                        alert("Chave Pix copiada!");
                      }}
                      className="px-4 py-1.5 bg-[primary]/10 text-[primary] border border-[primary]/20 hover:bg-[primary]/20 font-bold rounded-xl text-xs transition"
                    >
                      Copiar Código
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/50">Número do Cartão</label>
                    <input
                      type="text"
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-white/20 rounded-xl outline-none focus:border-[primary] text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-white/50">Nome Impresso</label>
                    <input
                      type="text"
                      placeholder="Nome do Titular"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-white/20 rounded-xl outline-none focus:border-[primary] text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-white/50">Validade</label>
                      <input
                        type="text"
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-white/20 rounded-xl outline-none focus:border-[primary] text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-white/50">CVV</label>
                      <input
                        type="text"
                        placeholder="000"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-white/20 rounded-xl outline-none focus:border-[primary] text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-white/10 bg-slate-950/20 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowCheckoutModal(false);
                  setSelectedReservaForPayment(null);
                }}
                className="px-4 py-2 border border-white/10 hover:bg-white/10 text-white font-bold rounded-xl text-xs transition animate-in fade-in"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePayTaxa}
                disabled
                className="px-4 py-2 bg-gradient-to-r from-[primary] to-[#D3EA00] text-slate-900 font-bold rounded-xl text-xs hover:scale-105 transition shrink-0 animate-in fade-in disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Pagamento eletrônico disponível em breve
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={!!cancelReservaId}
        onOpenChange={(open) => {
          if (!open && !isCancellingReserva) setCancelReservaId(null);
        }}
      >
        <AlertDialogContent className="tc-dialog-center">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar reserva</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta reserva?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancellingReserva}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(ev) => {
                ev.preventDefault();
                confirmarCancelamentoReserva();
              }}
              disabled={isCancellingReserva}
            >
              {isCancellingReserva ? "Cancelando..." : "Confirmar cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppLayout
      pageTitle="Reservas"
        headerActions={
          isMoradorLike ? null : (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/reservas/dashboard">
                  Gerenciar
                </Link>
              </Button>
              <Button asChild variant="default">
                <Link href="/reservas/agenda">
                  <span className="hidden sm:inline">Ver solicitações</span>
                  <span className="sm:hidden">Calendário</span>
                </Link>
              </Button>
            </div>
          )
        }
    >
      {!podeVer ? (
        <div className="rounded-2xl border bg-card p-6">
          <div className="text-sm text-foreground">Carregando sessão/condomínio...</div>
        </div>
      ) : (
        <div className="space-y-6">
          
          
          <div className="rounded-2xl border bg-card p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between shadow-sm">
            <div className="text-sm text-foreground">
              <span className="text-foreground font-medium">
                {selectedAreaId === "ALL"
                  ? "Escolha uma área (lugar) para fazer a sua reserva."
                  : "Selecione a data no calendário para agendar."}
              </span>
            </div>
            <div className="text-xs text-foreground">
              {selectedAreaId === "ALL" ? "Nenhuma área selecionada" : "Área selecionada"}
              {selectedOpcaoMeta ? ` • ${moneyBRLFromCentavos(selectedOpcaoMeta.precoCentavos)}` : ""}
              {dateStr ? ` • ${dateStr}` : ""}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            {isAdminLike ? (
              <div className="mb-4 rounded-xl border bg-card p-4">
                <div className="text-sm font-semibold text-foreground">Reserva manual para morador</div>
                <div className="mt-1 text-xs text-foreground">
                  Selecione abaixo o morador em nome de quem a reserva será criada.
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="blocoFiltroReserva">
                      Filtrar por bloco
                    </label>
                    <select
                      id="blocoFiltroReserva"
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                      value={blocoFiltroReserva}
                      onChange={(e) => setBlocoFiltroReserva(e.target.value)}
                    >
                      <option value="TODOS">Todos os blocos</option>
                      {blocosReservaManual.map((bloco: string) => (
                        <option key={bloco} value={bloco}>
                          {bloco}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground" htmlFor="targetUidReserva">
                      Morador
                    </label>
                    <select
                      id="targetUidReserva"
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                      value={targetUidReserva}
                      onChange={(e) => setTargetUidReserva(e.target.value)}
                    >
                      {moradoresReservaManualFiltrados.length === 0 ? (
                        <option value="">Nenhum morador disponível</option>
                      ) : null}
                      {moradoresReservaManualFiltrados.map((m: any) => {
                        const detalhes = [
                          m.bloco ? "Bloco " + m.bloco : "",
                          m.unidade ? "Unidade " + m.unidade : "",
                          m.status || "",
                        ].filter(Boolean).join(" • ");
                        return (
                          <option key={m.uid} value={m.uid}>
                            {detalhes ? `${m.nome} • ${detalhes}` : m.nome}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            ) : null}

            {loadingAreas ? (
              <div className="mt-4 text-sm text-foreground">Buscando áreas...</div>
            ) : areas.length === 0 ? (
              <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-sm">
                <div className="font-medium">Nenhuma área configurada neste condomínio.</div>
              </div>
            ) : selectedAreaId === "ALL" ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-800">Selecione uma área</div>
                  <div className="text-xs text-foreground">{areas.length} área(s) disponível(is)</div>
                </div>
                
                <AreaInteractiveMap
                  areas={areas}
                  selectedAreaId={selectedAreaId}
                  onSelectArea={handleSelectArea}
                  slotsDoDia={slotsDoDia}
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {areas.map((a: any) => (
                    <AreaCard
                      key={a.id}
                      area={a as any}
                      selected={false}
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
                    />
                  ))}
                </div>
              </div>
            ) : (
              (() => {
                const activeArea = areas.find((a: any) => String(a.id) === String(selectedAreaId)) ?? null;
                if (!activeArea) {
                  return (
                    <div className="p-6 text-center text-sm text-foreground">
                      Área não encontrada. <Button onClick={handleSelectAll}>Voltar</Button>
                    </div>
                  );
                }

                const areaOptionItems = getAreaOptionItems(activeArea);
                const hasOptions = Array.isArray(areaOptionItems) && areaOptionItems.length > 1;

                const reservasDaArea = (reservas || []).filter((r: any) => String(r.areaId) === String(activeArea.id));
                const filaDaArea = Array.isArray(filaByArea[String(activeArea.id)])
                  ? filaByArea[String(activeArea.id)]
                  : [];

                const filaUI = (
                  <div className="mt-4 rounded-xl border border-[#FFDE21]/40 bg-[#FFDE21]/10 p-4 shadow-sm text-left">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-[#8A6A00]">Fila de espera desta área</div>
                      <div className="text-xs text-[#8A6A00]">{filaDaArea.length} pessoa(s)</div>
                    </div>
                    {filaDaArea.length === 0 ? (
                      <div className="mt-3 rounded-xl border bg-card p-3 text-sm text-[#8A6A00]">
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
                          const statusFila = String(f.status || "AGUARDANDO");
                          const souEuNaOferta = souEuNaFila && statusFila === "OFERTADA";

                          return (
                            <div key={f.id || f.uid || idx} className="rounded-xl border border-[#FFDE21]/40 bg-card p-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-[#8A6A00]">#{idx + 1} • {nomeFila}</div>
                                  <div className="text-xs text-[#8A6A00]">
                                    Status: {statusFila}
                                    {blocoFila || unidadeFila ? ` • Bloco ${blocoFila || ""} Unidade ${unidadeFila || ""}` : ""}
                                  </div>
                                  <div className="text-xs text-[#8A6A00]">
                                    Valor: {moneyBRLFromCentavos(f.valorCobrado)}
                                    {f?.opcaoNome ? ` • Opção: ${f.opcaoNome}` : ""}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {souEuNaOferta && (
                                    <Button type="button" size="sm" onClick={() => handleAssumirOfertaFila(String(activeArea.id))}>
                                      Assumir reserva
                                    </Button>
                                  )}
                                  {souEuNaFila && (
                                    <Button type="button" variant="destructive" size="sm" onClick={() => handleCancelarFila(String(activeArea.id))}>
                                      Desistir da fila
                                    </Button>
                                  )}
                                  {isAdminLike && (
                                    <Button type="button" variant="outline" size="sm" onClick={() => handleCancelarFila(String(activeArea.id), String(f.uid))}>
                                      Remover da fila
                                    </Button>
                                  )}
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
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        onClick={handleSelectAll}
                        className="flex items-center gap-2 rounded-xl text-slate-800 border-black/10 bg-white hover:bg-black/5"
                      >
                        <ArrowLeft className="h-4 w-4" /> Voltar para todas as áreas
                      </Button>
                      <div className="text-sm font-medium text-slate-600">
                        Área selecionada: <span className="font-bold text-slate-900">{activeArea.nome}</span>
                      </div>
                    </div>

                    <AreaCard
                      area={activeArea}
                      selected={true}
                      onSelect={() => {}}
                      availability={(() => {
                        const slotDaArea = slotsDoDia[String(activeArea.id)] || { occupied: false, filaCount: 0 };
                        const filaCountDaArea = Number(slotDaArea.filaCount || 0) || 0;
                        const occupiedDaArea = Boolean(slotDaArea.occupied === true);
                        return filaCountDaArea >= 3
                          ? "unavailable"
                          : (occupiedDaArea || filaCountDaArea > 0)
                            ? "queued"
                            : "available";
                      })()}
                      availabilityLabel={(() => {
                        const slotDaArea = slotsDoDia[String(activeArea.id)] || { occupied: false, filaCount: 0 };
                        const filaCountDaArea = Number(slotDaArea.filaCount || 0) || 0;
                        const occupiedDaArea = Boolean(slotDaArea.occupied === true);
                        return filaCountDaArea >= 3
                          ? "Indisponível"
                          : (occupiedDaArea || filaCountDaArea > 0)
                            ? "Em fila / ocupada"
                            : "Disponível";
                      })()}
                    >
                      {hasOptions && (
                        <div className="mb-4 rounded-xl border bg-card p-3 text-left">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                            Opções desta reserva
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            {areaOptionItems.map((opt: any) => {
                              const active = String(selectedOpcaoId || "") === String(opt.opcaoId);

                              return (
                                <Button
                                  key={opt.opcaoId}
                                  type="button"
                                  variant={active ? "default" : "outline"}
                                  size="sm"
                                  className="w-full justify-start whitespace-normal rounded-full px-4 py-3 text-left sm:w-auto sm:justify-center sm:whitespace-nowrap sm:py-2"
                                  onClick={(ev) => {
                                    ev.preventDefault();
                                    ev.stopPropagation();
                                    setSelectedOpcaoId(String(opt.opcaoId));
                                    setSelectedOpcaoMeta({
                                      opcaoId: String(opt.opcaoId),
                                      opcaoNome: String(opt.opcaoNome),
                                      precoCentavos: Number(opt.precoCentavos || 0),
                                      bloqueiaAreaId: opt.bloqueiaAreaId ?? null,
                                    });
                                  }}
                                >
                                  {opt.opcaoNome} • {moneyBRLFromCentavos(opt.precoCentavos)}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="mt-2 text-left">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                          Escolha a data no calendário
                        </div>
                        <CalendarMonth
                          firestore={firestore as any}
                          condominioId={condId}
                          areaId={String(activeArea.id)}
                          selectedDateStr={dateStr}
                          bloquearDomingo={Boolean(politicas?.bloquearDomingo ?? true)}
                          onSelectDateStr={(iso: string) => {
                            setDateStr(iso);
                            if (isMoradorLike || isAdminLike) {
                              if (isAdminLike && !targetUidReserva) {
                                alert("Selecione um morador antes de marcar a reserva.");
                                return;
                              }
                              setDialogArea(activeArea);
                              setOpenOpcoesDialog(true);
                            }
                          }}
                        />
                      </div>

                      <div className="mt-4 rounded-xl border bg-white/55 p-4 shadow-sm text-left">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-foreground">Reservas desta área no dia</div>
                          <div className="text-xs text-foreground">
                            {loadingReservas ? "Carregando..." : `${reservasDaArea.length} reserva(s)`}
                          </div>
                        </div>
                        {loadingReservas ? (
                          <div className="mt-3 text-sm text-foreground">Buscando reservas...</div>
                        ) : reservasDaArea.length === 0 ? (
                          <div className="mt-3 rounded-xl border bg-muted/20 p-3 text-sm text-foreground">
                            Nenhuma reserva para esta área neste dia.
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {reservasDaArea.map((r: any) => {
                              const mf = membrosByUid[r.uid] || null;
                              const nomeReserva = mf?.nome || mf?.displayName || mf?.name || r.uid || "Morador";
                              const blocoReserva = mf?.blocoId || mf?.bloco || mf?.blocoNome || "";
                              const unidadeReserva = mf?.unidadeId || mf?.unidade || mf?.unidadeNome || mf?.apto || "";
                              const statusReserva = String(r.status || "PENDENTE");
                              const isAprovada = statusReserva === "APROVADA";
                              const dataHoraReserva = formatReservaDataHora(r.data);
                              const isPaga = String(r.pago) === "true";
                              const cobranca = cobrancasReservas[r.id] || null;
                              const temCobrancaPendente = !!cobranca && cobranca.status === "pendente";

                              return (
                                <div key={r.id} className="rounded-xl border bg-card p-3 text-foreground shadow-sm">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-foreground">{nomeReserva}</div>
                                      <div className="text-xs text-slate-500">
                                        Status: {statusReserva}
                                        {blocoReserva || unidadeReserva ? ` • Bloco ${blocoReserva || ""} Unidade ${unidadeReserva || ""}` : ""}
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        Horário: {dataHoraReserva.hora} • Opção: {r.opcaoNome || "Padrão"}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {meuUid && r.uid === meuUid && (
                                        <>
                                          {temCobrancaPendente && !isPaga && (
                                            <Button
                                              type="button"
                                              size="sm"
                                              disabled
                                              title="Pagamento eletrônico disponível em breve"
                                              onClick={() => {
                                                setSelectedReservaForPayment(r);
                                                setShowCheckoutModal(true);
                                              }}
                                            >
                                              Pagamento eletrônico disponível em breve
                                            </Button>
                                          )}
                                          <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            disabled={!canCancelBy48h(r.data, 48)}
                                            onClick={() => setCancelReservaId(r.id)}
                                            title={!canCancelBy48h(r.data, 48) ? "Só é possível cancelar até 48h antes." : "Cancelar reserva"}
                                          >
                                            Cancelar reserva
                                          </Button>
                                          <Button asChild variant="outline" size="sm">
                                            <Link href={`/reservas/convidados/${r.id}`}>Convidados</Link>
                                          </Button>
                                        </>
                                      )}
                                      {isAdminLike && (
                                        <>
                                          <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => setCancelReservaId(r.id)}
                                          >
                                            Excluir reserva
                                          </Button>
                                          <Button asChild variant="outline" size="sm">
                                            <Link href={`/reservas/convidados/${r.id}`}>Convidados</Link>
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {filaUI}
                    </AreaCard>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* ── R5: Reservation Summary + Confirm Button ── */}
      {podeReservar && selectedOpcaoMeta && dateStr && selectedAreaId !== "ALL" && (
        <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-bold">Resumo da Reserva</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Área</span><span className="font-medium">{selectedAreaId}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Opção</span><span className="font-medium">{selectedOpcaoMeta.opcaoNome}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span className="font-medium">{dateStr}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-bold">{moneyBRLFromCentavos(selectedOpcaoMeta.precoCentavos)}</span></div>
            </div>
          </div>
          <Button
            className="w-full rounded-xl py-6 text-base font-bold"
            disabled={isCreating || isChecking}
            onClick={() => handleSolicitarReserva()}
          >
            {isCreating ? "Confirmando..." : isChecking ? "Verificando..." : "Confirmar Reserva"}
          </Button>
        </div>
      )}

      {dialogArea && (
        <AreaOpcaoDialog
          open={openOpcoesDialog}
          onOpenChange={setOpenOpcoesDialog}
          areaNome={dialogArea.nome}
          precoBaseCentavos={dialogArea.preco}
          opcoes={dialogArea.opcoes || []}
          selectedOpcaoId={selectedOpcaoId}
          onConfirm={(payload) => {
            setSelectedOpcaoId(payload.opcaoId);
            const meta = {
              opcaoId: payload.opcaoId,
              opcaoNome: payload.opcaoNome,
              precoCentavos: payload.precoCentavos,
              bloqueiaAreaId: payload.bloqueiaAreaId ?? null,
            };
            setSelectedOpcaoMeta(meta);
            // R5: do not auto-submit — wait for explicit Confirm button
          }}
        />
      )}
    </AppLayout>
    </>
  );
}
