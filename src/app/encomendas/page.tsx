
"use client";

import * as React from "react";
import { PlusCircle, QrCode, PackageCheck, Clock, History, KeyRound, RefreshCcw, Package, Info } from "lucide-react";
import QRCode from "qrcode";

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
import { useCondominio } from "@/contexts/CondominioContext";
import { useFirestore, initializeFirebase } from "@/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
  type Query,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";

type EncomendaDoc = {
  id: string;
  status?: "AGUARDANDO" | "RETIRADA";
  unidadeId?: string;
  blocoId?: string | null;
  unidadeIdNorm?: string;
  blocoIdNorm?: string | null;
  transportadora?: string;
  observacao?: string | null;
  retiradaRecebedorNome?: string | null;
  retiradoPorNome?: string | null;
  retiradaPorNome?: string | null;
  retiradaPorEmail?: string | null;
  retiradaPorUid?: string | null;
  moradorUid?: string | null;
  codigo?: string;
  chegouEm?: any;
  retiradaEm?: any;
  criadoPorUid?: string;
};

function fmtTS(v: any) {
  try {
    if (!v) return "-";
    if (v instanceof Timestamp) return v.toDate().toLocaleString("pt-BR");
    if (typeof v?.toDate === "function") return v.toDate().toLocaleString("pt-BR");
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

function normUnidade(v: any) {
  return String(v || "")
    .toLowerCase()
    .replace(/\b(apto|apt|apartamento|unidade)\b/gi, "")
    .replace(/[^0-9a-z]/gi, "")
    .trim();
}

function normBloco(v: any) {
  return String(v || "").toLowerCase().trim();
}

export default function EncomendasPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const { condominioAtivoId, vinculoAtivo } = useCondominio();
  const firestore = useFirestore();

  const condId = condominioAtivoId;
  const role: string | null = vinculoAtivo?.role ?? null;
  
  const isOperador =
    role === "PORTEIRO" ||
    role === "ZELADOR" ||
    role === "SINDICO" ||
    role === "ADMIN" ||
    role === "ADMIN_CONDOMINIO" ||
    session?.superAdmin;
  
  const isMorador = role === "MORADOR";
  
  const [moradorInfo, setMoradorInfo] = React.useState<{unidadeId: string | null, blocoId: string | null, unidadeIdNorm: string | null, blocoIdNorm: string | null} | null>(null);

  const [waiting, setWaiting] = React.useState<EncomendaDoc[]>([]);
  const [history, setHistory] = React.useState<EncomendaDoc[]>([]);
  const [loading, setLoading] = React.useState(true);

  // form registrar
  const [openCreate, setOpenCreate] = React.useState(false);
  const [unidadeId, setUnidadeId] = React.useState("");
  const [blocoId, setBlocoId] = React.useState("");
  const [transportadora, setTransportadora] = React.useState("");
  const [observacao, setObservacao] = React.useState("");
  const [savingCreate, setSavingCreate] = React.useState(false);

  // retorno do create
  const [lastCreated, setLastCreated] = React.useState<{ codigo?: string; pin?: string } | null>(null);

  // dialog retirar
  const [openRetirar, setOpenRetirar] = React.useState(false);
  const [retirarEncomenda, setRetirarEncomenda] = React.useState<EncomendaDoc | null>(null);
  const [semCelular, setSemCelular] = React.useState(false);

  const [codigoInput, setCodigoInput] = React.useState("");
  const [pinMoradorInput, setPinMoradorInput] = React.useState("");
  const [recebedorNome, setRecebedorNome] = React.useState("");
  const [recebedorCpf, setRecebedorCpf] = React.useState("");
  const [recebedorParentesco, setRecebedorParentesco] = React.useState("");
  const [moradorUidRetirada, setMoradorUidRetirada] = React.useState("");
  
  const [savingRetirar, setSavingRetirar] = React.useState(false);
  const [retMembrosUnidade, setRetMembrosUnidade] = React.useState<any[]>([]);

  // QR Code Dialog state
  const [qrCodeUrl, setQrCodeUrl] = React.useState<string>("");
  const [selectedPkgForQr, setSelectedPkgForQr] = React.useState<EncomendaDoc | null>(null);

  async function showQrCode(pkg: EncomendaDoc) {
    if (!pkg.codigo) return;
    try {
        const url = await QRCode.toDataURL(pkg.codigo, { width: 300, margin: 2 });
        setQrCodeUrl(url);
        setSelectedPkgForQr(pkg);
    } catch (err) {
        console.error('Failed to generate QR code', err);
        alert('Não foi possível gerar o QR Code.');
    }
  }
  
  React.useEffect(() => {
    if (!isMorador || !condId || !firestore || !session?.user?.uid) {
        setMoradorInfo(null);
        return;
    }

    let alive = true;
    (async () => {
        try {
            const membroRef = doc(firestore, 'condominios', condId, 'membros', session.user.uid);
            const membroSnap = await getDoc(membroRef);

            if (alive && membroSnap.exists()) {
                const data = membroSnap.data() as any;
                setMoradorInfo({
                    unidadeId: data.unidadeId || data.apartamento || null,
                    blocoId: data.blocoId || data.bloco || null,
                    unidadeIdNorm: data.unidadeIdNorm || normUnidade(data.unidadeId || data.apartamento),
                    blocoIdNorm: data.blocoIdNorm || normBloco(data.blocoId || data.bloco)
                });
            } else if (alive) {
                setMoradorInfo(null);
            }
        } catch (e) {
            console.error("Failed to fetch morador info:", e);
            if (alive) setMoradorInfo(null);
        }
    })();
    
    return () => { alive = false; }
  }, [isMorador, condId, firestore, session?.user?.uid]);

  const podeVer = !isSessionLoading && !!session && !!condId && (isOperador || (isMorador && moradorInfo !== undefined));

  // listener firestore
  React.useEffect(() => {
    if (!condId || !firestore || !podeVer) {
      setWaiting([]);
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const base = collection(firestore, "condominios", condId, "encomendas");
    
    let qWaiting: Query | null = null;
    let qHistory: Query | null = null;

    if (isOperador) {
        qWaiting = query(base, where("status", "==", "AGUARDANDO"));
        qHistory = query(base, where("status", "==", "RETIRADA"));
    } else if (isMorador && moradorInfo) {
        const unidadeNorm = moradorInfo.unidadeIdNorm;
        const blocoNorm = moradorInfo.blocoIdNorm;

        if (unidadeNorm) {
            const waitingConditions = [where("unidadeIdNorm", "==", unidadeNorm), where("status", "==", "AGUARDANDO")];
            const historyConditions = [where("unidadeIdNorm", "==", unidadeNorm), where("status", "==", "RETIRADA")];

            if (blocoNorm) {
                waitingConditions.push(where("blocoIdNorm", "==", blocoNorm));
                historyConditions.push(where("blocoIdNorm", "==", blocoNorm));
            }
            
            qWaiting = query(base, ...waitingConditions);
            qHistory = query(base, ...historyConditions);

        } else {
            setWaiting([]);
            setHistory([]);
            setLoading(false);
            return;
        }
    } else {
        setWaiting([]);
        setHistory([]);
        setLoading(false);
        return;
    }
    
    const unsub1 = onSnapshot(qWaiting, (snap) => {
        const out: EncomendaDoc[] = [];
        snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
        out.sort((a,b) => (b.chegouEm?.toMillis() ?? 0) - (a.chegouEm?.toMillis() ?? 0));
        setWaiting(out);
        setLoading(false);
    }, (err) => {
        console.error("[Encomendas] erro 'AGUARDANDO':", err);
        setLoading(false);
    });

    const unsub2 = onSnapshot(qHistory, (snap) => {
        const out: EncomendaDoc[] = [];
        snap.forEach((d) => out.push({ id: d.id, ...(d.data() as any) }));
        out.sort((a,b) => (b.retiradaEm?.toMillis() ?? 0) - (a.retiradaEm?.toMillis() ?? 0));
        setHistory(out);
    }, (err) => {
        console.error("[Encomendas] erro 'RETIRADA':", err);
    });

    return () => { unsub1(); unsub2(); };
  }, [firestore, condId, podeVer, isMorador, isOperador, moradorInfo]);

  React.useEffect(() => {
    if (!firestore || !condId || !retirarEncomenda?.unidadeIdNorm) {
        setRetMembrosUnidade([]);
        return;
    }

    const unidadeNorm = retirarEncomenda.unidadeIdNorm;
    const blocoNorm = retirarEncomenda.blocoIdNorm;
    
    const membrosRef = collection(firestore, `condominios/${condId}/membros`);
    
    let q: Query;
    if (blocoNorm) {
        q = query(membrosRef, where("unidadeIdNorm", "==", unidadeNorm), where("blocoIdNorm", "==", blocoNorm));
    } else {
        q = query(membrosRef, where("unidadeIdNorm", "==", unidadeNorm));
    }

    getDocs(q).then(snap => {
        const membros = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setRetMembrosUnidade(membros);
    }).catch(err => {
        console.error("Erro ao buscar membros da unidade:", err);
        setRetMembrosUnidade([]);
    });
  }, [firestore, condId, retirarEncomenda]);

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
      };

    console.log("[DIAGNÓSTICO] Enviando para /api/encomendas/create:", payload);

    try {
      const resp = await apiPost("/api/encomendas/create", payload);
      console.log("[DIAGNÓSTICO] API create respondeu:", resp);

      setLastCreated({ codigo: resp?.codigo, pin: resp?.pin });

      setUnidadeId("");
      setBlocoId("");
      setTransportadora("");
      setObservacao("");

    } catch (e: any) {
      console.error("[DIAGNÓSTICO] Erro ao chamar API de criar encomenda:", e);
      alert(`Ocorreu um erro ao registrar a encomenda:\n\n${e?.message || "Verifique o console para mais detalhes."}\n\nStack: ${e?.stack ?? 'N/A'}`);
    } finally {
      setSavingCreate(false);
    }
  }

  function openRetirada(encomenda: EncomendaDoc) {
      setRetirarEncomenda(encomenda);
      setSemCelular(false);
      setCodigoInput("");
      setPinMoradorInput("");
      setRecebedorNome("");
      setRecebedorCpf("");
      setRecebedorParentesco("");
      setMoradorUidRetirada("");
      setOpenRetirar(true);
    }

  async function handleRetirar() {
    if (!condId || !retirarEncomenda) return;
    
    const payload: any = {
      condominioId: String(condId),
      encomendaId: retirarEncomenda.id,
    };

    if (semCelular) {
      if (!pinMoradorInput.trim() || !moradorUidRetirada.trim() || !recebedorNome.trim()) {
        return alert("No modo 'Sem Celular', selecione o morador, informe o PIN dele e o nome de quem está retirando.");
      }
      payload.moradorUid = moradorUidRetirada;
      payload.pinMorador = pinMoradorInput;
      payload.recebedorNome = recebedorNome;
      payload.recebedorCpf = recebedorCpf;
      payload.recebedorParentesco = recebedorParentesco;
    } else {
      if (!codigoInput.trim()) {
        return alert("Informe o código de retirada (PKG-...).");
      }
      payload.codigo = codigoInput;
    }

    setSavingRetirar(true);
    try {
      await apiPost("/api/encomendas/retirar", payload);

      alert("✅ Retirada registrada!");
      setOpenRetirar(false);
    } catch (e: any) {
      console.error("[encomendas] erro retirar:", e);
      alert(e?.message || "Erro ao registrar retirada.");
    } finally {
      setSavingRetirar(false);
    }
  }

  const pageTitle = isMorador ? "Minhas Encomendas" : "Gestão de Encomendas";

  return (
    <AppLayout
      pageTitle={pageTitle}
      headerActions={
        isOperador && (
            <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
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
                    Insira os dados da encomenda. O morador receberá um aviso no app.
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

                    {lastCreated?.codigo ? (
                    <div className="rounded-xl border bg-white/60 p-4 text-sm">
                        <div className="font-semibold mb-2">✅ Encomenda registrada!</div>
                        <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4" />
                        <span>Código (QR texto):</span>
                        <code className="font-mono font-semibold">{lastCreated.codigo}</code>
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
        )
      }
    >
      {!podeVer ? (
        <div className="rounded-2xl border bg-card p-6">
          <div className="text-sm text-muted-foreground">Carregando sessão/condomínio...</div>
        </div>
      ) : (
        <>
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
                  <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                    <Package className="h-12 w-12 text-slate-400" />
                    <div className="text-sm font-medium text-slate-700">Tudo em dia!</div>
                    <div className="text-xs text-slate-500">Nenhuma encomenda aguardando retirada.</div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {isOperador && <TableHead className="hidden sm:table-cell">ID</TableHead>}
                        {isOperador && <TableHead>Unidade</TableHead>}
                        <TableHead>Transportadora</TableHead>
                        <TableHead>Chegada</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {waiting.map((pkg) => (
                        <TableRow key={pkg.id}>
                          {isOperador && <TableCell className="font-mono hidden sm:table-cell">{pkg.id.slice(0, 8)}</TableCell>}
                          {isOperador && (
                            <TableCell>
                                {pkg.blocoId ? `Bloco ${pkg.blocoId} • ` : ""}
                                {pkg.unidadeId || "-"}
                            </TableCell>
                          )}
                          <TableCell>{pkg.transportadora || "-"}</TableCell>
                          <TableCell>{fmtTS(pkg.chegouEm)}</TableCell>
                          <TableCell className="text-right">
                            {isOperador ? (
                                <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openRetirada(pkg)}
                                >
                                <QrCode className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline-block">Registrar Retirada</span>
                                <span className="sm:hidden">Retirar</span>
                                </Button>
                            ) : (
                                <Button
                                variant="outline"
                                size="sm"
                                disabled={!pkg.codigo}
                                onClick={() => showQrCode(pkg)}
                                >
                                <QrCode className="mr-2 h-4 w-4" />
                                Ver Código
                                </Button>
                            )}
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
                        {isOperador && <TableHead className="hidden sm:table-cell">ID</TableHead>}
                        {isOperador && <TableHead>Unidade</TableHead>}
                        <TableHead>Transportadora</TableHead>
                        <TableHead>Retirada</TableHead>
                        <TableHead className="hidden md:table-cell">Retirada por</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((pkg) => (
                        <TableRow key={pkg.id}>
                          {isOperador && <TableCell className="font-mono hidden sm:table-cell">{pkg.id.slice(0, 8)}</TableCell>}
                           {isOperador && (
                                <TableCell>
                                    {pkg.blocoId ? `Bloco ${pkg.blocoId} • ` : ""}
                                    {pkg.unidadeId || "-"}
                                </TableCell>
                           )}
                          <TableCell>{pkg.transportadora || "-"}</TableCell>
                          <TableCell>{fmtTS(pkg.retiradaEm)}</TableCell>
                          <TableCell>
                          <div className="flex items-center gap-2">
                            <span>
                              {pkg.retiradaRecebedorNome
                                ? pkg.retiradaRecebedorNome
                                : (pkg.retiradoPorNome || "-")}
                            </span>
                            <span
                              className="inline-flex items-center opacity-70"
                              title={"Registrado por: " + (pkg.retiradoPorNome || pkg.retiradaPorNome || pkg.retiradaPorEmail || pkg.retiradaPorUid || "-")}
                            >
                              <Info className="h-4 w-4" />
                            </span>
                          </div>
                        </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <Dialog open={!!selectedPkgForQr} onOpenChange={(isOpen) => !isOpen && setSelectedPkgForQr(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Código de Retirada</DialogTitle>
                    <DialogDescription>
                        Apresente este código ou QR code na portaria para retirar sua encomenda.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center p-4">
                    {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" />}
                    <code className="mt-4 text-lg font-bold tracking-wider">{selectedPkgForQr?.codigo}</code>
                </div>
                <DialogFooter>
                    <Button onClick={() => setSelectedPkgForQr(null)}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={openRetirar} onOpenChange={setOpenRetirar}>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Registrar Retirada</DialogTitle>
                <DialogDescription>
                  Unidade: {retirarEncomenda?.unidadeId}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="flex items-center justify-between rounded-lg border bg-white/60 p-3">
                    <div>
                        <div className="text-sm font-medium">Morador esqueceu o celular?</div>
                        <div className="text-xs text-muted-foreground">
                        Use o PIN pessoal do morador para validar a retirada.
                        </div>
                    </div>
                    <button
                        type="button"
                        className={`h-6 w-11 rounded-full transition ${semCelular ? "bg-emerald-500" : "bg-gray-300"}`}
                        onClick={() => setSemCelular((v) => !v)}
                        aria-label="Alternar modo sem celular"
                    >
                        <span
                        className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${semCelular ? "translate-x-5" : "translate-x-1"}`}
                        />
                    </button>
                </div>
                
                {semCelular ? (
                  <div className="space-y-4 rounded-md border border-amber-300 bg-amber-50 p-4">
                    <h3 className="font-semibold">Modo Sem Celular</h3>
                     <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Morador</Label>
                      <select className="col-span-3 rounded-md border px-2 py-1.5" value={moradorUidRetirada} onChange={(e) => setMoradorUidRetirada(e.target.value)}>
                        <option value="">Selecione quem está retirando</option>
                        {retMembrosUnidade.map((m: any) => (
                          <option key={m.id} value={m.id}>{m.nome || m.email}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="pinMorador" className="text-right">PIN</Label>
                      <Input id="pinMorador" placeholder="PIN pessoal do morador" className="col-span-3" value={pinMoradorInput} onChange={(e) => setPinMoradorInput(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="recebedorNome" className="text-right">Recebedor</Label>
                      <Input id="recebedorNome" placeholder="Nome de quem está retirando" className="col-span-3" value={recebedorNome} onChange={(e) => setRecebedorNome(e.target.value)} />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="recebedorCpf" className="text-right">CPF</Label>
                      <Input id="recebedorCpf" placeholder="CPF de quem retira" className="col-span-3" value={recebedorCpf} onChange={(e) => setRecebedorCpf(e.target.value)} />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="recebedorParentesco" className="text-right">Relação</Label>
                      <Input id="recebedorParentesco" placeholder="Ex: Cônjuge, Filho, Visitante" className="col-span-3" value={recebedorParentesco} onChange={(e) => setRecebedorParentesco(e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="codigo" className="text-right">Código</Label>
                    <Input id="codigo" placeholder="Ex: PKG-7Q9K2M" className="col-span-3" value={codigoInput} onChange={(e) => setCodigoInput(e.target.value)} />
                  </div>
                )}
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
