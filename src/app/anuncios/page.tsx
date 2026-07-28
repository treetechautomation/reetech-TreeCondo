"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { SectionCard } from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { useSession } from "@/hooks/useSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PlusCircle, Megaphone, Pencil, Archive, RotateCcw } from "lucide-react";

type Anuncio = {
  id: string;
  titulo: string;
  mensagem: string;
  status?: string;
  targetScope?: string;
  targetBlocoId?: string | null;
  targetBlocoNome?: string | null;
  publishAt?: any;
  publishedAt?: any;
  expiresAt?: any;
  archivedAt?: any;
  createdAt?: any;
  updatedAt?: any;
};

const MANAGERS = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

function isExpired(a: Anuncio): boolean {
  if (!a.expiresAt) return false;
  try {
    const d = a.expiresAt.toDate ? a.expiresAt.toDate() : new Date(a.expiresAt._seconds * 1000);
    return d <= new Date();
  } catch { return false; }
}

function statusLabel(a: Anuncio): string {
  if (a.status === "RASCUNHO") return "Rascunho";
  if (a.status === "AGENDADO") return "Agendado";
  if (a.status === "ARQUIVADO") return "Arquivado";
  if (a.status === "PUBLICADO" || !a.status) {
    if (isExpired(a)) return "Expirado";
    return "Publicado";
  }
  return a.status || "Publicado";
}

function statusTone(s: string) {
  switch (s) {
    case "PUBLICADO": return "success" as const;
    case "AGENDADO": return "info" as const;
    case "RASCUNHO": return "neutral" as const;
    case "ARQUIVADO":
    case "EXPIRADO": return "neutral" as const;
    default: return "neutral" as const;
  }
}

export default function AnunciosPage() {
  const { session } = useSession();
  const role = String(session?.role || "").toUpperCase();
  const isManager = MANAGERS.includes(role) || (session as any)?.super_admin;
  const condominioId = session?.activeCondominioId ?? null;

  const [anuncios, setAnuncios] = React.useState<Anuncio[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Anuncio | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Form state
  const [titulo, setTitulo] = React.useState("");
  const [mensagem, setMensagem] = React.useState("");
  const [targetScope, setTargetScope] = React.useState("CONDOMINIO");
  const [targetBlocoId, setTargetBlocoId] = React.useState("");
  const [publishMode, setPublishMode] = React.useState("now");
  const [publishAtDate, setPublishAtDate] = React.useState("");
  const [expiresAtDate, setExpiresAtDate] = React.useState("");
  const [blocosList, setBlocosList] = React.useState<{ id: string; nome: string }[]>([]);

  async function getToken() { return await session?.user?.getIdToken(); }

  async function load() {
    if (!condominioId) { setLoading(false); return; }
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/anuncios?condominioId=${encodeURIComponent(condominioId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setAnuncios(data.anuncios || []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function loadBlocos() {
    if (!condominioId || !isManager) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/blocos?condominioId=${encodeURIComponent(condominioId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setBlocosList((data.blocos || []).filter((b: any) => b.ativo));
    } catch { /* ignore */ }
  }

  React.useEffect(() => { load(); }, [condominioId]);
  React.useEffect(() => { if (dialogOpen) loadBlocos(); }, [dialogOpen, condominioId]);
  const [analyticsData, setAnalyticsData] = React.useState<any>(null);
  const [analyticsDialog, setAnalyticsDialog] = React.useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = React.useState(false);
  const readSetRef = React.useRef<Set<string>>(new Set());

  async function loadAnalytics(anuncioId: string) {
    setLoadingAnalytics(true);
    try {
      const t = await getToken();
      const res = await fetch(`/api/anuncios/${anuncioId}/analytics?condominioId=${encodeURIComponent(condominioId!)}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      if (data.ok) setAnalyticsData(data);
    } catch { /* ignore */ }
    setLoadingAnalytics(false);
    setAnalyticsDialog(true);
  }

  function openCreate() {
    setEditing(null);
    setTitulo(""); setMensagem("");
    setTargetScope("CONDOMINIO"); setTargetBlocoId("");
    setPublishMode("now"); setPublishAtDate(""); setExpiresAtDate("");
    setDialogOpen(true);
  }

  function openEdit(a: Anuncio) {
    setEditing(a);
    setTitulo(a.titulo || ""); setMensagem(a.mensagem || "");
    setTargetScope(a.targetScope || "CONDOMINIO"); setTargetBlocoId(a.targetBlocoId || "");
    setPublishMode(a.status === "AGENDADO" ? "scheduled" : (a.status === "RASCUNHO" ? "draft" : "now"));
    setPublishAtDate(""); setExpiresAtDate("");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!titulo.trim() || !mensagem.trim()) return;
    setSaving(true);
    const token = await getToken();
    const body: any = {
      condominioId,
      titulo: titulo.trim(), mensagem: mensagem.trim(),
      targetScope, targetBlocoId: targetScope === "BLOCO" ? targetBlocoId : null,
    };

    if (publishMode === "now") body.status = "PUBLICADO";
    else if (publishMode === "scheduled") { body.status = "AGENDADO"; body.publishAt = publishAtDate || undefined; }
    else body.status = "RASCUNHO";

    if (expiresAtDate) body.expiresAt = expiresAtDate;

    let res: Response;
    if (editing) {
      res = await fetch(`/api/anuncios/${editing.id}`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch("/api/anuncios", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    const data = await res.json();
    if (data.ok) { setDialogOpen(false); load(); }
    else alert(data.error || "Erro ao salvar.");
    setSaving(false);
  }

  async function handleArchive(a: Anuncio) {
    if (!confirm(`Arquivar "${a.titulo}"?`)) return;
    const token = await getToken();
    const res = await fetch(`/api/anuncios/${a.id}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ condominioId, action: "archive" }),
    });
    const data = await res.json();
    if (data.ok) load();
    else alert(data.error);
  }

  async function handleRestore(a: Anuncio) {
    const token = await getToken();
    const res = await fetch(`/api/anuncios/${a.id}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ condominioId, action: "restore" }),
    });
    const data = await res.json();
    if (data.ok) load();
    else alert(data.error);
  }

  const filtered = anuncios.filter((a: Anuncio) => {
    if (filter === "all") return true;
    if (filter === "rascunho") return a.status === "RASCUNHO";
    if (filter === "agendado") return a.status === "AGENDADO";
    if (filter === "publicado") return (a.status === "PUBLICADO" || !a.status) && !isExpired(a);
    if (filter === "expirado") return isExpired(a);
    if (filter === "arquivado") return a.status === "ARQUIVADO";
    return true;
  });

  const activeForResident = anuncios.filter((a: any) => {
    const s = a.status || "PUBLICADO";
    return s === "PUBLICADO" && !isExpired(a);
  });

  // AN.4: Mark visible announcements as read (for residents)
  React.useEffect(() => {
    if (!condominioId || isManager) return;
    const visible = activeForResident.filter((a: Anuncio) => !readSetRef.current.has(a.id));
    if (visible.length === 0) return;
    getToken().then(async (t) => {
      for (const a of visible.slice(0, 5)) {
        try {
          await fetch(`/api/anuncios/${a.id}/read`, {
            method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
            body: JSON.stringify({ condominioId }),
          });
          readSetRef.current.add(a.id);
        } catch { /* ignore */ }
      }
    });
  }, [activeForResident, condominioId]);

  return (
    <AppLayout pageTitle={isManager ? "Anúncios" : "Mural de Anúncios"} headerActions={
      isManager ? <Button onClick={openCreate}><PlusCircle className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Novo anúncio</span></Button> : undefined
    }>
      <div className="space-y-6">
        {/* Filters for managers */}
        {isManager && (
          <div className="flex flex-wrap gap-1">
            {[
              { k: "all", l: "Todos" }, { k: "rascunho", l: "Rascunhos" }, { k: "agendado", l: "Agendados" },
              { k: "publicado", l: "Publicados" }, { k: "expirado", l: "Expirados" }, { k: "arquivado", l: "Arquivados" },
            ].map(f => (
              <button key={f.k} onClick={() => setFilter(f.k)}
                className={cn("px-3 py-1 text-xs rounded-full border transition-all",
                  filter === f.k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                {f.l}
              </button>
            ))}
          </div>
        )}

        {loading ? <p className="text-muted-foreground text-sm">Carregando...</p> :
         (isManager ? filtered : activeForResident).length === 0 ? (
          <EmptyState icon={Megaphone} title={isManager ? "Nenhum anúncio encontrado" : "Nenhum anúncio no momento"} description={isManager ? "Crie o primeiro anúncio para o condomínio." : "Os comunicados do condomínio aparecerão aqui."} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(isManager ? filtered : activeForResident).map((a: Anuncio) => (
              <SectionCard
                key={a.id}
                title={a.titulo}
                className={cn(a.status === "RASCUNHO" && "border-dashed border-amber-300")}
                actions={isManager ? <StatusBadge tone={statusTone(a.status || "PUBLICADO")}>{statusLabel(a)}</StatusBadge> : undefined}
              >
                <p className="text-xs text-muted-foreground">
                  {a.targetScope === "BLOCO" ? `Bloco ${a.targetBlocoNome || a.targetBlocoId}` : "Todo condomínio"}
                  {a.expiresAt ? ` • Expira: ${new Date(a.expiresAt._seconds ? a.expiresAt._seconds * 1000 : a.expiresAt).toLocaleDateString()}` : ""}
                </p>
                <p className="text-sm whitespace-pre-wrap line-clamp-3 mt-2">{a.mensagem}</p>
                {isManager && (a.status === "PUBLICADO" || !a.status) && (a as any).audienceCount > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {(a as any).audienceCount} destinatários
                  </p>
                )}
                {isManager && (
                  <div className="flex gap-1 mt-2">
                    {(a.status === "PUBLICADO" || !a.status) && (
                      <Button variant="ghost" size="sm" onClick={() => loadAnalytics(a.id)}>📊 Desempenho</Button>
                    )}
                    {a.status !== "ARQUIVADO" ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Pencil className="h-3 w-3 mr-1" />Editar</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleArchive(a)}><Archive className="h-3 w-3 mr-1" />Arquivar</Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => handleRestore(a)}><RotateCcw className="h-3 w-3 mr-1" />Restaurar</Button>
                    )}
                  </div>
                )}
              </SectionCard>
            ))}
          </div>
        )}
      </div>

      {/* CREATE/EDIT DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar anúncio" : "Novo anúncio"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título do anúncio" /></div>
            <div><Label>Mensagem</Label><textarea className="w-full min-h-[80px] rounded-xl border border-input bg-background px-3 py-2 text-sm" value={mensagem} onChange={e => setMensagem(e.target.value)} placeholder="Conteúdo do anúncio..." /></div>

            <div><Label>Destino</Label>
              <div className="flex gap-3 mt-1">
                <label className="flex items-center gap-1 text-sm"><input type="radio" name="scope" checked={targetScope === "CONDOMINIO"} onChange={() => { setTargetScope("CONDOMINIO"); setTargetBlocoId(""); }} /> Condomínio inteiro</label>
                <label className="flex items-center gap-1 text-sm"><input type="radio" name="scope" checked={targetScope === "BLOCO"} onChange={() => setTargetScope("BLOCO")} /> Bloco específico</label>
              </div>
              {targetScope === "BLOCO" && (
                <select className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={targetBlocoId} onChange={e => setTargetBlocoId(e.target.value)}>
                  <option value="">Selecione o bloco</option>
                  {blocosList.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
                </select>
              )}
            </div>

            <div><Label>Publicação</Label>
              <div className="flex flex-wrap gap-3 mt-1">
                <label className="flex items-center gap-1 text-sm"><input type="radio" name="mode" checked={publishMode === "now"} onChange={() => setPublishMode("now")} /> Publicar agora</label>
                <label className="flex items-center gap-1 text-sm"><input type="radio" name="mode" checked={publishMode === "scheduled"} onChange={() => setPublishMode("scheduled")} /> Agendar</label>
                <label className="flex items-center gap-1 text-sm"><input type="radio" name="mode" checked={publishMode === "draft"} onChange={() => setPublishMode("draft")} /> Salvar rascunho</label>
              </div>
              {publishMode === "scheduled" && (
                <Input type="datetime-local" className="mt-2" value={publishAtDate} onChange={e => setPublishAtDate(e.target.value)} />
              )}
            </div>

            <div><Label>Expiração (opcional)</Label>
              <Input type="datetime-local" value={expiresAtDate} onChange={e => setExpiresAtDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar" : publishMode === "draft" ? "Salvar rascunho" : "Publicar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AN.4: Analytics Dialog */}
      <Dialog open={analyticsDialog} onOpenChange={setAnalyticsDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Desempenho do anúncio</DialogTitle></DialogHeader>
          {loadingAnalytics ? <p className="text-sm text-muted-foreground">Carregando...</p> :
           analyticsData ? (
            <div className="space-y-2">
              {!analyticsData.analyticsAvailable ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Dados históricos de audiência indisponíveis para este anúncio.<br />
                  {analyticsData.readRecipients > 0 && (
                    <span className="text-xs">{analyticsData.readRecipients} visualização(ões) registrada(s).</span>
                  )}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl border bg-card p-3">
                    <p className="text-2xl font-bold">{analyticsData.eligibleRecipients}</p>
                    <p className="text-[10px] text-muted-foreground">Destinatários</p>
                  </div>
                  <div className="rounded-xl border bg-card p-3">
                    <p className="text-2xl font-bold">{analyticsData.readRecipients}</p>
                    <p className="text-[10px] text-muted-foreground">Visualizaram</p>
                  </div>
                  <div className="rounded-xl border bg-card p-3">
                    <p className="text-2xl font-bold">{analyticsData.unreadRecipients}</p>
                    <p className="text-[10px] text-muted-foreground">Não visualizaram</p>
                  </div>
                  <div className="rounded-xl border bg-card p-3">
                    <p className="text-2xl font-bold">{analyticsData.readRate !== null ? Math.round(analyticsData.readRate * 100) + '%' : '—'}</p>
                    <p className="text-[10px] text-muted-foreground">Taxa de leitura</p>
                  </div>
                </div>
              )}
            </div>
          ) : <p className="text-sm text-muted-foreground">Dados indisponíveis.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalyticsDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
