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
import { PlusCircle, Megaphone, Pencil, Archive, RotateCcw, Paperclip, X } from "lucide-react";

const ATTACHMENT_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf";
const ATTACHMENT_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

type AnuncioAttachment = {
  storagePath: string | null;
  fileName: string;
  contentType: string;
  size: number;
};

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
  attachment?: AnuncioAttachment | null;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [attachmentFile, setAttachmentFile] = React.useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = React.useState<AnuncioAttachment | null>(null);
  const [removeExistingAttachment, setRemoveExistingAttachment] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

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

  function resetAttachmentState() {
    setAttachmentFile(null); setExistingAttachment(null); setRemoveExistingAttachment(false); setFormError(null);
  }

  function openCreate() {
    setEditing(null);
    setTitulo(""); setMensagem("");
    setTargetScope("CONDOMINIO"); setTargetBlocoId("");
    setPublishMode("now"); setPublishAtDate(""); setExpiresAtDate("");
    resetAttachmentState();
    setDialogOpen(true);
  }

  function openEdit(a: Anuncio) {
    setEditing(a);
    setTitulo(a.titulo || ""); setMensagem(a.mensagem || "");
    setTargetScope(a.targetScope || "CONDOMINIO"); setTargetBlocoId(a.targetBlocoId || "");
    setPublishMode(a.status === "AGENDADO" ? "scheduled" : (a.status === "RASCUNHO" ? "draft" : "now"));
    setPublishAtDate(""); setExpiresAtDate("");
    resetAttachmentState();
    setExistingAttachment(a.attachment && a.attachment.storagePath ? a.attachment : null);
    setDialogOpen(true);
  }

  function handleAttachmentPick(file: File | null) {
    setFormError(null);
    if (!file) { setAttachmentFile(null); return; }
    if (!ATTACHMENT_ALLOWED_TYPES.includes(file.type)) {
      setFormError("Tipo de arquivo não permitido. Aceitos: imagens (JPG/PNG/WEBP) ou PDF.");
      return;
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
      setFormError("Arquivo excede o tamanho máximo de 10MB.");
      return;
    }
    setAttachmentFile(file);
    setRemoveExistingAttachment(false);
  }

  async function handleSave() {
    setFormError(null);
    if (!titulo.trim() || !mensagem.trim()) return;

    // FEATURE.ANUNCIOS.1: expiração é obrigatória para publicar/agendar.
    // O backend é a autoridade final — esta checagem só evita um round-trip
    // desnecessário quando o erro já é óbvio no cliente.
    if (publishMode !== "draft" && !expiresAtDate) {
      setFormError("Expiração é obrigatória para publicar ou agendar um anúncio.");
      return;
    }

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
    if (!data.ok) { setFormError(data.error || "Erro ao salvar."); setSaving(false); return; }

    const anuncioId = editing ? editing.id : data.anuncioId;

    if (attachmentFile) {
      const fd = new FormData();
      fd.append("condominioId", condominioId!);
      fd.append("file", attachmentFile);
      const upRes = await fetch(`/api/anuncios/${anuncioId}/attachment`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const upData = await upRes.json().catch(() => ({ ok: false }));
      if (!upData.ok) {
        setFormError(`Anúncio salvo, mas houve falha ao anexar o arquivo: ${upData.error || "erro desconhecido"}`);
        load(); setSaving(false); return;
      }
    } else if (removeExistingAttachment && existingAttachment) {
      await fetch(`/api/anuncios/${anuncioId}/attachment?condominioId=${encodeURIComponent(condominioId!)}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      }).catch(() => { /* best-effort; anúncio já foi salvo */ });
    }

    setDialogOpen(false); load(); setSaving(false);
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
                <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                  <span>{a.targetScope === "BLOCO" ? `Bloco ${a.targetBlocoNome || a.targetBlocoId}` : "Todo condomínio"}</span>
                  {a.expiresAt ? <span>• Expira: {new Date(a.expiresAt._seconds ? a.expiresAt._seconds * 1000 : a.expiresAt).toLocaleDateString()}</span> : null}
                  {a.attachment?.storagePath ? <Paperclip className="h-3 w-3" aria-label="Possui anexo" /> : null}
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

            <div>
              <Label>Anexo</Label>
              {existingAttachment && !attachmentFile && !removeExistingAttachment ? (
                <div className="mt-1 flex items-center justify-between rounded-xl border border-input bg-muted/40 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 truncate">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{existingAttachment.fileName}</span>
                    <span className="text-xs text-muted-foreground shrink-0">({formatBytes(existingAttachment.size)})</span>
                  </span>
                  <button type="button" className="text-muted-foreground hover:text-foreground shrink-0" onClick={() => setRemoveExistingAttachment(true)} aria-label="Remover anexo">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : attachmentFile ? (
                <div className="mt-1 flex items-center justify-between rounded-xl border border-input bg-muted/40 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 truncate">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{attachmentFile.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">({formatBytes(attachmentFile.size)})</span>
                  </span>
                  <button type="button" className="text-muted-foreground hover:text-foreground shrink-0" onClick={() => setAttachmentFile(null)} aria-label="Remover arquivo selecionado">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <Input
                  type="file"
                  accept={ATTACHMENT_ACCEPT}
                  className="mt-1"
                  onChange={e => handleAttachmentPick(e.target.files?.[0] || null)}
                />
              )}
              <p className="text-xs text-muted-foreground mt-1">Imagens (JPG/PNG/WEBP) ou PDF, até 10MB.</p>
            </div>

            <div>
              <Label>Expiração {publishMode !== "draft" && <span className="text-destructive">*</span>}</Label>
              <Input type="datetime-local" value={expiresAtDate} onChange={e => setExpiresAtDate(e.target.value)} />
              {publishMode === "draft" ? (
                <p className="text-xs text-muted-foreground mt-1">Opcional em rascunho — obrigatória ao publicar ou agendar.</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Obrigatória: o anúncio some do mural após esta data e o anexo é removido do armazenamento.</p>
              )}
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}
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
