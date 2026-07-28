
"use client";

import * as React from "react";
import Link from 'next/link';
import { PlusCircle, QrCode, PackageCheck, Clock, History, KeyRound, RefreshCcw, Package, Info, Image as ImageIcon } from "lucide-react";
import QRCode from "qrcode";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

import QrScanner from "@/components/qr/QrScanner";
import { AppLayout } from "@/components/layout/AppLayout";
import { SectionCard } from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/layout/EmptyState";
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
import { useBarcodeScanner } from "./_hooks/useBarcodeScanner";
import { normUnidade, normBloco } from "@/lib/normalization/location";
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
  orderBy,
} from "firebase/firestore";

type EncomendaDoc = {
  nfNumero?: string | null;
  criadoPorNome?: string | null;
  criadoPorEmail?: string | null;
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
  fotoUrl?: string | null;
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
  // UN.6A: Canonical selects
  const [unidadeId, setUnidadeId] = React.useState("");
  const [blocoId, setBlocoId] = React.useState("");
  const [unitDocId, setUnitDocId] = React.useState("");
  const [destinatarioPessoaId, setDestinatarioPessoaId] = React.useState("");
  const [blocosList, setBlocosList] = React.useState<{ id: string; nome: string; isSistema: boolean }[]>([]);
  const [unidadesList, setUnidadesList] = React.useState<{ id: string; numero: string }[]>([]);
  const [destinatariosList, setDestinatariosList] = React.useState<{ pessoaId: string; nome: string; tiposVinculo: string[]; reside: boolean }[]>([]);
  const [loadingUnidades, setLoadingUnidades] = React.useState(false);
  const [loadingDestinatarios, setLoadingDestinatarios] = React.useState(false);
  const [transportadora, setTransportadora] = React.useState("");
  const [observacao, setObservacao] = React.useState("");
  const [nfNumero, setNfNumero] = React.useState("");
  const [savingCreate, setSavingCreate] = React.useState(false);

  const [fotoUrl, setFotoUrl] = React.useState("");
  const [uploadingFoto, setUploadingFoto] = React.useState(false);

  // UN.6A: Load blocos list for select
  async function loadBlocos() {
    if (!condId) return;
    try {
      const token = await session?.user?.getIdToken();
      const res = await fetch(`/api/blocos?condominioId=${encodeURIComponent(condId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setBlocosList((data.blocos || []).filter((b: any) => b.ativo));
    } catch { /* ignore */ }
  }
  // Load units when bloco changes
  async function loadUnidades(bid: string) {
    if (!condId || !bid) { setUnidadesList([]); return; }
    setLoadingUnidades(true);
    try {
      const token = await session?.user?.getIdToken();
      const res = await fetch(`/api/unidades?condominioId=${encodeURIComponent(condId)}&blocoId=${encodeURIComponent(bid)}&apenasAtivas=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setUnidadesList(data.unidades || []);
    } catch { /* ignore */ }
    setLoadingUnidades(false);
  }
  // Load destinatarios (residentes) when unidade changes
  async function loadDestinatarios(uid: string) {
    if (!condId || !uid) { setDestinatariosList([]); return; }
    setLoadingDestinatarios(true);
    try {
      const token = await session?.user?.getIdToken();
      const res = await fetch(`/api/vinculos-unidades?condominioId=${encodeURIComponent(condId)}&unitDocId=${encodeURIComponent(uid)}&blocoId=${encodeURIComponent(blocoId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        // Fetch pessoa names
        const vlist = data.vinculos || [];
        const names: { pessoaId: string; nome: string; tiposVinculo: string[]; reside: boolean }[] = [];
        for (const v of vlist) {
          try {
            const pr = await fetch(`/api/pessoas?condominioId=${encodeURIComponent(condId)}`, { headers: { Authorization: `Bearer ${token}` } });
          } catch { names.push({ pessoaId: v.pessoaId, nome: v.pessoaId, tiposVinculo: v.tiposVinculo || [], reside: v.resideNaUnidade }); }
        }
        // Simpler approach: just return vinculos with pessoaId
        setDestinatariosList(vlist.filter((v: any) => v.status === "ATIVO" && v.resideNaUnidade).map((v: any) => ({
          pessoaId: v.pessoaId,
          nome: v.pessoaId, // Will show pessoaId; names resolved via load
          tiposVinculo: v.tiposVinculo || [],
          reside: v.resideNaUnidade,
        })));
      }
    } catch { setDestinatariosList([]); }
    setLoadingDestinatarios(false);
  }

  React.useEffect(() => { if (openCreate) loadBlocos(); }, [openCreate, condId]);
  React.useEffect(() => { if (blocoId) { loadUnidades(blocoId); setUnitDocId(""); setDestinatarioPessoaId(""); } }, [blocoId]);
  React.useEffect(() => { if (unitDocId) loadDestinatarios(unitDocId); }, [unitDocId]);

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !condId) return;

    setUploadingFoto(true);
    try {
      const storage = getStorage();
      const fileRef = ref(storage, `condominios/${condId}/encomendas/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setFotoUrl(url);
    } catch (err: any) {
      console.error("Erro no upload da foto da encomenda:", err);
      alert("Erro ao enviar foto: " + (err.message || String(err)));
    } finally {
      setUploadingFoto(false);
    }
  }

  // retorno do create
  const [lastCreated, setLastCreated] = React.useState<{ codigo?: string; pin?: string } | null>(null);

  const [readingLabel, setReadingLabel] = React.useState(false);

  async function handleAiLabelScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setReadingLabel(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          const resp = await apiPost("/api/ai/ler-rotulo", { image: base64 });
          if (resp?.ok && resp?.data) {
            const info = resp.data;
            if (info.unidadeId) setUnidadeId(info.unidadeId);
            if (info.blocoId) setBlocoId(info.blocoId);
            if (info.transportadora) setTransportadora(info.transportadora);
            if (info.nfNumero) setNfNumero(info.nfNumero);
            
            let msg = "A IA identificou no rótulo:\n";
            if (info.destinatarioNome) msg += `• Destinatário: ${info.destinatarioNome}\n`;
            if (info.unidadeId) msg += `• Unidade: ${info.unidadeId}\n`;
            if (info.blocoId) msg += `• Bloco: ${info.blocoId}\n`;
            if (info.transportadora) msg += `• Transportadora: ${info.transportadora}\n`;
            alert(msg + "\nOs campos foram preenchidos automaticamente. Revise-os antes de registrar.");
          } else {
            alert("Não foi possível extrair dados da etiqueta com nitidez. Tente preencher manualmente.");
          }
        } catch (err: any) {
          alert("Erro ao ler rótulo: " + err.message);
        } finally {
          setReadingLabel(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert("Erro ao ler arquivo: " + err.message);
      setReadingLabel(false);
    }
  }

  /* INFO_MODAL_START */
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [infoPkg, setInfoPkg] = React.useState<any>(null);

  function openInfo(pkg: any) {
    setInfoPkg(pkg);
    setInfoOpen(true);
  }
  /* INFO_MODAL_END */
  // busca (porteiro) - por NF / código / unidade / transportadora
  const [buscaEncomendas, setBuscaEncomendas] = React.useState("");

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
  const [retirarError, setRetirarError] = React.useState<string | null>(null);
  
  const [savingRetirar, setSavingRetirar] = React.useState(false);
  const [retMembrosUnidade, setRetMembrosUnidade] = React.useState<any[]>([]);

  // QR Code Dialog state
  const [isQrDialogOpen, setIsQrDialogOpen] = React.useState(false);
const [scanOpen, setScanOpen] = React.useState(false);
  const [qrCodeUrl, setQrCodeUrl] = React.useState<string>("");
  const [selectedPkgForQr, setSelectedPkgForQr] = React.useState<EncomendaDoc | null>(null);

  async function showQrCode(pkg: EncomendaDoc) {
      try {
        // abre o modal imediatamente e reseta a imagem
        setSelectedPkgForQr(pkg);
        setQrCodeUrl("");
        setIsQrDialogOpen(true);

        const code = String((pkg as any)?.codigo ?? "").trim();
        if (!code) {
          console.warn("[encomendas] showQrCode: pkg sem codigo:", pkg?.id, pkg);
          return;
        }

        const url = await QRCode.toDataURL(code, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: "M",
        });

        setQrCodeUrl(url);
      } catch (e) {
        console.error("[encomendas] erro ao gerar QR:", e, pkg);
        setQrCodeUrl("");
      }
    }

    React.useEffect(() => {
  if (!openRetirar) setScanOpen(false);
}, [openRetirar]);

  // Lote QR Code Dialog states for resident
  const [generatingBatchQr, setGeneratingBatchQr] = React.useState(false);
  const [isBatchQrDialogOpen, setIsBatchQrDialogOpen] = React.useState(false);
  const [batchQrCodeUrl, setBatchQrCodeUrl] = React.useState("");
  const [batchToken, setBatchToken] = React.useState("");
  const [batchExpiraEm, setBatchExpiraEm] = React.useState("");

  async function handleGenerateBatchQr() {
    if (!condId) return;
    setGeneratingBatchQr(true);
    try {
      const resp = await apiPost("/api/encomendas/gerar-lote", { condominioId: condId });
      if (resp?.ok && resp?.token) {
        setBatchToken(resp.token);
        if (resp.expiraEm) {
          const dateStr = new Date(resp.expiraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          setBatchExpiraEm(dateStr);
        } else {
          setBatchExpiraEm("");
        }
        const url = await QRCode.toDataURL(resp.token, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: "M",
        });
        setBatchQrCodeUrl(url);
        setIsBatchQrDialogOpen(true);
      } else {
        alert(resp?.error || "Erro ao gerar QR Code em lote.");
      }
    } catch (e: any) {
      console.error("Erro ao gerar QR Code em lote:", e);
      alert("Erro ao gerar QR Code em lote: " + (e.message || String(e)));
    } finally {
      setGeneratingBatchQr(false);
    }
  }

  // Lote QR Code Dialog states for operators/portaria
  const [openRetirarLote, setOpenRetirarLote] = React.useState(false);
  const [codigoBuscaRetirada, setCodigoBuscaRetirada] = React.useState("");
  const [validatedLote, setValidatedLote] = React.useState<any | null>(null);
  const [loteSelectedIds, setLoteSelectedIds] = React.useState<Set<string>>(new Set());
  const [recebedorLote, setRecebedorLote] = React.useState("");
  const [validatingLoteError, setValidatingLoteError] = React.useState<string | null>(null);
  const [loadingValidarLote, setLoadingValidarLote] = React.useState(false);
  const [savingRetirarLote, setSavingRetirarLote] = React.useState(false);
  const [scanLoteOpen, setScanLoteOpen] = React.useState(false);

  React.useEffect(() => {
    if (!openRetirarLote) setScanLoteOpen(false);
  }, [openRetirarLote]);

  async function handleValidarLote(code?: string) {
    const codeToValidate = code || codigoBuscaRetirada.trim();
    if (!condId || !codeToValidate) return;

    setLoadingValidarLote(true);
    setValidatingLoteError(null);
    setValidatedLote(null);
    setLoteSelectedIds(new Set());
    
    try {
      const resp = await apiPost("/api/encomendas/validar-lote", {
        condominioId: condId,
        codigo: codeToValidate,
      });

      if (resp?.ok && resp?.encomendas) {
        setValidatedLote(resp);
        const ids = new Set<string>(resp.encomendas.map((e: any) => e.id));
        setLoteSelectedIds(ids);
        setRecebedorLote("Próprio morador");
      } else {
        setValidatingLoteError(resp?.error || "Não foi possível validar o código.");
      }
    } catch (e: any) {
      console.error("Erro ao validar lote:", e);
      setValidatingLoteError(e.message || String(e));
    } finally {
      setLoadingValidarLote(false);
    }
  }

  async function handleRetirarLoteConfirm() {
    if (!condId || !validatedLote || loteSelectedIds.size === 0) return;

    setSavingRetirarLote(true);
    try {
      const resp = await apiPost("/api/encomendas/retirar-lote", {
        condominioId: condId,
        token: validatedLote.tipo === "LOTE" ? validatedLote.token : null,
        encomendaIds: Array.from(loteSelectedIds),
        recebedorNome: recebedorLote.trim() || "Próprio morador",
      });

      if (resp?.ok) {
        alert(`✅ Retirada registrada com sucesso! (${resp.quantidadeRetirada} encomendas)`);
        setOpenRetirarLote(false);
      } else {
        alert(resp?.error || "Erro ao registrar retirada.");
      }
    } catch (e: any) {
      console.error("Erro ao retirar lote:", e);
      alert("Erro ao registrar retirada: " + (e.message || String(e)));
    } finally {
      setSavingRetirarLote(false);
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

  // E.2.1: Scanner USB HID — captura código e abre cadastro rápido
  const [scannedCode, setScannedCode] = React.useState<string | null>(null);

  const { clearBuffer } = useBarcodeScanner({
    onScan: (scan) => {
      setScannedCode(scan.code);
      setOpenCreate(true);
      // Preencher código e focar unidade após abertura do modal
      setTimeout(() => {
        const unitInput = document.querySelector<HTMLInputElement>('[data-encomenda-unidade]');
        if (unitInput) unitInput.focus();
      }, 300);
    },
    enabled: isOperador && !openCreate,
  });

  // E.2.1: sincronizar código escaneado com o input do formulário
  React.useEffect(() => {
    if (scannedCode) {
      setCodigoInput(scannedCode);
      setScannedCode(null);
    }
  }, [scannedCode]);

  async function handleCreate() {
    if (!condId) return;
    if (!unitDocId.trim()) return alert("Selecione a unidade.");
    if (!blocoId.trim()) return alert("Selecione o bloco.");
    if (!transportadora.trim()) return alert("Informe a transportadora.");

    setSavingCreate(true);
    const payload: any = {
        condominioId: String(condId),
        blocoId: blocoId.trim(),
        unitDocId: unitDocId.trim(),
        destinatarioPessoaId: destinatarioPessoaId.trim() || null,
        // Legacy compat
        unidadeId: unidadeId.trim() || "",
        transportadora: transportadora.trim(),
        nfNumero: nfNumero.trim() ? nfNumero.trim() : null,
        observacao: observacao.trim() ? observacao.trim() : null,
        fotoUrl: fotoUrl ? fotoUrl.trim() : null,
      };

    console.log("[DIAGNÓSTICO] Enviando para /api/encomendas/create:", payload);

    try {
      const resp = await apiPost("/api/encomendas/create", payload);
      console.log("[DIAGNÓSTICO] API create respondeu:", resp);

      setLastCreated({ codigo: resp?.codigo, pin: resp?.pin });

      setCodigoInput("");
      setUnidadeId("");
      setBlocoId("");
      setUnitDocId("");
      setDestinatarioPessoaId("");
      setTransportadora("");
      setObservacao("");
      setNfNumero("");
      setFotoUrl("");
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
      setRetirarError(null);
      setOpenRetirar(true);
    }

  async function handleRetirar() {
    if (!condId || !retirarEncomenda) return;
    
    setRetirarError(null);

    const payload: any = {
      condominioId: String(condId),
      encomendaId: retirarEncomenda.id,
    };

    if (semCelular) {
      if (!pinMoradorInput.trim() || !moradorUidRetirada.trim() || !recebedorNome.trim()) {
        setRetirarError("No modo 'Sem Celular', selecione o morador, informe o PIN e o nome de quem está retirando.");
        return;
      }
      payload.moradorUid = moradorUidRetirada;
      payload.pinMorador = pinMoradorInput;
      payload.recebedorNome = recebedorNome;
      payload.recebedorCpf = recebedorCpf;
      payload.recebedorParentesco = recebedorParentesco;
    } else {
      if (!codigoInput.trim()) {
        setRetirarError("Informe o código de retirada (PKG-...).");
        return;
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
      setRetirarError(e?.message || "Erro ao registrar retirada.");
    } finally {
      setSavingRetirar(false);
    }
  }

  function getRegistradoPor(pkg: any) {
  return (
    pkg?.registradoPorNome ||
    pkg?.registradoPorEmail ||
    pkg?.registradoPorUid ||
    // legado
    pkg?.retiradoPorNome ||
    pkg?.retiradaPorNome ||
    pkg?.retiradaPorEmail ||
    pkg?.retiradaPorUid ||
    "-"
  );
}

function matchBusca(pkg: any, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase();

  const unidade = String(pkg?.unidadeId || "").toLowerCase();
  const bloco = String(pkg?.blocoId || "").toLowerCase();
  const transp = String(pkg?.transportadora || "").toLowerCase();
  const codigo = String(pkg?.codigo || "").toLowerCase();
  const nf = String(pkg?.nfNumero || "").toLowerCase();

  const unidadeFmt = (bloco ? ("bloco " + bloco + " ") : "") + unidade;

  return (
    unidade.includes(needle) ||
    bloco.includes(needle) ||
    unidadeFmt.includes(needle) ||
    transp.includes(needle) ||
    codigo.includes(needle) ||
    nf.includes(needle)
  );
}

const buscaQ = (buscaEncomendas || "").trim();
const waitingFiltered = (!isOperador || !buscaQ) ? waiting : waiting.filter((pkg) => matchBusca(pkg as any, buscaQ));
const historyFiltered = (!isOperador || !buscaQ) ? history : history.filter((pkg) => matchBusca(pkg as any, buscaQ));


  return (
    <AppLayout
      pageTitle="Encomendas"
      headerActions={
        isOperador && (
            <div className="flex items-center gap-2">
              <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  title="Atualizar"
              >
                  <RefreshCcw className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Atualizar</span>
              </Button>

              <Dialog open={openCreate} onOpenChange={(v) => {
                  setOpenCreate(v);
                  if (!v) setLastCreated(null);
              }}>
                  <DialogTrigger asChild>
                  <Button size="sm" disabled={!isOperador} title="Registrar Encomenda">
                      <PlusCircle className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline-block">Registrar Encomenda</span>
                  </Button>
                  </DialogTrigger>

                <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-[520px] max-h-[85vh] overflow-y-auto tc-dialog-center">
                <DialogHeader>
                    <DialogTitle>Registrar Nova Encomenda</DialogTitle>
                    <DialogDescription>
                    Insira os dados da encomenda. O morador receberá um aviso no app.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Botão de Scanner com IA */}
                    <div className="border border-dashed border-[#00D0E6]/30 rounded-xl p-3 bg-[#00D0E6]/5 flex flex-col items-center justify-center gap-2 mb-2">
                      <span className="text-xs text-slate-500 font-medium text-center">
                        Economize tempo! Tire uma foto da etiqueta da encomenda.
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 border-primary/40 hover:bg-primary/10 text-foreground font-semibold"
                        onClick={() => document.getElementById("ai-label-file")?.click()}
                        disabled={readingLabel}
                      >
                        {readingLabel ? (
                          <>
                            <span className="animate-spin h-4 w-4 border-2 border-slate-500 border-t-transparent rounded-full mr-2" />
                            Analisando com IA...
                          </>
                        ) : (
                          <>
                            <PlusCircle className="h-4 w-4 text-[#00D0E6]" />
                            Escanear Etiqueta com IA
                          </>
                        )}
                      </Button>
                      <input
                        id="ai-label-file"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAiLabelScan}
                      />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="blocoId" className="text-right">Bloco</Label>
                    <select
                      id="blocoId"
                      className="col-span-3 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      value={blocoId}
                      onChange={(e) => { setBlocoId(e.target.value); setUnitDocId(""); }}
                    >
                      <option value="">{blocosList.length === 0 ? "Carregando..." : "Selecione o bloco"}</option>
                      {blocosList.filter(b => !b.isSistema || blocosList.length > 1).map(b => (
                        <option key={b.id} value={b.id}>{b.nome}</option>
                      ))}
                    </select>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="unidadeId" className="text-right">Unidade</Label>
                    <select
                      id="unidadeId"
                      className="col-span-3 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      data-encomenda-unidade="true"
                      value={unitDocId}
                      onChange={(e) => { setUnitDocId(e.target.value); setDestinatarioPessoaId(""); }}
                      disabled={!blocoId || loadingUnidades}
                    >
                      <option value="">{!blocoId ? "Selecione o bloco primeiro" : loadingUnidades ? "Carregando..." : unidadesList.length === 0 ? "Nenhuma unidade" : "Selecione a unidade"}</option>
                      {unidadesList.map(u => (
                        <option key={u.id} value={u.id}>{u.numero}</option>
                      ))}
                    </select>
                    </div>

                    {destinatariosList.length > 0 && (
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="dest" className="text-right">Destinatário</Label>
                    <select
                      id="dest"
                      className="col-span-3 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      value={destinatarioPessoaId}
                      onChange={(e) => setDestinatarioPessoaId(e.target.value)}
                    >
                      <option value="">Unidade (sem destinatário específico)</option>
                      {destinatariosList.map(d => (
                        <option key={d.pessoaId} value={d.pessoaId}>
                          {d.pessoaId.slice(0,8)}... {d.reside ? "(Residente)" : ""}
                        </option>
                      ))}
                    </select>
                    </div>
                    )}

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
                      <Label htmlFor="nfNumero" className="text-right">Nota Fiscal</Label>
                      <Input
                          id="nfNumero"
                          placeholder="Opcional (Ex: 3519...)"
                          className="col-span-3"
                          value={nfNumero}
                          onChange={(e) => setNfNumero(e.target.value)}
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
                      <Label htmlFor="foto" className="text-right">Foto Pacote</Label>
                      <div className="col-span-3 space-y-2">
                        <Input
                          id="foto"
                          type="file"
                          accept="image/*"
                          onChange={handleFotoUpload}
                          disabled={uploadingFoto}
                        />
                        {uploadingFoto && <p className="text-xs text-[#00D0E6] animate-pulse">Enviando foto...</p>}
                        {fotoUrl && (
                          <img src={fotoUrl} alt="Preview do pacote" className="h-24 w-auto rounded-xl border border-white/10" />
                        )}
                      </div>
                    </div>

                    {lastCreated?.codigo ? (
                    <div className="rounded-xl border border-cyan-500/20 bg-slate-900/55 p-4 text-sm text-white backdrop-blur-xl shadow-[0_0_40px_rgba(0,208,230,0.12)]">
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
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6">
              <TabsList className="mb-0 grid grid-cols-2 w-full xl:w-[280px]">
                <TabsTrigger value="waiting"><Clock className="mr-2 h-4 w-4" />Aguardando</TabsTrigger>
                <TabsTrigger value="history"><History className="mr-2 h-4 w-4" />Histórico</TabsTrigger>
              </TabsList>

              {isOperador && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto">
                  <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                    <Input
                      value={buscaEncomendas}
                      onChange={(e) => setBuscaEncomendas(e.target.value)}
                      placeholder="Buscar por NF, código, unidade..."
                      className="h-9 w-full sm:w-[260px] md:w-[320px]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!buscaEncomendas.trim() || waitingFiltered.length === 0}
                      onClick={() => {
                        const first = waitingFiltered[0];
                        if (first) openRetirada(first);
                      }}
                      title={waitingFiltered.length ? "Abrir retirada do primeiro resultado" : "Nada encontrado"}
                      className="h-9 shrink-0"
                    >
                      Abrir retirada
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCodigoBuscaRetirada("");
                      setValidatedLote(null);
                      setLoteSelectedIds(new Set());
                      setRecebedorLote("");
                      setValidatingLoteError(null);
                      setOpenRetirarLote(true);
                      setScanLoteOpen(false);
                    }}
                    title="Retirar por QR/Código"
                    className="h-9 shrink-0 gap-2"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>Retirar por QR/Código</span>
                  </Button>
                </div>
              )}
            </div>


            <TabsContent value="waiting">
              <SectionCard noPadding>
                {loading ? (
                  <div className="text-sm text-muted-foreground p-4">Carregando encomendas...</div>
                ) : waiting.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title="Tudo em dia!"
                    description="Nenhuma encomenda aguardando retirada."
                  />
                ) : (
                  <div className="space-y-4">
                    {isMorador && waiting.length >= 2 && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={handleGenerateBatchQr}
                          disabled={generatingBatchQr}
                          className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold"
                        >
                          <QrCode className="mr-2 h-4 w-4" />
                          {generatingBatchQr ? "Gerando..." : "Gerar QR de todas"}
                        </Button>
                      </div>
                    )}
                    <div className="overflow-x-auto w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          
                          {isOperador && <TableHead>Unidade</TableHead>}
                          <TableHead>Transportadora</TableHead>
                          <TableHead>Foto</TableHead>
                            <TableHead>NF</TableHead>
                            <TableHead>Chegada</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {waitingFiltered.map((pkg) => (
                          <TableRow key={pkg.id}>
                            
                            {isOperador && (
                              <TableCell>
                                  {pkg.blocoId ? `Bloco ${pkg.blocoId} • ` : ""}
                                  {pkg.unidadeId || "-"}
                              </TableCell>
                            )}
                            <TableCell>{pkg.transportadora || "-"}</TableCell>
                            <TableCell>
                              {pkg.fotoUrl ? (
                                <a href={pkg.fotoUrl} target="_blank" rel="noopener noreferrer" className="block w-10 h-10 rounded-lg overflow-hidden border border-white/10 hover:scale-110 transition">
                                  <img src={pkg.fotoUrl} alt="Pacote" className="w-full h-full object-cover" />
                                </a>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>{(pkg as any).nfNumero || "-"}</TableCell>
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
                  </div>
                </div>
              )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="history">
              <SectionCard noPadding>
                {history.length === 0 ? (
                  <EmptyState
                    icon={History}
                    title="Nenhuma encomenda retirada"
                    description="As encomendas retiradas aparecerão no histórico."
                  />
                ) : (
                  <div className="overflow-x-auto w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          
                          {isOperador && <TableHead>Unidade</TableHead>}
                          <TableHead>Transportadora</TableHead>
                          <TableHead>Foto</TableHead>
                            <TableHead>NF</TableHead>
                            <TableHead>Retirada</TableHead>
                          <TableHead className="hidden md:table-cell">Retirada por</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyFiltered.map((pkg) => (
                          <TableRow key={pkg.id}>
                            
                             {isOperador && (
                                  <TableCell>
                                      {pkg.blocoId ? `Bloco ${pkg.blocoId} • ` : ""}
                                      {pkg.unidadeId || "-"}
                                  </TableCell>
                             )}
                            <TableCell>{pkg.transportadora || "-"}</TableCell>
                            <TableCell>
                              {pkg.fotoUrl ? (
                                <a href={pkg.fotoUrl} target="_blank" rel="noopener noreferrer" className="block w-10 h-10 rounded-lg overflow-hidden border border-white/10 hover:scale-110 transition">
                                  <img src={pkg.fotoUrl} alt="Pacote" className="w-full h-full object-cover" />
                                </a>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>{(pkg as any).nfNumero || "-"}</TableCell>
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
                                title={
    "Registrado por: " + ((pkg as any).registradoPorNome || (pkg as any).criadoPorEmail || (pkg as any).criadoPorUid || "-") +
    " • Retirada confirmada por: " + ((pkg as any).retiradoPorNome || (pkg as any).registradoPorNome || "-")
  }
                              >
                                <Info
      className="h-4 w-4 opacity-70 cursor-pointer"
      onClick={() => openInfo(pkg)}
    />
                              </span>
                            </div>
                          </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </SectionCard>
            </TabsContent>
          </Tabs>

          
            {/* INFO_DIALOG_START */}
            <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
              <DialogContent className="sm:max-w-[520px] tc-dialog-center">
                <DialogHeader>
                  <DialogTitle>Detalhes da Encomenda</DialogTitle>
                  <DialogDescription>Informações completas do registro.</DialogDescription>
                </DialogHeader>

                <div className="space-y-3 text-sm">
                  <div className="rounded-lg border bg-card p-3">
                    <div className="text-xs text-muted-foreground">Unidade</div>
                    <div className="font-medium">
                      {(infoPkg?.blocoId ? ("Bloco " + infoPkg.blocoId + " • ") : "") + (infoPkg?.unidadeId || "-")}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border bg-card p-3">
                      <div className="text-xs text-muted-foreground">Transportadora</div>
                      <div className="font-medium">{infoPkg?.transportadora || "-"}</div>
                    </div>

                    <div className="rounded-lg border bg-card p-3">
                      <div className="text-xs text-muted-foreground">NF</div>
                      <div className="font-medium">{infoPkg?.nfNumero || "-"}</div>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-card p-3">
                    <div className="text-xs text-muted-foreground">Registrado por</div>
                    <div className="font-medium">
                      {infoPkg?.criadoPorNome || infoPkg?.criadoPorEmail || infoPkg?.criadoPorUid || "-"}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-card p-3">
                    <div className="text-xs text-muted-foreground">Chegada</div>
                    <div className="font-medium">{fmtTS(infoPkg?.chegouEm)}</div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" onClick={() => setInfoOpen(false)}>Fechar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {/* INFO_DIALOG_END */}
<Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
            <DialogContent className="tc-dialog-center">
                <DialogHeader>
                    <DialogTitle>Código de Retirada</DialogTitle>
                    <DialogDescription>
                        Apresente este código ou QR code na portaria para retirar sua encomenda.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center p-4">
                    {qrCodeUrl ? (
                        <img
                          src={qrCodeUrl}
                          alt="QR Code"
                          className="w-[220px] max-w-full rounded-lg border border-cyan-500/20 bg-white p-2"
                        />
                      ) : (
                        <div className="w-[220px] max-w-full rounded-lg border border-cyan-500/20 bg-slate-900/55 p-6 text-center text-sm text-slate-300 backdrop-blur-xl shadow-[0_0_40px_rgba(0,208,230,0.12)]">
                          Gerando QR Code...
                        </div>
                      )}
                    <code className="mt-4 text-lg font-bold tracking-wider">{selectedPkgForQr?.codigo}</code>
                </div>
                <DialogFooter>
                    <Button onClick={() => setIsQrDialogOpen(false)}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={openRetirar} onOpenChange={setOpenRetirar}>
            <DialogContent className="sm:max-w-[520px] tc-dialog-center">
              <DialogHeader>
                <DialogTitle>Registrar Retirada</DialogTitle>
                <DialogDescription>
                  Unidade: {retirarEncomenda?.unidadeId}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="flex items-center justify-between rounded-lg border bg-card p-3 shadow-[0_0_40px_rgba(0,208,230,0.12)]">
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
  <>
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

    <div className="space-y-3 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Leitor de QR (Porteiro)</div>
          <div className="text-xs text-muted-foreground">Aponte a câmera para o QR Code da encomenda.</div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => setScanOpen((v) => !v)}
        >
          {scanOpen ? "Fechar câmera" : "Abrir câmera"}
        </Button>
      </div>

      {scanOpen && (
        <div className="rounded-xl border bg-black/5 p-2">
          <QrScanner
            onResult={(text) => {
              const t = String(text || "").trim();
              if (!t) return;
              setCodigoInput(t);
              setScanOpen(false);
            }}
            onError={(e) => console.warn("[QrScanner]", e)}
          />
        </div>
      )}
    </div>
  </>
)}
{retirarError && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                        <p className="font-bold">Erro</p>
                        <p>{retirarError}</p>
                        {retirarError.includes("bloqueado") && (
                        <Link href="/configuracoes" className="mt-2 inline-block font-bold underline hover:text-red-700">
                            Ir para Configurações para redefinir o PIN
                        </Link>
                        )}
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

          {/* DIALOG BATCH QR MORADOR */}
          <Dialog open={isBatchQrDialogOpen} onOpenChange={setIsBatchQrDialogOpen}>
            <DialogContent className="tc-dialog-center">
              <DialogHeader>
                <DialogTitle>Retirada em Lote por QR Code</DialogTitle>
                <DialogDescription>
                  Apresente este QR Code na portaria para retirar todas as suas encomendas pendentes de uma vez.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center p-4">
                {batchQrCodeUrl ? (
                  <img
                    src={batchQrCodeUrl}
                    alt="QR Code Lote"
                    className="w-[220px] max-w-full rounded-lg border border-cyan-500/20 bg-white p-2"
                  />
                ) : (
                  <div className="w-[220px] max-w-full rounded-lg border border-cyan-500/20 bg-slate-900/55 p-6 text-center text-sm text-slate-300 backdrop-blur-xl shadow-[0_0_40px_rgba(0,208,230,0.12)]">
                    Gerando QR Code...
                  </div>
                )}
                <code className="mt-4 text-lg font-bold tracking-wider text-white">{batchToken}</code>
                {batchExpiraEm && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Válido até <span className="font-semibold text-cyan-400">{batchExpiraEm}</span> de hoje.
                  </p>
                )}
                <div className="mt-4 w-full border-t border-cyan-500/10 pt-3">
                  <p className="text-xs font-semibold text-slate-300 mb-2">Encomendas inclusas ({waiting.length}):</p>
                  <div className="max-h-[150px] overflow-y-auto space-y-2 text-xs text-muted-foreground">
                    {waiting.map((pkg) => (
                      <div key={pkg.id} className="flex justify-between items-center bg-slate-950/20 p-2 rounded-lg border border-cyan-500/5">
                        <span>{pkg.transportadora}</span>
                        <span className="font-mono text-cyan-400">{pkg.codigo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsBatchQrDialogOpen(false)}>Fechar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* DIALOG RETIRADA LOTE PORTARIA */}
          <Dialog open={openRetirarLote} onOpenChange={(v) => {
            setOpenRetirarLote(v);
            if (!v) setScanLoteOpen(false);
          }}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-[550px] max-h-[90vh] overflow-y-auto tc-dialog-center">
              <DialogHeader>
                <DialogTitle>Retirada por QR Code / Código</DialogTitle>
                <DialogDescription>
                  Escaneie o QR Code ou digite o código de retirada (PKG-... ou LOTE-...) apresentado pelo morador.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* Campo de Código e Botão de Validação */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: LOTE-ABC12345 ou PKG-XYZ12345"
                    value={codigoBuscaRetirada}
                    onChange={(e) => setCodigoBuscaRetirada(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleValidarLote();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => handleValidarLote()}
                    disabled={loadingValidarLote || !codigoBuscaRetirada.trim()}
                  >
                    {loadingValidarLote ? "Validando..." : "Validar"}
                  </Button>
                </div>

                {/* Leitor de Câmera */}
                <div className="space-y-3 rounded-xl border bg-card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Usar Câmera (Leitor de QR)</div>
                      <div className="text-xs text-muted-foreground">Aponte a câmera para o QR Code apresentado.</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setScanLoteOpen((v) => !v)}
                    >
                      {scanLoteOpen ? "Fechar câmera" : "Abrir câmera"}
                    </Button>
                  </div>

                  {scanLoteOpen && (
                    <div className="rounded-xl border bg-black/5 p-2">
                      <QrScanner
                        onResult={(text) => {
                          const t = String(text || "").trim();
                          if (!t) return;
                          setCodigoBuscaRetirada(t);
                          setScanLoteOpen(false);
                          handleValidarLote(t);
                        }}
                        onError={(e) => console.warn("[QrScanner Lote]", e)}
                      />
                    </div>
                  )}
                </div>

                {/* Erro de Validação */}
                {validatingLoteError && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive font-semibold">
                    {validatingLoteError}
                  </div>
                )}

                {/* Resultado da Validação */}
                {validatedLote && (
                  <div className="space-y-4 rounded-xl border bg-card p-4">
                    <div className="border-b pb-2">
                      <h4 className="font-semibold text-sm">
                        Unidade: <span className="text-primary font-bold">{validatedLote.blocoId ? `Bloco ${validatedLote.blocoId} • ` : ""}{validatedLote.unidadeId}</span>
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tipo de Código: <span className="font-semibold text-primary">{validatedLote.tipo === "LOTE" ? "Lote (Múltiplas Encomendas)" : "Individual (Única)"}</span>
                      </p>
                    </div>

                    {/* Lista de Encomendas para Seleção */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-300">Selecione as encomendas que estão sendo retiradas:</p>
                      <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1">
                        {validatedLote.encomendas.map((enc: any) => {
                          const isChecked = loteSelectedIds.has(enc.id);
                          return (
                            <label
                              key={enc.id}
                              className="flex items-start gap-3 p-2.5 rounded-lg border border-cyan-500/10 bg-slate-950/20 hover:bg-slate-950/40 transition cursor-pointer font-normal"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                className="mt-1 h-4 w-4 rounded border-cyan-500/20 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                                onChange={() => {
                                  const next = new Set(loteSelectedIds);
                                  if (isChecked) {
                                    next.delete(enc.id);
                                  } else {
                                    next.add(enc.id);
                                  }
                                  setLoteSelectedIds(next);
                                }}
                              />
                              <div className="flex-1 text-xs">
                                <div className="flex justify-between font-semibold text-slate-200">
                                  <span>{enc.transportadora || "-"}</span>
                                  <span className="font-mono text-cyan-400">{enc.codigo || "-"}</span>
                                </div>
                                {enc.nfNumero && enc.nfNumero !== "-" && (
                                  <p className="text-slate-400 mt-0.5">NF: {enc.nfNumero}</p>
                                )}
                                {enc.chegouEm && (
                                  <p className="text-slate-400 mt-0.5">Chegou em: {new Date(enc.chegouEm).toLocaleString("pt-BR")}</p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Nome do Recebedor */}
                    <div className="space-y-1">
                      <Label htmlFor="recebedorLote" className="text-xs">Nome do Recebedor</Label>
                      <Input
                        id="recebedorLote"
                        placeholder="Ex: Próprio morador, Cônjuge, etc."
                        value={recebedorLote}
                        onChange={(e) => setRecebedorLote(e.target.value)}
                        className="h-8 text-xs animate-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenRetirarLote(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleRetirarLoteConfirm}
                  disabled={savingRetirarLote || !validatedLote || loteSelectedIds.size === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {savingRetirarLote ? "Registrando..." : "Confirmar Retirada"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </AppLayout>
  );
}
