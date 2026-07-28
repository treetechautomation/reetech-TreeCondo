
"use client";

import * as React from "react";
import { Plus, Eye, Check, X, LogIn, LogOut, Trash2, Ban
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { SectionCard } from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, } from "@/components/ui/dialog";

import { useToast } from "@/hooks/use-toast";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import { getAuth } from "firebase/auth";

import {
  addDoc, getDoc, collection, onSnapshot, orderBy, query, serverTimestamp, Timestamp, where, doc, deleteDoc } from "firebase/firestore";

type TipoAcesso = "VISITANTE" | "PRESTADOR";
type StatusAcesso = "PENDENTE" | "AUTORIZADO" | "NEGADO" | "ENTROU" | "SAIU" | "EXPIRADO" | "CANCELADO";

type AcessoItem = {
  id: string;
  tipo: TipoAcesso;
  status: StatusAcesso;

  nome: string;
  documento?: string;
  telefone?: string;
  placa?: string;
  empresa?: string;
  observacao?: string;

  blocoId?: string | null;
  unidadeId?: string | null;
  destinoBlocoTexto?: string | null;
  destinoUnidadeTexto?: string | null;
  
  moradorUid?: string;
  moradorNome?: string;

  janelaInicio?: any; // Timestamp
  janelaFim?: any; // Timestamp

  createdByUid?: string;
  createdByRole?: string;
  createdAt?: any; // Timestamp
  updatedAt?: any; // Timestamp

  autorizadoPorUid?: string;
  autorizadoPorNome?: string;
  autorizadoEm?: any; // Timestamp

  negadoPorUid?: string;
  negadoPorNome?: string;
  negadoEm?: any;

  entradaPorUid?: string;
  entradaPorNome?: string;
  entradaEm?: any; // Timestamp

  saidaPorUid?: string;
  saidaPorNome?: string;
  saidaEm?: any; // Timestamp

  canceladoPorUid?: string;
  canceladoPorNome?: string;
  canceladoEm?: any;
};

function formatDateTimeBR(ts: any) {
  if (!ts?.toDate) return "-";
  const d = ts.toDate() as Date;
  return d.toLocaleString("pt-BR", { dateStyle: 'short', timeStyle: 'short' });
}

function dtLocalNowPlus(hours: number) {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + hours);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:00`;
}

function parseDatetimeLocal(value: string) {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

export default function AcessoPage() {
  const firestore = useFirestore();
  const { session } = useSessionCtx();
  const { toast } = useToast();

  const condominioId = session?.activeCondominioId ?? null;
  const uid = session?.user?.uid ?? null;
  const role = (session?.role ?? "") as string;

  const roleUp = String(role || "").toUpperCase();
  const isPortaria = ["PORTEIRO", "SEGURANCA"].includes(roleUp);
  const isGestor = ["ADMIN", "SINDICO", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(roleUp);
  const isMorador = roleUp === "MORADOR";
  const canOperarPortaria = isPortaria || isGestor;
  const canMoradorAutorizar = isMorador;

  function actorName() {
    return (
      (session as any)?.user?.nome ||
      (session as any)?.user?.displayName ||
      session?.user?.email ||
      "Usuário"
    );
  }

  async function atualizarStatusAcesso(it: AcessoItem, next: StatusAcesso) {
      if (!condominioId) return;

      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Sessão expirada. Faça login novamente.");

        const resp = await fetch("/api/acessos/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            condominioId,
            acessoId: it.id,
            next,
          }),
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data?.ok) {
          throw new Error(String(data?.error || "Falha ao atualizar status do acesso."));
        }

        toast({
          title: "Status atualizado!",
          description: `Novo status: ${next}`,
        });
      } catch (e: any) {
        console.error(e);
        toast({
          variant: "destructive",
          title: "Erro ao atualizar status",
          description: String(e?.message || e),
        });
      }
    }

    const [tab, setTab] = React.useState<"PENDENTE" | "AUTORIZADO" | "ENTROU" | "HISTORICO">("PENDENTE");
  const [loading, setLoading] = React.useState(true);
  const [busca, setBusca] = React.useState("");
  const [tipoBusca, setTipoBusca] = React.useState<"todos" | "nome" | "placa" | "documento" | "unidade">("todos");
  const [itens, setItens] = React.useState<AcessoItem[]>([]);

  // dialogs
  const [openNew, setOpenNew] = React.useState(false);
  const [detailedItem, setDetailedItem] = React.useState<AcessoItem | null>(null);
  
  // form state
  const [tipo, setTipo] = React.useState<TipoAcesso>("VISITANTE");
  const [nome, setNome] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [documento, setDocumento] = React.useState("");
  const [placa, setPlaca] = React.useState("");
  const [empresa, setEmpresa] = React.useState("");
  const [observacao, setObservacao] = React.useState("");
  const [blocoTxt, setBlocoTxt] = React.useState(() => String(((session as any)?.blocoAtivoId || (session as any)?.blocoId || "") ?? ""));
  const [unidadeTxt, setUnidadeTxt] = React.useState(() => String(((session as any)?.unidadeAtivaId || (session as any)?.unidadeId || "") ?? ""));

  // UN.6B: Catalog selects
  const [blocosList, setBlocosList] = React.useState<any[]>([]);
  const [unidadesListAcesso, setUnidadesListAcesso] = React.useState<any[]>([]);
  const [unitDocIdAcesso, setUnitDocIdAcesso] = React.useState("");

  async function loadBlocosForAcesso() {
    if (!condominioId) return;
    try {
      const token = await session?.user?.getIdToken();
      const res = await fetch(`/api/blocos?condominioId=${encodeURIComponent(condominioId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setBlocosList(data.blocos || []);
    } catch { /* ignore */ }
  }
  async function loadUnidadesForAcesso(bid: string) {
    if (!condominioId || !bid) { setUnidadesListAcesso([]); return; }
    try {
      const token = await session?.user?.getIdToken();
      const res = await fetch(`/api/unidades?condominioId=${encodeURIComponent(condominioId)}&blocoId=${encodeURIComponent(bid)}&apenasAtivas=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setUnidadesListAcesso(data.unidades || []);
    } catch { /* ignore */ }
  }
  React.useEffect(() => { if (openNew) loadBlocosForAcesso(); }, [openNew, condominioId]);
  const [janelaInicio, setJanelaInicio] = React.useState(() => dtLocalNowPlus(0));
  const [janelaFim, setJanelaFim] = React.useState(() => dtLocalNowPlus(4));
  const [saving, setSaving] = React.useState(false);
  
  
  // destino automático para morador (vínculo)
  const [vincBlocoId, setVincBlocoId] = React.useState<string | null>(null);
  const [vincUnidadeId, setVincUnidadeId] = React.useState<string | null>(null);
// Form de destino (fallback)
  const [formDestinoBloco, setFormDestinoBloco] = React.useState("");
  const [formDestinoUnidade, setFormDestinoUnidade] = React.useState("");

  const [blocoNome, setBlocoNome] = React.useState<string>("-");
  const [unidadeNome, setUnidadeNome] = React.useState<string>("-");

  const blocoId = (session as any)?.blocoAtivoId ?? (session as any)?.blocoId ?? null;
  const unidadeId = (session as any)?.unidadeAtivaId ?? (session as any)?.unidadeId ?? null;

  React.useEffect(() => {
    if (!firestore || !condominioId || !uid) {
      setItens([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const col = collection(firestore, `condominios/${condominioId}/acessos`);
    const qy = canOperarPortaria
      ? query(col, orderBy("createdAt", "desc"))
      : query(col, where("moradorUid", "==", uid));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as AcessoItem[];

// Ordena no client para evitar índice composto no modo MORADOR
list.sort((a: any, b: any) => {
  const ta = a?.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
  const tb = b?.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
  return tb - ta;
});
        setItens(list);
        setLoading(false);
      },
      (err) => {
        console.error("[acesso] erro onSnapshot:", err);
        setItens([]);
        setLoading(false);
        toast({ variant: "destructive", title: "Erro ao carregar acessos", description: String(err?.message || err) });
      }
    );

    return () => unsub();
  }, [firestore, condominioId, uid, canOperarPortaria, toast]);

    

  // carrega vínculo do morador para destino automático
  React.useEffect(() => {
    async function carregarVinculoMorador() {
      if (!firestore || !condominioId || !uid) return;
      const roleUp = String(role || "").toUpperCase();
      if (roleUp !== "MORADOR") return;

      try {
        const ref = doc(firestore, `condominios/${condominioId}/membros/${uid}`);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const data = snap.data() as any;
        setVincBlocoId(data?.blocoId ?? null);
        setVincUnidadeId(data?.unidadeId ?? null);
          setFormDestinoBloco((curr) => curr || String(data?.blocoId ?? ""));
      } catch (e) {
        console.error("[acesso] erro carregar vínculo:", e);
      }
    }

    carregarVinculoMorador();
  }, [firestore, condominioId, uid, role]);

const waiting: AcessoItem[] = [];
const authorized: AcessoItem[] = [];
const inside: AcessoItem[] = [];
const history: AcessoItem[] = [];
const historyStatus: StatusAcesso[] = ["SAIU", "NEGADO", "EXPIRADO", "CANCELADO"];

for (const item of itens) {
  if (item.status === "PENDENTE") waiting.push(item);
  else if (item.status === "AUTORIZADO") authorized.push(item);
  else if (item.status === "ENTROU") inside.push(item);
  else if (historyStatus.includes(item.status)) history.push(item);
}

    const termoBusca = busca.trim().toLowerCase();

    const filtrarBusca = (it: AcessoItem) => {
      if (!termoBusca) return true;

      const nome = String(it.nome || "").toLowerCase();
      const empresa = String(it.empresa || "").toLowerCase();
      const placa = String(it.placa || "").toLowerCase();
      const documentoValor = String(it.documento || "").toLowerCase();
      const telefone = String(it.telefone || "").toLowerCase();
      const bloco = String(it.destinoBlocoTexto || it.blocoId || "").toLowerCase();
      const unidade = String(it.destinoUnidadeTexto || it.unidadeId || "").toLowerCase();

      const geral = [nome, empresa, placa, documentoValor, telefone, bloco, unidade].join(" ");

      if (tipoBusca === "nome") return [nome, empresa].join(" ").includes(termoBusca);
      if (tipoBusca === "placa") return placa.includes(termoBusca);
      if (tipoBusca === "documento") return documentoValor.includes(termoBusca);
      if (tipoBusca === "unidade") return [bloco, unidade].join(" ").includes(termoBusca);

      return geral.includes(termoBusca);
    };

    const waitingFiltered = waiting.filter(filtrarBusca);
    const authorizedFiltered = authorized.filter(filtrarBusca);
    const insideFiltered = inside.filter(filtrarBusca);
    const historyFiltered = history.filter(filtrarBusca);

    

  async function criarAcesso() {
    if (!firestore || !condominioId || !uid) {
      toast({ variant: "destructive", title: "Selecione um condomínio e esteja logado" });
      return;
    }

    const nomeOk = nome.trim();
    if (!nomeOk) {
      toast({ variant: "destructive", title: "Informe o nome" });
      return;
    }
      const roleUpValid = String(role || "").toUpperCase();
      const isMoradorValid = roleUpValid === "MORADOR";
      const isAdminDestinoValid =
        roleUpValid === "ADMIN" ||
        roleUpValid === "ADMIN_CONDOMINIO" ||
        roleUpValid === "SINDICO";

      if (!isAdminDestinoValid && !formDestinoBloco.trim()) {
        toast({ variant: "destructive", title: "Informe o Bloco de destino" });
        return;
      }
      if (!isMoradorValid && !isAdminDestinoValid && !formDestinoUnidade.trim()) {
        toast({ variant: "destructive", title: "Informe a Unidade de destino" });
        return;
      }

const ini = parseDatetimeLocal(janelaInicio);
    const fim = parseDatetimeLocal(janelaFim);

    if (!ini || !fim) {
      toast({ variant: "destructive", title: "Informe a janela (início e fim)" });
      return;
    }
    if (fim.getTime() <= ini.getTime()) {
      toast({ variant: "destructive", title: "Janela inválida", description: "O fim precisa ser depois do início." });
      return;
    }

    try {
      setSaving(true);
      const col = collection(firestore, `condominios/${condominioId}/acessos`);
      
      
        const roleUp = String(role || "").toUpperCase();
        const isMoradorNow = roleUp === "MORADOR";
          const isAdminDestinoNow =
            roleUp === "ADMIN" ||
            roleUp === "ADMIN_CONDOMINIO" ||
            roleUp === "SINDICO";

        // destino automático do vínculo do morador
        const destinoBloco = isAdminDestinoNow
            ? "ADM"
            : (formDestinoBloco.trim() || (isMoradorNow ? (vincBlocoId ?? null) : (blocoId ?? null)));
          const destinoUnidade = isAdminDestinoNow
            ? "Administração"
            : isMoradorNow
              ? (vincUnidadeId ?? null)
              : (formDestinoUnidade.trim() || unidadeId || null);

        if (isMoradorNow) {
          if (!destinoUnidade) {
            toast({ variant: "destructive", title: "Seu vínculo não tem unidade", description: "Defina a unidade do morador no cadastro/membros antes de criar acesso." });
            setSaving(false);
            return;
          }
        }

        const payload: any = {
          tipo,
          status: "PENDENTE",
          nome: nomeOk,

          telefone: telefone.trim() || null,
          documento: documento.trim() || null,
          placa: placa.trim() || null,
          empresa: tipo === "PRESTADOR" ? (empresa.trim() || null) : null,
          observacao: observacao.trim() || null,

          blocoId: destinoBloco,
          unidadeId: destinoUnidade,
          unitDocId: formDestinoUnidade || null, // UN.6B: canonical unit ID

            destinoBlocoTexto: destinoBloco || formDestinoBloco.trim() || null,
            destinoUnidadeTexto: destinoUnidade || formDestinoUnidade.trim() || null,
          moradorUid: uid,
          moradorNome: actorName(),
          janelaInicio: Timestamp.fromDate(ini),
          janelaFim: Timestamp.fromDate(fim),
          createdByUid: uid,
          createdByRole: role || "MORADOR",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        // remove chaves null opcionais se quiser (bloco pode ser null)
        // mas evita undefined (Firestore não aceita)
        Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          throw new Error("Usuário sem token de autenticação.");
        }

        const resp = await fetch("/api/acessos/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            condominioId,
            tipo,
            nome: nomeOk,
            telefone: telefone.trim() || null,
            documento: documento.trim() || null,
            placa: placa.trim() || null,
            empresa: tipo === "PRESTADOR" ? (empresa.trim() || null) : null,
            observacao: observacao.trim() || null,
            blocoId: destinoBloco,
            unidadeId: destinoUnidade,
            destinoBlocoTexto: destinoBloco || formDestinoBloco.trim() || null,
            destinoUnidadeTexto: destinoUnidade || formDestinoUnidade.trim() || null,
            janelaInicio,
            janelaFim,
          }),
        });

        const out = await resp.json().catch(() => ({}));
        if (!resp.ok || !out?.ok) {
          throw new Error(String(out?.error || "Falha ao criar acesso."));
        }

        toast({
          title: "Acesso criado!",
          description: out?.push?.successCount
            ? "Acesso criado e push enviado ao morador."
            : "Acesso criado. Push será enviado quando houver token ativo no app do morador."
        });
        setOpenNew(false);
        // Reset form
        setNome(""); setTipo("VISITANTE"); setTelefone(""); setDocumento(""); setPlaca(""); setEmpresa(""); setObservacao(""); 
        setJanelaInicio(dtLocalNowPlus(0)); setJanelaFim(dtLocalNowPlus(4));
        setFormDestinoBloco(""); setFormDestinoUnidade("");
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Erro ao criar", description: String(e?.message || e) });
    } finally {
      setSaving(false);
    }
  }
  
  async function handleDelete(acessoId: string) {
      if (!firestore || !condominioId) return;
      try {
          const ref = doc(firestore, `condominios/${condominioId}/acessos`, acessoId);
          await deleteDoc(ref);
          toast({title: "Solicitação excluída."});
      } catch (e: any) {
          toast({variant: "destructive", title: "Erro ao excluir", description: e.message});
      }
  }

  const renderTable = (list: AcessoItem[]) => (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-[1fr,220px,160px,220px] px-3 py-2 text-xs font-medium text-muted-foreground border-b">
          <div>Nome</div>
          <div className="text-right">Destino</div>
          <div className="text-right">Janela Fim</div>
          <div className="text-right">Ações</div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
        ) : list.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Nada aqui ainda.</div>
        ) : (
          list.map((it) => (
            <div
              key={it.id}
              className="grid grid-cols-[1fr,220px,160px,220px] items-center px-3 py-4 border-b last:border-b-0"
            >
              <div className="text-sm">
                <div className="font-medium">{it.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {it.tipo} {it.empresa ? `• ${it.empresa}` : ""} {it.placa ? `• ${it.placa}` : ""}
                </div>
              </div>

              <div className="text-right text-sm text-muted-foreground">
                {(it.destinoBlocoTexto || it.blocoId || "-")} • {(it.destinoUnidadeTexto || it.unidadeId || "-")}
              </div>

              <div className="text-right text-sm text-muted-foreground">
                {formatDateTimeBR(it.janelaFim)}
              </div>

              <div className="flex justify-end gap-2">
                <Button
  variant="outline"
  size="icon"
  title="Detalhes"
    onClick={() => setDetailedItem(it)}
  className="border-white/40 bg-white/85 backdrop-blur hover:bg-white shadow-sm group transition-all duration-200 hover:shadow-[0_0_0_1px_rgba(0,208,230,.35),0_8px_30px_rgba(0,208,230,.25)]"
>
  <Eye className="h-4 w-4 text-[#0f172a] group-hover:text-[#00d0e6] transition-colors duration-200" />
</Button>

                {/* Morador pode AUTORIZAR/CANCELAR o próprio enquanto PENDENTE */}
                {isMorador && it.moradorUid === uid && it.status === "PENDENTE" && (
                  <>
                    <Button size="sm" onClick={() => atualizarStatusAcesso(it, "AUTORIZADO")} title="Autorizar">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => atualizarStatusAcesso(it, "CANCELADO")} title="Cancelar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}

                {/* Portaria/Gestor: pode autorizar/negar/entrada/saida */}
                {canOperarPortaria && it.status === "PENDENTE" && (
                  <>
                    <Button size="sm" onClick={() => atualizarStatusAcesso(it, "AUTORIZADO")} title="Autorizar">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => atualizarStatusAcesso(it, "NEGADO")} title="Negar">
                      <Ban className="h-4 w-4" />
                    </Button>
                  </>
                )}

                {canOperarPortaria && it.status === "AUTORIZADO" && (
                  <Button size="sm" onClick={() => atualizarStatusAcesso(it, "ENTROU")} title="Liberar entrada">
                    <LogIn className="mr-2 h-4 w-4" />
                    Entrada
                  </Button>
                )}

                {canOperarPortaria && it.status === "ENTROU" && (
                  <Button
size="sm"
variant="outline"
onClick={() => atualizarStatusAcesso(it, "SAIU")}
title="Liberar saída"
className="text-slate-900 border-white/40 bg-white/90 hover:bg-white"
>
                    <LogOut className="mr-2 h-4 w-4" />
                    Saída
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
  return (
    <AppLayout pageTitle="Acesso" headerActions={<Dialog open={openNew} onOpenChange={setOpenNew}><DialogTrigger asChild><Button size="sm" disabled={!condominioId || !uid || isPortaria} title={isPortaria ? "Apenas gestores e moradores podem criar autorizações" : "Novo Acesso"}><Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Novo Acesso</span></Button></DialogTrigger><DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto max-h-[85dvh] overflow-y-auto tc-dialog-center"><DialogHeader><DialogTitle>Novo Acesso</DialogTitle><DialogDescription>Pré-autorização para <b>Visitante</b> ou <b>Prestador</b>.</DialogDescription></DialogHeader><div className="grid gap-4 py-2">
      <div className="grid gap-1"><Label>Tipo</Label><select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value as TipoAcesso)}><option value="VISITANTE">Visitante</option><option value="PRESTADOR">Prestador</option></select></div>
      
       <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
               <div className="grid gap-1">
                 <Label htmlFor="form-bloco">Bloco de Destino</Label>
                 {role && String(role).toUpperCase() !== "MORADOR" ? (
                   <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" 
                     value={formDestinoBloco} 
                     onChange={(e) => { setFormDestinoBloco(e.target.value); loadUnidadesForAcesso(e.target.value); }}>
                     <option value="">Selecione o bloco</option>
                     {(blocosList || []).filter((b: any) => b.ativo && (!b.isSistema || (blocosList||[]).length > 1)).map((b: any) => (
                       <option key={b.id} value={b.id}>{b.nome}</option>
                     ))}
                   </select>
                 ) : String(role || "").toUpperCase() === "MORADOR" ? (
                   <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                     {vincBlocoId || blocoId || "-"}
                   </div>
                 ) : (
                   <Input id="form-bloco" value={formDestinoBloco} onChange={(e) => setFormDestinoBloco(e.target.value)} placeholder="Ex: Bloco A" />
                 )}
               </div>

               {String(role || "").toUpperCase() === "MORADOR" ? (
                 <div className="grid gap-1">
                   <Label>Unidade de Destino</Label>
                   <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                     {vincUnidadeId || unidadeId || formDestinoUnidade || "-"}
                   </div>
                 </div>
                ) : role && String(role).toUpperCase() !== "MORADOR" ? (
                 <div className="grid gap-1">
                   <Label htmlFor="form-unidade">Unidade de Destino</Label>
                   <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                     value={formDestinoUnidade}
                     onChange={(e) => setFormDestinoUnidade(e.target.value)}
                     disabled={!formDestinoBloco}>
                     <option value="">{!formDestinoBloco ? "Selecione o bloco primeiro" : "Selecione a unidade"}</option>
                     {(unidadesListAcesso || []).map((u: any) => (
                       <option key={u.id} value={u.id}>{u.numero}</option>
                     ))}
                   </select>
                 </div>
               ) : (
                 <div className="grid gap-1">
                  <Label htmlFor="form-unidade">Unidade de Destino</Label>
                  <Input id="form-unidade" value={formDestinoUnidade} onChange={(e) => setFormDestinoUnidade(e.target.value)} placeholder="Ex: 101" />
                </div>
                )}
             </div>

      <div className="grid gap-1"><Label>Nome do Visitante/Prestador</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: João da Silva" /></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="grid gap-1"><Label>Telefone (opcional)</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" /></div><div className="grid gap-1"><Label>Documento (opcional)</Label><Input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="CPF/RG" /></div></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="grid gap-1"><Label>Placa (opcional)</Label><Input value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC-1234" /></div><div className="grid gap-1"><Label>Empresa (prestador) (opcional)</Label><Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Ex: Manutenção Elétrica" disabled={tipo !== "PRESTADOR"} /></div></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="grid gap-1"><Label>Janela - Início</Label><Input type="datetime-local" value={janelaInicio} onChange={(e) => setJanelaInicio(e.target.value)} /></div><div className="grid gap-1"><Label>Janela - Fim</Label><Input type="datetime-local" value={janelaFim} onChange={(e) => setJanelaFim(e.target.value)} /></div></div><div className="grid gap-1"><Label>Observação (opcional)</Label><Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: vai entregar material / vai instalar internet / etc." /></div></div><DialogFooter><Button onClick={criarAcesso} disabled={saving}>{saving ? "Salvando..." : "Criar"}</Button></DialogFooter></DialogContent></Dialog>}>
      <Card className="border-white/20 bg-white/28 backdrop-blur-2xl shadow-[0_18px_55px_rgba(2,6,23,0.12)] tc-acesso-white">
        <CardHeader><CardTitle>Acessos</CardTitle><CardDescription>Pré-autorizações para visitantes e prestadores de serviço.</CardDescription></CardHeader>
        <CardContent>
          {!condominioId ? (
            <div className="p-4 text-sm text-muted-foreground">
              Selecione um condomínio para ver/criar acessos.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl p-3">
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar visitante, prestador, placa, documento, bloco ou unidade..."
                    className="bg-white/80 text-slate-900 placeholder:text-slate-500"
                  />
                  <div className="hidden">
                    <Button
                      type="button"
                      variant={tipoBusca === "todos" ? "default" : "outline"}
                      size="sm"
                      className={tipoBusca === "todos" ? "text-white" : "text-foreground hover:text-foreground"}
                      onClick={() => setTipoBusca("todos")}
                    >
                      Todos
                    </Button>
                    <Button
                      type="button"
                      variant={tipoBusca === "nome" ? "default" : "outline"}
                      size="sm"
                      className={tipoBusca === "nome" ? "text-white" : "text-foreground hover:text-foreground"}
                      onClick={() => setTipoBusca("nome")}
                    >
                      Nome
                    </Button>
                    <Button
                      type="button"
                      variant={tipoBusca === "placa" ? "default" : "outline"}
                      size="sm"
                      className={tipoBusca === "placa" ? "" : "text-foreground hover:text-foreground"}
                      onClick={() => setTipoBusca("placa")}
                    >
                      Placa
                    </Button>
                    <Button
                      type="button"
                      variant={tipoBusca === "documento" ? "default" : "outline"}
                      size="sm"
                      className={tipoBusca === "documento" ? "text-white" : "text-foreground hover:text-foreground"}
                      onClick={() => setTipoBusca("documento")}
                    >
                      Documento
                    </Button>
                    <Button
                      type="button"
                      variant={tipoBusca === "unidade" ? "default" : "outline"}
                      size="sm"
                      className={tipoBusca === "unidade" ? "text-white" : "text-foreground hover:text-foreground"}
                      onClick={() => setTipoBusca("unidade")}
                    >
                      Unidade
                    </Button>
                  </div>
                </div>
              </div>

              <div className="md:hidden space-y-5">
                {[
                  { key: "PENDENTE", title: "Pendentes", items: waitingFiltered },
                  { key: "AUTORIZADO", title: "Autorizados", items: authorizedFiltered },
                  { key: "ENTROU", title: "Dentro do Condomínio", items: insideFiltered },
                  { key: "HISTORICO", title: "Histórico", items: historyFiltered },
                ].map((sec) => (
                  <div key={sec.key} className="rounded-2xl border bg-card shadow-sm">
                    <div className="px-4 py-3 border-b">
                      <div className="text-sm font-semibold">{sec.title}</div>
                      <div className="text-xs text-muted-foreground">{sec.items.length} item(ns)</div>
                    </div>

                    <div className="p-3 space-y-2">
                      {sec.items.length === 0 ? (
                        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                          Nada aqui ainda.
                        </div>
                      ) : (
                        sec.items.map((it) => {
                          const destino =
                            (it.blocoId || it.destinoBlocoTexto || "-") +
                            " / " +
                            (it.unidadeId || it.destinoUnidadeTexto || "-");

                          return (
                            <button
                              key={it.id}
                              type="button"
                              onClick={() => setDetailedItem(it)}
                              className="w-full cursor-pointer rounded-xl border border-black/5 bg-white/45 p-3 text-left transition hover:bg-black/5 active:scale-[0.99]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-slate-900">
                                    {it.nome || "-"}
                                  </div>
                                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                    Destino: {destino}
                                  </div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    Janela fim: {formatDateTimeBR(it.janelaFim)}
                                  </div>
                                </div>
                                <div className="shrink-0">
                                  <span className="inline-flex items-center rounded-full border border-black/10 bg-white/50 px-2 py-1 text-[11px] font-medium text-slate-700">
                                    {it.status}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                  <TabsList className="grid w-full grid-cols-2 gap-2 rounded-2xl border border-black/5 p-2 h-auto md:flex md:flex-wrap md:justify-start md:gap-2 md:w-full lg:flex-nowrap bg-gradient-to-r from-[#B7CD0C]/20 via-[#00D0E6]/20 to-[#F4EFE9]/80 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,.06)] tc-acesso-tabs">
                    <TabsTrigger value="PENDENTE" className="h-10 w-full justify-center rounded-xl px-3 text-sm whitespace-normal leading-tight transition select-none cursor-pointer text-slate-700 hover:bg-[#B7CD0C]/18 hover:text-slate-900 data-[state=active]:bg-[#00D0E6] data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-[0_10px_30px_rgba(0,208,230,.25)] data-[state=active]:border data-[state=active]:border-[#00D0E6]/60">Pendentes</TabsTrigger>
                    <TabsTrigger value="AUTORIZADO" className="h-10 w-full justify-center rounded-xl px-3 text-sm whitespace-normal leading-tight transition select-none cursor-pointer text-slate-700 hover:bg-[#B7CD0C]/18 hover:text-slate-900 data-[state=active]:bg-[#00D0E6] data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-[0_10px_30px_rgba(0,208,230,.25)] data-[state=active]:border data-[state=active]:border-[#00D0E6]/60">Autorizados</TabsTrigger>
                    <TabsTrigger value="ENTROU" className="h-10 w-full justify-center rounded-xl px-3 text-sm whitespace-normal leading-tight transition select-none cursor-pointer text-slate-700 hover:bg-[#B7CD0C]/18 hover:text-slate-900 data-[state=active]:bg-[#00D0E6] data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-[0_10px_30px_rgba(0,208,230,.25)] data-[state=active]:border data-[state=active]:border-[#00D0E6]/60"><span className="lg:hidden">Dentro</span><span className="hidden lg:inline">Dentro do Condomínio</span></TabsTrigger>
                    <TabsTrigger value="HISTORICO" className="h-10 w-full justify-center rounded-xl px-3 text-sm whitespace-normal leading-tight transition select-none cursor-pointer text-slate-700 hover:bg-[#B7CD0C]/18 hover:text-slate-900 data-[state=active]:bg-[#00D0E6] data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-[0_10px_30px_rgba(0,208,230,.25)] data-[state=active]:border data-[state=active]:border-[#00D0E6]/60">Histórico</TabsTrigger>
                  </TabsList>

                  <TabsContent value="PENDENTE" className="mt-4">{renderTable(waitingFiltered)}</TabsContent>
                  <TabsContent value="AUTORIZADO" className="mt-4">{renderTable(authorizedFiltered)}</TabsContent>
                  <TabsContent value="ENTROU" className="mt-4">{renderTable(insideFiltered)}</TabsContent>
                  <TabsContent value="HISTORICO" className="mt-4">{renderTable(historyFiltered)}</TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={!!detailedItem} onOpenChange={(open) => !open && setDetailedItem(null)}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto tc-dialog-center">
            <DialogHeader>
                <DialogTitle>Detalhes do Acesso</DialogTitle>
                <DialogDescription className="sr-only">Informações detalhadas do acesso selecionado.</DialogDescription>
            </DialogHeader>
            {detailedItem && (
                <div className="grid gap-3 text-sm">
                    <div className="flex justify-between"><span>Status:</span> <span className="font-semibold">{detailedItem.status}</span></div>
                    <div className="flex justify-between"><span>Tipo:</span> <span>{detailedItem.tipo}</span></div>
                    <div className="flex justify-between"><span>Nome:</span> <span>{detailedItem.nome}</span></div>
                    <div className="flex justify-between">
                        <span>Destino:</span>
                        <span>{detailedItem.destinoBlocoTexto || detailedItem.blocoId || "-"} / {detailedItem.destinoUnidadeTexto || detailedItem.unidadeId || "-"}</span>
                    </div>
                      <div className="flex justify-between">
                          <span>Janela fim:</span>
                          <span>{formatDateTimeBR(detailedItem.janelaFim)}</span>
                      </div>
                    {detailedItem.telefone && <div className="flex justify-between"><span>Telefone:</span> <span>{detailedItem.telefone}</span></div>}
                    {detailedItem.documento && <div className="flex justify-between"><span>Documento:</span> <span>{detailedItem.documento}</span></div>}
                    {detailedItem.placa && <div className="flex justify-between"><span>Placa:</span> <span>{detailedItem.placa}</span></div>}
                    {detailedItem.empresa && <div className="flex justify-between"><span>Empresa:</span> <span>{detailedItem.empresa}</span></div>}
                    {detailedItem.observacao && <div className="flex justify-between"><span>Obs:</span> <span>{detailedItem.observacao}</span></div>}
                    <div className="border-t pt-2 mt-2 space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between"><span>Solicitado por:</span> <span>{detailedItem.moradorNome}</span></div>
                        <div className="flex justify-between"><span>Em:</span> <span>{formatDateTimeBR(detailedItem.createdAt)}</span></div>
                        {detailedItem.autorizadoEm && <div className="flex justify-between"><span>Autorizado por:</span> <span>{detailedItem.autorizadoPorNome} ({formatDateTimeBR(detailedItem.autorizadoEm)})</span></div>}
                        {detailedItem.entradaEm && <div className="flex justify-between"><span>Entrada por:</span> <span>{detailedItem.entradaPorNome} ({formatDateTimeBR(detailedItem.entradaEm)})</span></div>}
                        {detailedItem.saidaEm && <div className="flex justify-between"><span>Saída por:</span> <span>{detailedItem.saidaPorNome} ({formatDateTimeBR(detailedItem.saidaEm)})</span></div>}
                        {detailedItem.negadoEm && <div className="flex justify-between"><span>Negado por:</span> <span>{detailedItem.negadoPorNome} ({formatDateTimeBR(detailedItem.negadoEm)})</span></div>}
                        {detailedItem.canceladoEm && <div className="flex justify-between"><span>Cancelado por:</span> <span>{detailedItem.canceladoPorNome} ({formatDateTimeBR(detailedItem.canceladoEm)})</span></div>}
                    </div>
                
                      {/* Ações rápidas */}
                      <div className="border-t pt-3 mt-2">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Ações</div>
                        <div className="flex flex-wrap gap-2">
                          {detailedItem.status === "PENDENTE" && (canOperarPortaria || canMoradorAutorizar) && (
                            <>
                              <Button size="sm" onClick={() => atualizarStatusAcesso(detailedItem, "AUTORIZADO")}>
                                <Check className="h-4 w-4 mr-2" /> Autorizar
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => atualizarStatusAcesso(detailedItem, "NEGADO")}>
                                <X className="h-4 w-4 mr-2" /> Negar
                              </Button>
                            </>
                          )}

                          {detailedItem.status === "AUTORIZADO" && canOperarPortaria && (
                            <>
                              <Button size="sm" onClick={() => atualizarStatusAcesso(detailedItem, "ENTROU")}>
                                <LogIn className="h-4 w-4 mr-2" /> Entrada
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => atualizarStatusAcesso(detailedItem, "CANCELADO")}>
                                <Ban className="h-4 w-4 mr-2" /> Cancelar
                              </Button>
                            </>
                          )}

                          {detailedItem.status === "ENTROU" && canOperarPortaria && (
                            <Button size="sm" onClick={() => atualizarStatusAcesso(detailedItem, "SAIU")}>
                              <LogOut className="h-4 w-4 mr-2" /> Saída
                            </Button>
                          )}
                        </div>
                      </div>
</div>
            )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
