"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

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

type Convidado = {
  id: string;
  nome?: string;
  cpf?: string | null;
  status?: "PENDENTE" | "ENTROU";
  entradaEm?: any;
  porteiroUid?: string | null;
  createdAt?: any;
};

type ReservaDoc = {
  uid?: string;
  userId?: string;
  status?: string;
  areaId?: string;
  areaNome?: string;
  areaName?: string;
  data?: any;
  valorCobrado?: number;
};

function maskCpf(v?: string | null) {
  const d = (v || "").replace(/\D/g, "");
  if (!d) return "";
  // mostra só final (opcional)
  return "•••.•••.•••-" + d.slice(-2);
}

export default function ConvidadosCheckinPage() {
  const params = useParams<{ reservaId: string }>();
  const reservaId = params?.reservaId ?? "";
  const router = useRouter();
  const firestore = useFirestore();
  const { session, isSessionLoading } = useSessionCtx();

  const condId = session?.activeCondominioId ?? null;
  const role: string | null = (session as any)?.role ?? null;

    const isSuper =
      Boolean((session as any)?.superAdmin) ||
      Boolean((session as any)?.isSuperAdmin) ||
      Boolean((session as any)?.super_admin) ||
      String((session as any)?.role || session?.role || "").toUpperCase() === "SUPER_ADMIN";

  const isPorteiro = role === "PORTEIRO";
  const isAdminLike =
      isSuper ||
      role === "ADMIN" ||
      role === "SINDICO" ||
      role === "ADMIN_CONDOMINIO" ||
      role === "ZELADOR";

  const canUse = !!session && !!condId && (isPorteiro || isAdminLike);

  const [loadingReserva, setLoadingReserva] = React.useState(true);
  const [reserva, setReserva] = React.useState<ReservaDoc | null>(null);

  const [moradorInfo, setMoradorInfo] = React.useState<any | null>(null);
  const [loadingLista, setLoadingLista] = React.useState(true);
  const [itens, setItens] = React.useState<Convidado[]>([]);
  const [loadingMarkId, setLoadingMarkId] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmItem, setConfirmItem] = React.useState<Convidado | null>(null);

  const filtrados = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return itens;
    return (itens || []).filter((c) =>
      String(c.nome || "").toLowerCase().includes(term)
    );
  }, [itens, q]);

  const [savingId, setSavingId] = React.useState<string | null>(null);

  // carrega a reserva (pra validar status APROVADA)
  React.useEffect(() => {
    if (!firestore || !condId || !reservaId) return;

    let alive = true;
    (async () => {
      try {
        const ref = doc(
          firestore,
          "condominios",
          String(condId),
          "reservas",
          String(reservaId)
        );
        const snap = await getDoc(ref);
        if (!alive) return;

        setReserva(snap.exists() ? (snap.data() as any) : null);
      } catch (e) {
        console.error("[checkin] erro ao carregar reserva:", e);
        setReserva(null);
      } finally {
        if (alive) setLoadingReserva(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [firestore, condId, reservaId]);

  // Carrega o membro (nome/bloco/unidade) do morador dono da reserva
  React.useEffect(() => {
    if (!firestore) return;
    if (!session?.activeCondominioId) return;
    const uid = String(
      (reserva as any)?.uid || (reserva as any)?.userId || ""
    );
    if (!uid) {
      setMoradorInfo(null);
      return;
    }

    let alive = true;

    (async () => {
      try {
        const ref = doc(
          firestore,
          "condominios",
          String(session.activeCondominioId),
          "membros",
          uid
        );
        const snap = await getDoc(ref);
        if (!alive) return;
        setMoradorInfo(snap.exists() ? snap.data() : null);
      } catch (e) {
        console.error("[checkin] erro ao carregar membro do morador:", e);
        if (alive) setMoradorInfo(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    firestore,
    session?.activeCondominioId,
    (reserva as any)?.uid,
    (reserva as any)?.userId,
  ]);

  // lista convidados
  React.useEffect(() => {
    if (!firestore || !condId || !reservaId) return;

    const ref = collection(
      firestore,
      "condominios",
      String(condId),
      "reservas",
      String(reservaId),
      "convidados"
    );

    const qq = query(ref, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      qq,
      (snap) => {
        const out: Convidado[] = [];
        snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
        setItens(out);
        setLoadingLista(false);
      },
      (err) => {
        console.error("[checkin] snapshot convidados erro:", err);
        setItens([]);
        setLoadingLista(false);
      }
    );

    return () => unsub();
  }, [firestore, condId, reservaId]);

  if (isSessionLoading) {
    return (
      <AppLayout pageTitle="Check-in de Convidados">
        Carregando sessão...
      </AppLayout>
    );
  }

  if (!session) {
    return (
      <AppLayout pageTitle="Check-in de Convidados">Sem sessão.</AppLayout>
    );
  }

  if (!canUse) {
    return (
      <AppLayout pageTitle="Check-in de Convidados">Acesso negado.</AppLayout>
    );
  }

  if (loadingReserva) {
    return (
      <AppLayout pageTitle="Check-in de Convidados">
        Carregando reserva...
      </AppLayout>
    );
  }

  if (!reserva) {
    return (
      <AppLayout pageTitle="Check-in de Convidados">
        Reserva não encontrada.
      </AppLayout>
    );
  }

  const statusReserva = String(reserva.status || "");
  if (isPorteiro && statusReserva !== "APROVADA") {
    return (
      <AppLayout pageTitle="Check-in de Convidados">
        Esta reserva não está APROVADA. O porteiro só faz check-in em reservas
        aprovadas.
      </AppLayout>
    );
  }

  const areaLabel =
    reserva.areaNome || reserva.areaName || reserva.areaId || "Área";

  const total = itens.length;
  const entrou = itens.filter(
    (c) => String(c.status || "") === "ENTROU"
  ).length;
  const pendente = total - entrou;

  async function marcarEntrou(item: Convidado) {
    if (!firestore || !condId || !reservaId || !item) return;
    if (!isPorteiro && !isAdminLike) return;

    setSavingId(item.id);
    try {
      const ref = doc(
        firestore,
        "condominios",
        String(condId),
        "reservas",
        String(reservaId),
        "convidados",
        String(item.id)
      );

      await updateDoc(ref, {
        status: "ENTROU",
        entradaEm: serverTimestamp(),
        porteiroUid: session?.user?.uid ?? null,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("[checkin] erro marcar entrou:", e);
      alert(
        "❌ Não consegui marcar entrada. Veja o console (provável rules)."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function baixarPDF() {
      const pdf = new jsPDF();

      const moradorNome =
        moradorInfo?.nome ||
        moradorInfo?.displayName ||
        moradorInfo?.name ||
        "Morador";

      const moradorBloco =
        moradorInfo?.blocoId ||
        moradorInfo?.bloco ||
        moradorInfo?.blocoNome ||
        moradorInfo?.blocoName ||
        moradorInfo?.blocoLabel ||
        "";

      const moradorUnidade =
        moradorInfo?.unidadeId ||
        moradorInfo?.unidade ||
        moradorInfo?.unidadeNome ||
        moradorInfo?.unidadeLabel ||
        moradorInfo?.apto ||
        "";

      // título
      pdf.setFontSize(14);
      pdf.text("Lista de Convidados (Check-in)", 14, 16);

      // QR Code (canto superior direito)
      const url =
        typeof window !== "undefined"
          ? window.location.href
          : `/reservas/convidados-checkin/${String(reservaId)}`;

      try {
        const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 160 });
        pdf.addImage(qrDataUrl, "PNG", 160, 8, 40, 40);
        pdf.setFontSize(8);
        pdf.text("QR do Check-in", 162, 50);
      } catch (e) {
        console.warn("[pdf] falha ao gerar QR:", e);
      }

      // infos
      pdf.setFontSize(10);
      pdf.text(`Área: ${areaLabel}`, 14, 26);
      pdf.text(`Status da Reserva: ${statusReserva}`, 14, 32);

      // morador (NUNCA mostrar uid aqui)
      pdf.text(`Morador: ${moradorNome}`, 14, 38);

      const extra = [
        moradorBloco ? `Bloco ${moradorBloco}` : null,
        moradorUnidade ? `Unidade/Apto ${moradorUnidade}` : null,
      ].filter(Boolean).join(" • ");

      if (extra) {
        pdf.text(extra, 14, 44);
      }

      const body = filtrados.map((c, idx) => ([
        String(idx + 1).padStart(2, "0"),
        String(c.nome || "-"),
        String(c.cpf ? maskCpf(c.cpf) : "-"),
        String(c.status || "PENDENTE"),
      ]));

      autoTable(pdf, {
        startY: extra ? 52 : 48,
        head: [["Nº", "Nome", "CPF", "Status"]],
        body,
        styles: { fontSize: 9 },
        headStyles: { fontSize: 9 },
      });

      pdf.save(`convidados_${String(reservaId)}.pdf`);
    }

  return (
    <AppLayout
      pageTitle="Check-in de Convidados"
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/reservas/agenda">Voltar</Link>
          </Button>

          <Button onClick={baixarPDF}>
            Baixar PDF
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Área</div>
              <div className="text-lg font-semibold">{areaLabel}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                <div className="mt-1 text-sm text-muted-foreground">
                  Morador:{" "}
                  <span className="font-medium">
                    {moradorInfo?.nome ||
                      moradorInfo?.displayName ||
                      moradorInfo?.name || "-"}
                  </span>
                  {moradorInfo?.blocoId ||
                  moradorInfo?.bloco ||
                  moradorInfo?.blocoNome ||
                  moradorInfo?.blocoName ||
                  moradorInfo?.blocoLabel ? (
                    <span className="text-muted-foreground">
                      {" "}
                      • Bloco{" "}
                      {moradorInfo?.blocoId ||
                        moradorInfo?.bloco ||
                        moradorInfo?.blocoNome ||
                        moradorInfo?.blocoName ||
                        moradorInfo?.blocoLabel}
                    </span>
                  ) : null}
                  {moradorInfo?.unidadeId ||
                  moradorInfo?.unidade ||
                  moradorInfo?.unidadeNome ||
                  moradorInfo?.unidadeLabel ||
                  moradorInfo?.apto ? (
                    <span className="text-muted-foreground">
                      {" "}
                      • Unidade/Apto{" "}
                      {moradorInfo?.unidadeId ||
                        moradorInfo?.unidade ||
                        moradorInfo?.unidadeNome ||
                        moradorInfo?.unidadeLabel ||
                        moradorInfo?.apto}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="text-lg font-semibold">{statusReserva}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl border bg-muted/10 p-3">
              <div className="text-muted-foreground">Total</div>
              <div className="text-lg font-semibold">{total}</div>
            </div>
            <div className="rounded-xl border bg-muted/10 p-3">
              <div className="text-muted-foreground">Pendentes</div>
              <div className="text-lg font-semibold">{pendente}</div>
            </div>
            <div className="rounded-xl border bg-muted/10 p-3">
              <div className="text-muted-foreground">Entraram</div>
              <div className="text-lg font-semibold">{entrou}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="font-semibold">Lista</div>
            <input
              className="h-10 w-full md:w-[360px] rounded-xl border bg-background px-3 text-sm"
              placeholder="Buscar por nome..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {loadingLista ? (
            <div className="mt-4 text-sm text-muted-foreground">
              Carregando convidados...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              Nenhum convidado encontrado.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {filtrados.map((c, idx) => {
                const st = String(c.status || "PENDENTE");
                const entrou = st === "ENTROU";

                return (
                  <div
                    key={c.id}
                    className="rounded-xl border p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {String(idx + 1).padStart(2, "0")} - {c.nome || "-"}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {c.cpf
                          ? `CPF: ${maskCpf(c.cpf)}`
                          : "CPF: (não informado)"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold">
                        {entrou ? "✅ ENTROU" : "🟢 PENDENTE"}
                      </div>

                      <Button
                        onClick={() => {
                          setConfirmItem(c);
                          setConfirmOpen(true);
                        }}
                        disabled={entrou || savingId === c.id}
                      >
                        {savingId === c.id
                          ? "Salvando..."
                          : entrou
                          ? "OK"
                          : "Marcar entrou"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Entrada</AlertDialogTitle>
            <AlertDialogDescription>
              Você confirma a entrada do convidado{" "}
              <strong>{confirmItem?.nome ?? "..."}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmItem) {
                  await marcarEntrou(confirmItem);
                }
              }}
              disabled={savingId !== null}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
