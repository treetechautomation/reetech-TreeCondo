"use client";

import * as React from "react";
import {
  PlusCircle,
  QrCode,
  PackageCheck,
  Clock,
  History,
  KeyRound,
  RefreshCcw,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore, initializeFirebase } from "@/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

type EncomendaDoc = {
  id: string;
  status?: "AGUARDANDO" | "RETIRADA";
  unidadeId?: string;
  blocoId?: string | null;
  transportadora?: string;
  observacao?: string | null;

  moradorUid?: string | null;

  codigo?: string; // QR texto (mostra no app)
  chegouEm?: any;
  retiradaEm?: any;

  criadoPorUid?: string;
  retiradaPorUid?: string;
};

function fmtTS(v: any) {
  try {
    if (!v) return "-";
    // Timestamp do firestore
    if (v instanceof Timestamp) return v.toDate().toLocaleString("pt-BR");
    // serverTimestamp vindo como objeto
    if (typeof v?.toDate === "function") return v.toDate().toLocaleString("pt-BR");
    // string/date
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toLocaleString("pt-BR");
    return "-";
  } catch {
    return "-";
  }
}

async function getIdTokenSafe() {
  const { auth } = initializeFirebase() as any;
  const u = auth?.currentUser;
  if (!u) throw new Error("Sem usuário autenticado.");
  return await u.getIdToken();
}

async function apiPost(path: string, body: any) {
  const token = await getIdTokenSafe();
  const r = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data?.error || `Erro ${r.status} ${r.statusText}`);
  }
  return data;
}

export default function EncomendasPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const firestore = useFirestore();

  const condId = session?.activeCondominioId ?? null;
  const role: string | null = (session as any)?.role ?? null;

  const podeVer = !isSessionLoading && !!session && !!condId;

  // MVP: quem pode operar (registrar/retirar)
  const isOperador =
    role === "PORTEIRO" ||
    role === "ZELADOR" ||
    role === "SINDICO" ||
    role === "ADMIN" ||
    role === "ADMIN_CONDOMINIO" ||
    Boolean((session as any)?.superAdmin) ||
    Boolean((session as any)?.super_admin);

  const [waiting, setWaiting] = React.useState<EncomendaDoc[]>([]);
  const [history, setHistory] = React.useState<EncomendaDoc[]>([]);
  const [loading, setLoading] = React.useState(true);

  // form registrar
  const [openCreate, setOpenCreate] = React.useState(false);
  const [unidadeId, setUnidadeId] = React.useState("");
  const [blocoId, setBlocoId] = React.useState("");
  const [transportadora, setTransportadora] = React.useState("");
  const [observacao, setObservacao] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [savingCreate, setSavingCreate] = React.useState(false);

  // retorno do create
  const [lastCreated, setLastCreated] = React.useState<{ codigo?: string; pin?: string } | null>(null);

  // dialog retirar
  const [openRetirar, setOpenRetirar] = React.useState(false);
  const [retirarEncomendaId, setRetirarEncomendaId] = React.useState<string>("");
  const [codigoInput, setCodigoInput] = React.useState("");
  const [pinInput, setPinInput] = React.useState("");
  const [savingRetirar, setSavingRetirar] = React.useState(false);

  // listener firestore
  React.useEffect(() => {
    if (!firestore || !condId || !podeVer) return;

    setLoading(true);

    const base = collection(firestore, "condominios", String(condId), "encomendas");

    // MODIFICAÇÃO: Removido orderBy para evitar índice composto. Ordenação será feita no cliente.
    const qWaiting = query(base, where("status", "==", "AGUARDANDO"));
    const qHistory = query(base, where("status", "==", "RETIRADA"));

    const unsub1 = onSnapshot(
      qWaiting,
      (snap) => {
        const out: EncomendaDoc[] = [];
        snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
        
        // Ordena no cliente
        out.sort((a, b) => {
            const timeA = a.chegouEm?.toMillis?.() ?? 0;
            const timeB = b.chegouEm?.toMillis?.() ?? 0;
            return timeB - timeA;
        });

        setWaiting(out);
        setLoading(false);
      },
      (err) => {
        console.error("[DIAGNÓSTICO] Erro ao carregar encomendas 'AGUARDANDO':", err);
        alert(`Erro ao carregar encomendas 'AGUARDANDO':\n${err.message}`);
        setWaiting([]);
        setLoading(false);
      }
    );

    const unsub2 = onSnapshot(
      qHistory,
      (snap) => {
        const out: EncomendaDoc[] = [];
        snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));

        // Ordena no cliente
        out.sort((a, b) => {
            const timeA = a.retiradaEm?.toMillis?.() ?? 0;
            const timeB = b.retiradaEm?.toMillis?.() ?? 0;
            return timeB - timeA;
        });

        setHistory(out);
      },
      (err) => {
        console.error("[DIAGNÓSTICO] Erro ao carregar encomendas 'RETIRADA':", err);
        alert(`Erro ao carregar histórico de encomendas:\n${err.message}`);
        setHistory([]);
      }
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [firestore, condId, podeVer]);

  async function handleCreate() {
    if (!condId) return;
    if (!unidadeId.trim()) return alert("Informe a unidade.");
    if (!transportadora.trim()) return alert("Informe a transportadora.");

    setSavingCreate(true);
    const payload = {
        condominioId: String(condId),
        unidadeId: unidadeId.trim(),
        blocoId: blocoId.trim() ? blocoId.trim() : null,
        transportadora: transportadora.trim(),
        observacao: observacao.trim() ? observacao.trim() : null,
        pin: pin.trim() ? pin.trim() : undefined,
      };

    console.log("[DIAGNÓSTICO] Enviando para /api/encomendas/create:", payload);

    try {
      const resp = await apiPost("/api/encomendas/create", payload);
      console.log("[DIAGNÓSTICO] API create respondeu:", resp);

      setLastCreated({ codigo: resp?.codigo, pin: resp?.pin });

      // limpa form (mantém o modal aberto pra mostrar código/pin)
      setUnidadeId("");
      setBlocoId("");
      setTransportadora("");
      setObservacao("");
      setPin("");

    } catch (e: any) {
      console.error("[DIAGNÓSTICO] Erro ao chamar API de criar encomenda:", e);
      alert(`Ocorreu um erro ao registrar a encomenda:\n\n${e?.message || "Verifique o console para mais detalhes."}\n\nStack: ${e?.stack ?? 'N/A'}`);
    } finally {
      setSavingCreate(false);
    }
  }

  function openRetirada(encomendaId: string) {
    setRetirarEncomendaId(encomendaId);
    setCodigoInput("");
    setPinInput("");
    setOpenRetirar(true);
  }

  async function handleRetirar() {
    if (!condId) return;
    if (!retirarEncomendaId) return;
    if (!codigoInput.trim() && !pinInput.trim()) return alert("Informe o código (PKG-...) ou o PIN.");

    setSavingRetirar(true);
    try {
      await apiPost("/api/encomendas/retirar", {
        condominioId: String(condId),
        encomendaId: retirarEncomendaId,
        codigo: codigoInput.trim() ? codigoInput.trim() : undefined,
        pin: pinInput.trim() ? pinInput.trim() : undefined,
      });

      alert("✅ Retirada registrada!");
      setOpenRetirar(false);
    } catch (e: any) {
      console.error("[encomendas] erro retirar:", e);
      alert(e?.message || "Erro ao registrar retirada.");
    } finally {
      setSavingRetirar(false);
    }
  }

  const HeaderActions = () => (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          // força re-render/listeners já fazem, mas deixa UX ok
          alert("✅ Atualiza em tempo real. Se algo travou, recarregue a página.");
        }}
      >
        <RefreshCcw className="mr-2 h-4 w-4" />
        Atualizar
      </Button>

      <Dialog open={openCreate} onOpenChange={(v) => {
        setOpenCreate(v);
        if (!v) setLastCreated(null);
      }}>
        <DialogTrigger asChild>
          <Button size="sm" disabled={!isOperador}>
            <PlusCircle className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline-block">Registrar Encomenda</span>
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Registrar Nova Encomenda</DialogTitle>
            <DialogDescription>
              Insira os dados da encomenda. O morador receberá um aviso no app (notificação interna).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unidadeId" className="text-right">Unidade</Label>
              <Input
                id="unidadeId"
                placeholder="Ex: 101"
                className="col-span-3"
                value={unidadeId}
                onChange={(e) => setUnidadeId(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="blocoId" className="text-right">Bloco</Label>
              <Input
                id="blocoId"
                placeholder="Opcional (Ex: A)"
                className="col-span-3"
                value={blocoId}
                onChange={(e) => setBlocoId(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="transportadora" className="text-right">Transportadora</Label>
              <Input
                id="transportadora"
                placeholder="Ex: Correios, Mercado Livre"
                className="col-span-3"
                value={transportadora}
                onChange={(e) => setTransportadora(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="observacao" className="text-right">Obs</Label>
              <Input
                id="observacao"
                placeholder="Opcional"
                className="col-span-3"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pin" className="text-right">PIN</Label>
              <Input
                id="pin"
                placeholder="Opcional (fallback). Se vazio, usa últimos 4 dígitos da unidade."
                className="col-span-3"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </div>

            {lastCreated?.codigo ? (
              <div className="rounded-xl border bg-white/60 p-4 text-sm">
                <div className="font-semibold mb-2">✅ Encomenda registrada!</div>
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  <span>Código (QR texto):</span>
                  <code className="font-mono font-semibold">{lastCreated.codigo}</code>
                </div>
                {lastCreated?.pin ? (
                  <div className="mt-2 flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    <span>PIN (fallback):</span>
                    <code className="font-mono font-semibold">{lastCreated.pin}</code>
                  </div>
                ) : null}
                <div className="mt-2 text-xs text-muted-foreground">
                  MVP: QR por texto agora. Câmera fica para fase 2.
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={savingCreate || !isOperador}
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              {savingCreate ? "Registrando..." : "Registrar e Notificar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <AppLayout pageTitle="Gestão de Encomendas" headerActions={<HeaderActions />}>
      {!podeVer ? (
        <div className="rounded-2xl border bg-card p-6">
          <div className="text-sm text-muted-foreground">Carregando sessão/condomínio...</div>
        </div>
      ) : (
        <>
          {!isOperador ? (
            <div className="mb-4 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              Você está em modo leitura. Apenas PORTEIRO / ZELADOR / ADMIN / SÍNDICO podem registrar e retirar.
            </div>
          ) : null}

          <Tabs defaultValue="waiting">
            <TabsList className="mb-4">
              <TabsTrigger value="waiting"><Clock className="mr-2 h-4 w-4" />Aguardando</TabsTrigger>
              <TabsTrigger value="history"><History className="mr-2 h-4 w-4" />Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="waiting">
              <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-4 shadow-sm">
                {loading ? (
                  <div className="text-sm text-muted-foreground">Carregando encomendas...</div>
                ) : waiting.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhuma encomenda aguardando retirada.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="hidden sm:table-cell">ID</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Transportadora</TableHead>
                        <TableHead>Chegada</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {waiting.map((pkg) => (
                        <TableRow key={pkg.id}>
                          <TableCell className="font-mono hidden sm:table-cell">{pkg.id.slice(0, 8)}</TableCell>
                          <TableCell>
                            {pkg.blocoId ? `Bloco ${pkg.blocoId} • ` : ""}
                            {pkg.unidadeId || "-"}
                            {pkg.codigo ? (
                              <div className="text-xs text-muted-foreground mt-1">
                                Código: <span className="font-mono">{pkg.codigo}</span>
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>{pkg.transportadora || "-"}</TableCell>
                          <TableCell>{fmtTS(pkg.chegouEm)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!isOperador}
                              onClick={() => openRetirada(pkg.id)}
                            >
                              <QrCode className="mr-2 h-4 w-4" />
                              <span className="hidden sm:inline-block">Registrar Retirada</span>
                              <span className="sm:hidden">Retirar</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history">
              <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-4 shadow-sm">
                {history.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhuma encomenda retirada ainda.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="hidden sm:table-cell">ID</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Transportadora</TableHead>
                        <TableHead>Retirada</TableHead>
                        <TableHead className="hidden md:table-cell">Retirada por</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((pkg) => (
                        <TableRow key={pkg.id}>
                          <TableCell className="font-mono hidden sm:table-cell">{pkg.id.slice(0, 8)}</TableCell>
                          <TableCell>
                            {pkg.blocoId ? `Bloco ${pkg.blocoId} • ` : ""}
                            {pkg.unidadeId || "-"}
                          </TableCell>
                          <TableCell>{pkg.transportadora || "-"}</TableCell>
                          <TableCell>{fmtTS(pkg.retiradaEm)}</TableCell>
                          <TableCell className="hidden md:table-cell font-mono text-xs">
                            {pkg.retiradaPorUid ? pkg.retiradaPorUid.slice(0, 10) + "…" : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Dialog retirada */}
          <Dialog open={openRetirar} onOpenChange={setOpenRetirar}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Registrar Retirada</DialogTitle>
                <DialogDescription>
                  MVP: informe o <b>código</b> (PKG-...) ou o <b>PIN</b> fixo (fallback).
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="codigo" className="text-right">Código</Label>
                  <Input
                    id="codigo"
                    placeholder="Ex: PKG-7Q9K2M"
                    className="col-span-3"
                    value={codigoInput}
                    onChange={(e) => setCodigoInput(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="pinRet" className="text-right">PIN</Label>
                  <Input
                    id="pinRet"
                    placeholder="Fallback (ex: 1234)"
                    className="col-span-3"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                  />
                </div>

                <div className="text-xs text-muted-foreground">
                  Se o morador esquecer o celular: use o PIN. Depois a gente cria um painel do síndico para definir PIN por unidade.
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  onClick={handleRetirar}
                  disabled={savingRetirar || !isOperador}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {savingRetirar ? "Registrando..." : "Confirmar Retirada"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </AppLayout>
  );
}
