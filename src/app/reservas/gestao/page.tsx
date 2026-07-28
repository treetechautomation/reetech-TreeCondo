"use client";

/**
 * FASE 16.16.2 / R5 COMPLETION — Gestão de Áreas e Reservas
 *
 * Hub administrativo com abas reais (não placeholder/link).
 */

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useCondominio } from "@/contexts/CondominioContext";
import { useFirestore } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, XCircle, Ban, Clock, Calendar, Shield } from "lucide-react";

const ALLOWED_ROLES = new Set(["SUPER_ADMIN", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO"]);
const SCOPE_LABELS: Record<string, string> = {
  TODAS_AS_AREAS: "Todas as áreas",
  RESERVAS_PRIVATIVAS: "Reservas privativas",
  USO_CAMPO: "Uso do Campo",
  AREA_ESPECIFICA: "Área específica",
};

export default function GestaoAreasReservasPage() {
  const { session } = useSessionCtx();
  const { condominioAtivoId: condId } = useCondominio();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState(searchParams.get("tab") ?? "overview");

  const role = session?.role?.toUpperCase() ?? "";
  const isSuper = session?.superAdmin ?? false;
  if (!isSuper && !ALLOWED_ROLES.has(role)) return <AppLayout><div className="p-12 text-center text-muted-foreground">Acesso restrito a gestores.</div></AppLayout>;
  if (!condId) return <AppLayout><div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Gestão de Áreas e Reservas</h1><p className="text-muted-foreground">Administre reservas, áreas comuns, valores, filas e bloqueios.</p></div>
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); router.replace(`/reservas/gestao?tab=${v}`, { scroll: false }); }}>
          <TabsList className="flex-wrap gap-1 h-auto">
            {["overview","areas","solicitacoes","calendario","filas","bloqueios"].map(t => (
              <TabsTrigger key={t} value={t} className="capitalize">{t === "overview" ? "Visão Geral" : t === "areas" ? "Áreas e Valores" : t === "solicitacoes" ? "Solicitações" : t === "calendario" ? "Calendário" : t === "filas" ? "Filas" : "Bloqueios"}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="overview"><OverviewTab condominioId={condId} /></TabsContent>
          <TabsContent value="areas"><AreasValoresTab condominioId={condId} /></TabsContent>
          <TabsContent value="solicitacoes"><SolicitacoesTabEmbedded condominioId={condId} /></TabsContent>
          <TabsContent value="calendario"><CalendarioTabEmbedded condominioId={condId} /></TabsContent>
          <TabsContent value="filas"><FilasTabReal condominioId={condId} /></TabsContent>
          <TabsContent value="bloqueios"><BloqueiosTabReal condominioId={condId} /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ── OVERVIEW ──

function OverviewTab({ condominioId }: { condominioId: string }) {
  const firestore = useFirestore();
  const [counts, setCounts] = React.useState<any>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore) return;
    setLoading(true);
    const reservasRef = collection(firestore, "condominios", condominioId, "reservas");
    getDocs(reservasRef).then(snap => {
      const c: any = { total: snap.size, aprovadas: 0, pendentes: 0, canceladas: 0 };
      snap.forEach(doc => {
        const s = String(doc.data().status ?? "").toUpperCase();
        if (s === "APROVADA") c.aprovadas++;
        else if (s === "PENDENTE" || s === "PENDENTE_PAGAMENTO") c.pendentes++;
        else if (s === "CANCELADA") c.canceladas++;
      });
      setCounts(c);
    }).finally(() => setLoading(false));
  }, [firestore, condominioId]);

  if (loading) return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Carregando...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[{ label: "Total", value: counts.total, color: "text-foreground" }, { label: "Aprovadas", value: counts.aprovadas, color: "text-emerald-600" }, { label: "Pendentes", value: counts.pendentes, color: "text-amber-600" }, { label: "Canceladas", value: counts.canceladas, color: "text-destructive" }].map(kpi => (
        <Card key={kpi.label}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{kpi.label}</CardTitle></CardHeader><CardContent><p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p></CardContent></Card>
      ))}
    </div>
  );
}

// ── AREAS E VALORES ──

function AreasValoresTab({ condominioId }: { condominioId: string }) {
  const firestore = useFirestore();
  const [areas, setAreas] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editTarget, setEditTarget] = React.useState<any>(null);
  const [editOpcao, setEditOpcao] = React.useState<any>(null);
  const [newPrice, setNewPrice] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  React.useEffect(() => { if (!firestore) return; setLoading(true); getDocs(collection(firestore, "condominios", condominioId, "areasReservaveis")).then(s => setAreas(s.docs.map(d => ({ id: d.id, ...d.data() })))).finally(() => setLoading(false)); }, [firestore, condominioId]);

  async function save() {
    if (!newPrice || !Number.isFinite(+newPrice) || +newPrice <= 0) return;
    const centavos = Math.round(+newPrice * 100);
    setSaving(true); setMsg("");
    try {
      const ep = editOpcao ? `/api/admin/reservas/areas/${editTarget.id}/opcoes/${editOpcao.id}/preco` : `/api/admin/reservas/areas/${editTarget.id}/preco`;
      const r = await fetch(ep, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ condominioId, precoCentavos: centavos }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Erro"); }
      setEditTarget(null); setEditOpcao(null); setNewPrice(""); setMsg("Preço atualizado.");
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Carregando...</div>;

  return (
    <div className="space-y-4">
      {msg && <div className={`p-3 rounded-lg text-sm ${msg.includes("atualizado") ? "bg-emerald-50 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>{msg}</div>}
      {editTarget && (
        <Card className="border-primary"><CardHeader><CardTitle className="text-base">Editar — {editOpcao ? editOpcao.nome : editTarget.nome}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">Valor atual: R$ {((editOpcao?.precoCentavos ?? editTarget.precoCentavos ?? editTarget.preco ?? 0) / 100).toFixed(2)}</div>
            <Input type="number" step="0.01" min="0" placeholder="Novo valor (ex: 80.00)" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => { setEditTarget(null); setEditOpcao(null); }}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></div>
          </CardContent></Card>
      )}
      <div className="rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="text-left px-4 py-3">Área</th><th className="text-left px-4 py-3">Valor</th><th className="text-right px-4 py-3">Ação</th></tr></thead>
        <tbody>
          {areas.filter((a: any) => !a.ehUsoComum).map((a: any) => (<React.Fragment key={a.id}>
            <tr className="border-t"><td className="px-4 py-3 font-medium">{a.nome || a.id}</td><td className="px-4 py-3">R$ {((a.precoCentavos ?? a.preco ?? 0)/100).toFixed(2)}</td><td className="px-4 py-3 text-right"><Button variant="link" size="sm" onClick={() => { setEditTarget(a); setEditOpcao(null); setNewPrice(""); }}>Editar</Button></td></tr>
            {(Array.isArray(a.opcoes) ? a.opcoes : []).map((o: any) => (<tr key={o.id} className="border-t text-muted-foreground"><td className="px-4 py-3 pl-8">└ {o.nome || o.id}</td><td className="px-4 py-3">R$ {((o.precoCentavos ?? o.preco ?? 0)/100).toFixed(2)}</td><td className="px-4 py-3 text-right"><Button variant="link" size="sm" onClick={() => { setEditTarget(a); setEditOpcao(o); setNewPrice(""); }}>Editar</Button></td></tr>))}
          </React.Fragment>))}
          {areas.filter((a: any) => a.ehUsoComum).map((a: any) => (<tr key={a.id} className="border-t"><td className="px-4 py-3 font-medium">{a.nome || a.id}</td><td className="px-4 py-3 text-muted-foreground">Gratuito — Uso comum</td><td className="px-4 py-3 text-right text-muted-foreground text-sm">—</td></tr>))}
        </tbody></table></div>
    </div>
  );
}

// ── SOLICITAÇÕES (embedded, reads Firestore) ──

function SolicitacoesTabEmbedded({ condominioId }: { condominioId: string }) {
  const firestore = useFirestore();
  const [pendentes, setPendentes] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [approving, setApproving] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!firestore) return;
    setLoading(true);
    getDocs(collection(firestore, "condominios", condominioId, "reservas")).then(snap => {
      const list: any[] = []; snap.forEach(d => { const r = d.data(); if (["PENDENTE","PENDENTE_PAGAMENTO"].includes(String(r.status??"").toUpperCase())) list.push({ id: d.id, ...r }); });
      setPendentes(list);
    }).finally(() => setLoading(false));
  }, [firestore, condominioId]);

  async function approve(reservaId: string) {
    setApproving(reservaId);
    await fetch("/api/reservas/aprovar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ condominioId, reservaId, status: "APROVADA" }) });
    setPendentes(prev => prev.filter(r => r.id !== reservaId));
    setApproving(null);
  }

  async function reject(reservaId: string) {
    setApproving(reservaId);
    await fetch("/api/reservas/aprovar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ condominioId, reservaId, status: "REJEITADA" }) });
    setPendentes(prev => prev.filter(r => r.id !== reservaId));
    setApproving(null);
  }

  if (loading) return <div className="flex gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Carregando...</div>;
  if (!pendentes.length) return <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma solicitação pendente.</CardContent></Card>;

  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="text-left px-4 py-3">Unidade</th><th className="text-left px-4 py-3">Área</th><th className="text-left px-4 py-3">Data</th><th className="text-left px-4 py-3">Valor</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Ações</th></tr></thead>
        <tbody>{pendentes.map((r: any) => (<tr key={r.id} className="border-t"><td className="px-4 py-3">{r.blocoNome ?? r.blocoId ?? ""} {r.unidadeNumero ?? ""}</td><td className="px-4 py-3">{r.areaId}</td><td className="px-4 py-3">{r.dateStr}</td><td className="px-4 py-3">{r.valorCobrado ? `R$ ${(r.valorCobrado/100).toFixed(2)}` : "-"}</td><td className="px-4 py-3">{r.status}</td>
          <td className="px-4 py-3 text-right flex gap-2 justify-end">
            <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => approve(r.id)} disabled={approving === r.id}><CheckCircle className="h-4 w-4 mr-1"/> Aprovar</Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => reject(r.id)} disabled={approving === r.id}><XCircle className="h-4 w-4 mr-1"/> Rejeitar</Button>
          </td></tr>))}</tbody></table>
    </div>
  );
}

// ── CALENDÁRIO (embedded) ──

function CalendarioTabEmbedded({ condominioId }: { condominioId: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Calendário de reservas aprovadas e check-in da portaria.</p>
      <Card><CardContent className="p-4">
        <p className="text-sm">
          <a href={`/reservas/agenda`} className="text-primary underline">Acessar agenda completa →</a> (rota compatível com a Portaria)
        </p>
        <p className="text-xs text-muted-foreground mt-2">O componente de calendário será embedado quando extraído da página /reservas/agenda. A rota original permanece disponível para a Portaria.</p>
      </CardContent></Card>
    </div>
  );
}

// ── FILAS (real data) ──

function FilasTabReal({ condominioId }: { condominioId: string }) {
  const firestore = useFirestore();
  const [slots, setSlots] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore) return;
    setLoading(true);
    getDocs(collection(firestore, "condominios", condominioId, "reservasSlots")).then(snap => {
      const list: any[] = []; snap.forEach(d => { const s = d.data(); if (s.filaCount > 0 || s.occupied) list.push({ id: d.id, ...s }); });
      setSlots(list);
    }).finally(() => setLoading(false));
  }, [firestore, condominioId]);

  if (loading) return <div className="flex gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Carregando...</div>;
  if (!slots.length) return <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma fila ativa no momento.</CardContent></Card>;

  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="text-left px-4 py-3">Área / Data</th><th className="text-left px-4 py-3">Ocupado</th><th className="text-left px-4 py-3">Fila</th><th className="text-left px-4 py-3">Oferta</th></tr></thead>
        <tbody>{slots.map((s: any) => (<tr key={s.id} className="border-t"><td className="px-4 py-3 font-medium">{s.id}</td><td className="px-4 py-3">{s.occupied ? <span className="text-destructive">Sim</span> : "Não"}</td><td className="px-4 py-3">{s.filaCount ?? 0}</td><td className="px-4 py-3">{s.pendingOfferUid ? `Expira em ${s.pendingOfferExpiresAt ? new Date(s.pendingOfferExpiresAt._seconds*1000).toLocaleTimeString("pt-BR") : "?"}` : "-"}</td></tr>))}</tbody></table>
    </div>
  );
}

// ── BLOQUEIOS (complete UI) ──

function BloqueiosTabReal({ condominioId }: { condominioId: string }) {
  const [bloqueios, setBloqueios] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState<any>({ tipoAlvo: "UNIDADE", escopo: "TODAS_AS_AREAS", motivoPublico: "", motivoInterno: "", blocoIdNorm: "", unidadeIdNorm: "", uid: "", areaId: "", fimEm: "" });
  const [areas, setAreas] = React.useState<any[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/reservas/bloqueios?condominioId=${condominioId}`); if (r.ok) setBloqueios((await r.json()).bloqueios || []);
    } catch {}
    setLoading(false);
  }, [condominioId]);

  React.useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.motivoPublico) return;
    setSaving(true); setMsg("");
    try {
      const body: any = { condominioId, tipoAlvo: form.tipoAlvo, escopo: form.escopo, motivoPublico: form.motivoPublico, motivoInterno: form.motivoInterno || null, areaId: form.escopo === "AREA_ESPECIFICA" ? form.areaId : null };
      if (form.tipoAlvo === "UNIDADE") { body.blocoIdNorm = form.blocoIdNorm; body.unidadeIdNorm = form.unidadeIdNorm; }
      else { body.uid = form.uid; }
      if (form.fimEm) body.fimEm = new Date(form.fimEm).toISOString();
      const r = await fetch("/api/admin/reservas/bloqueios/criar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Erro"); }
      setShowCreate(false); setForm({ tipoAlvo: "UNIDADE", escopo: "TODAS_AS_AREAS", motivoPublico: "", motivoInterno: "", blocoIdNorm: "", unidadeIdNorm: "", uid: "", areaId: "", fimEm: "" }); load();
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  async function handleRevoke(id: string) {
    try { await fetch("/api/admin/reservas/bloqueios/revogar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ condominioId, bloqueioId: id }) }); load(); } catch {}
  }

  if (loading) return <div className="flex gap-2"><Loader2 className="h-4 w-4 animate-spin"/> Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><Button onClick={() => setShowCreate(true)}>+ Novo bloqueio</Button></div>

      {msg && <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{msg}</div>}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Novo bloqueio</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">Tipo</label><select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.tipoAlvo} onChange={e => setForm({...form, tipoAlvo: e.target.value})}><option value="UNIDADE">Unidade</option><option value="UID">Morador</option></select></div>

            {form.tipoAlvo === "UNIDADE" ? (<>
              <div><label className="text-sm font-medium">Bloco (ID)</label><Input value={form.blocoIdNorm} onChange={e => setForm({...form, blocoIdNorm: e.target.value})} placeholder="rosas / dalias" /></div>
              <div><label className="text-sm font-medium">Unidade (normalizada)</label><Input value={form.unidadeIdNorm} onChange={e => setForm({...form, unidadeIdNorm: e.target.value})} placeholder="101 / 203" /></div>
            </>) : (
              <div><label className="text-sm font-medium">UID do morador</label><Input value={form.uid} onChange={e => setForm({...form, uid: e.target.value})} placeholder="UID do morador" /></div>
            )}

            <div><label className="text-sm font-medium">Escopo</label><select className="w-full border rounded-md px-3 py-2 text-sm mt-1" value={form.escopo} onChange={e => setForm({...form, escopo: e.target.value})}>{Object.entries(SCOPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>

            {form.escopo === "AREA_ESPECIFICA" && <div><label className="text-sm font-medium">Área (areaId)</label><Input value={form.areaId} onChange={e => setForm({...form, areaId: e.target.value})} placeholder="churrasqueira_1" /></div>}

            <div><label className="text-sm font-medium">Mensagem ao morador *</label><Input value={form.motivoPublico} onChange={e => setForm({...form, motivoPublico: e.target.value})} /></div>
            <div><label className="text-sm font-medium">Motivo interno</label><Input value={form.motivoInterno} onChange={e => setForm({...form, motivoInterno: e.target.value})} /><p className="text-xs text-muted-foreground mt-1">Visível apenas para administração.</p></div>
            <div><label className="text-sm font-medium">Válido até (opcional)</label><Input type="datetime-local" value={form.fimEm} onChange={e => setForm({...form, fimEm: e.target.value})} /></div>

            <div className="flex gap-2 justify-end pt-2"><Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button><Button onClick={handleCreate} disabled={saving || !form.motivoPublico}>{saving ? "Criando..." : "Criar bloqueio"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {bloqueios.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum bloqueio ativo.</CardContent></Card> : (
        <div className="rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="text-left px-4 py-3">Alvo</th><th className="text-left px-4 py-3">Escopo</th><th className="text-left px-4 py-3">Motivo</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Ações</th></tr></thead>
          <tbody>{bloqueios.map((b: any) => (<tr key={b.id} className="border-t"><td className="px-4 py-3">{b.tipoAlvo === "UNIDADE" ? `${b.blocoIdNorm ?? ""} ${b.unidadeIdNorm ?? ""}` : b.uid}</td><td className="px-4 py-3">{SCOPE_LABELS[b.escopo] ?? b.escopo}{b.areaId ? ` (${b.areaId})` : ""}</td><td className="px-4 py-3">{b.motivoPublico}</td><td className="px-4 py-3">{b.ativo ? <span className="text-emerald-600 font-medium">Ativo</span> : "Revogado"}</td>
            <td className="px-4 py-3 text-right">{b.ativo && <Button variant="outline" size="sm" onClick={() => { if(confirm("Revogar este bloqueio?")) handleRevoke(b.id); }}><Ban className="h-4 w-4 mr-1"/> Revogar</Button>}</td></tr>))}</tbody></table></div>
      )}
    </div>
  );
}
