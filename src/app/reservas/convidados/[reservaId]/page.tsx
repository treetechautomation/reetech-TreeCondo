"use client";

import * as React from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  addDoc,
  deleteDoc,
} from "firebase/firestore";

type Convidado = {
  id: string;
  nome?: string;
  cpf?: string | null;
};

type ReservaDoc = {
  uid?: string;
  status?: string;
};

function maskCpf(v?: string | null) {
  const d = (v || "").replace(/\\D/g, "");
  if (!d) return "";
  return "•••.•••.•••-" + d.slice(-2);
}

export default function ConvidadosPage() {
  const params = useParams<{ reservaId: string }>();
  const reservaId = params?.reservaId ?? "";
  const router = useRouter();
  const firestore = useFirestore();
  const { session, isSessionLoading } = useSessionCtx();

  const condId = session?.activeCondominioId ?? null;
  const myUid = String(session?.user?.uid ?? "");

  const [loadingReserva, setLoadingReserva] = React.useState(true);
  const [reserva, setReserva] = React.useState<ReservaDoc | null>(null);

  const isOwner =
    reserva &&
    String(
      (reserva as any)?.uid ||
        (reserva as any)?.userId ||
        (reserva as any)?.moradorUid ||
        (reserva as any)?.createdByUid ||
        (reserva as any)?.createdBy?.uid ||
        ""
    ) === myUid;

  const [itens, setItens] = React.useState<Convidado[]>([]);
  const [loadingLista, setLoadingLista] = React.useState(true);
  const [q, setQ] = React.useState("");

  const [novoNome, setNovoNome] = React.useState("");
  const [novoCpf, setNovoCpf] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const filtrados = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return itens;
    return (itens || []).filter((c) =>
      String(c.nome || "").toLowerCase().includes(term)
    );
  }, [itens, q]);

  // carrega a reserva (pra validar dono)
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
        console.error("[convidados] erro ao carregar reserva:", e);
        setReserva(null);
      } finally {
        if (alive) setLoadingReserva(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [firestore, condId, reservaId]);

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
        console.error("[convidados] snapshot erro:", err);
        setItens([]);
        setLoadingLista(false);
      }
    );

    return () => unsub();
  }, [firestore, condId, reservaId]);

  async function handleAddConvidado() {
    if (!firestore || !condId || !reservaId) return;

    const nome = novoNome.trim();
    if (!nome) return;

    setSaving(true);
    try {
      await addDoc(
        collection(
          firestore,
          "condominios",
          condId,
          "reservas",
          reservaId,
          "convidados"
        ),
        {
          nome,
          cpf: novoCpf.trim() || null,
          status: "PENDENTE",
          createdAt: serverTimestamp(),
          createdByUid: myUid,
        }
      );
      setNovoNome("");
      setNovoCpf("");
    } catch (e) {
      console.error("[convidados] erro add:", e);
      alert("Não consegui adicionar. Veja o console.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Convidado) {
    if (!firestore || !condId || !reservaId || !item.id) {
      alert("Erro: Informações da reserva ou do convidado estão faltando.");
      return;
    }
    
    if (!window.confirm(`Tem certeza que deseja remover o convidado "${item.nome ?? item.id}"?`)) {
      return;
    }

    try {
      await deleteDoc(
        doc(
          firestore,
          "condominios",
          String(condId),
          "reservas",
          String(reservaId),
          "convidados",
          String(item.id)
        )
      );
    } catch (e: any) {
      console.error("[convidados] erro remove:", e);
      alert(`Não consegui remover. Erro: ${e.code} - ${e.message}`);
    }
  }

  if (isSessionLoading) {
    return (
      <AppLayout pageTitle="Lista de Convidados">Carregando sessão...</AppLayout>
    );
  }

  if (!isOwner) {
    return <AppLayout pageTitle="Lista de Convidados">Acesso negado.</AppLayout>;
  }

  if (loadingReserva) {
    return (
      <AppLayout pageTitle="Lista de Convidados">
        Carregando reserva...
      </AppLayout>
    );
  }

  if (!reserva) {
    return (
      <AppLayout pageTitle="Lista de Convidados">
        Reserva não encontrada.
      </AppLayout>
    );
  }

  const podeGerenciar = String(reserva.status) !== "CONCLUIDA" && String(reserva.status) !== "CANCELADA";

  return (
    <AppLayout pageTitle="Lista de Convidados">
      <div className="space-y-4">
        <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-4 shadow-sm">
          <div className="font-semibold">Adicionar à lista</div>
          <div className="text-xs text-muted-foreground">
            A lista é usada pela portaria para o check-in no dia.
          </div>

          <div className="mt-3 flex flex-col md:flex-row gap-2">
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nome completo do convidado"
              disabled={!podeGerenciar}
            />
            <Input
              value={novoCpf}
              onChange={(e) => setNovoCpf(e.target.value)}
              placeholder="CPF (opcional)"
              disabled={!podeGerenciar}
            />
            <Button onClick={handleAddConvidado} disabled={saving || !podeGerenciar}>
              {saving ? "..." : "Adicionar"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="font-semibold">Convidados</div>
            <Input
              className="h-9 w-full md:w-[280px]"
              placeholder="Buscar por nome..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {loadingLista ? (
            <div className="mt-4 text-sm text-muted-foreground">
              Carregando lista...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              Nenhum convidado adicionado.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {filtrados.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.nome || "-"}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.cpf ? `CPF: ${maskCpf(c.cpf)}` : "CPF: (não informado)"}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => remove(c)}
                    disabled={!podeGerenciar}
                  >
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
