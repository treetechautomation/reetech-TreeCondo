"use client";

/**
 * ACCESS.5 — TELA DE ACESSOS DO MORADOR.
 *
 * Consome exclusivamente a Authorization API (ACCESS.4/4A/4B) via
 * `@/lib/access/uiClient` — nenhuma escrita direta ao Firestore, nenhum
 * import de módulo server-only (`@/lib/access/credential`,
 * `authorizationService`, `hmacKey`, `pinIssuance`).
 *
 * QR/PIN brutos existem SOMENTE no estado transitório deste componente
 * (`credentialResult`), nunca em localStorage/sessionStorage/Firestore/
 * console — ver `handleCreateSubmit` e `closeCredentialScreen`.
 *
 * Esta rota (`/acessos`, plural) já existia como um redirect-stub para
 * a página legada `/acesso` (ver BottomNav's `aliases: ["/acessos"]`) —
 * substituída aqui pela implementação real do novo domínio de acesso.
 * `/acesso` (singular, legado) permanece intocado.
 */

import * as React from "react";
import QRCode from "qrcode";
import { Plus, Copy, Share2, KeyRound, Ban, ChevronRight } from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { useToast } from "@/hooks/use-toast";
import { useSessionCtx } from "@/contexts/SessionContext";

import {
  createAuthorization, listAuthorizations, revokeAuthorization, getAccessContext,
  type AuthorizationDto, type CreateAuthorizationResult, type AccessContext,
} from "@/lib/access/uiClient";
import { ACCESS_TYPE_LABELS, ACCESS_TYPE_OPTIONS, STATUS_LABELS, STATUS_TONE, type AccessTypeUi } from "@/lib/access/uiLabels";
import { formatVisitDate, formatTimeOfDay, toIsoOrNull } from "@/lib/access/uiFormat";
import { mapCreateError } from "@/lib/access/uiErrors";

type TabKey = "active" | "upcoming" | "history";

const EMPTY_COPY: Record<TabKey, string> = {
  active: "Nenhum acesso autorizado no momento.",
  upcoming: "Nenhum acesso agendado.",
  history: "Você ainda não possui histórico de acessos.",
};

// ─────────────────────────── Create Sheet ───────────────────────────

function CreateAccessSheet({
  condominioId,
  open,
  onOpenChange,
  onCreated,
}: {
  condominioId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: CreateAuthorizationResult) => void;
}) {
  const { toast } = useToast();
  const [nome, setNome] = React.useState("");
  const [accessType, setAccessType] = React.useState<AccessTypeUi>("VISITOR");
  const [visitDate, setVisitDate] = React.useState("");
  const [horaChegada, setHoraChegada] = React.useState("");
  const [horaSaida, setHoraSaida] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [placa, setPlaca] = React.useState("");
  const [observacao, setObservacao] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const [context, setContext] = React.useState<AccessContext | null>(null);
  const [contextLoading, setContextLoading] = React.useState(false);
  const [contextError, setContextError] = React.useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = React.useState<string>("");

  const loadContext = React.useCallback(async () => {
    setContextLoading(true);
    setContextError(null);
    try {
      const ctx = await getAccessContext(condominioId);
      setContext(ctx);
      // Sem seleção anterior válida no novo contexto -> reseta (ACCESS.5B §13: nunca confiar em seleção obsoleta).
      setSelectedUnitId((prev) => (ctx.units.some((u) => u.unitId === prev) ? prev : ""));
    } catch (err: any) {
      setContextError(String(err?.message || "Não foi possível carregar suas unidades."));
    } finally {
      setContextLoading(false);
    }
  }, [condominioId]);

  React.useEffect(() => {
    if (open) loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, condominioId]);

  function reset() {
    setNome(""); setAccessType("VISITOR"); setVisitDate(""); setHoraChegada(""); setHoraSaida("");
    setTelefone(""); setPlaca(""); setObservacao(""); setSelectedUnitId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (!nome.trim()) {
      toast({ variant: "destructive", title: "Nome obrigatório", description: "Informe o nome do visitante." });
      return;
    }
    if (!visitDate) {
      toast({ variant: "destructive", title: "Data obrigatória", description: "Informe a data da visita." });
      return;
    }
    if (context && context.selectionRequired && !selectedUnitId) {
      toast({ variant: "destructive", title: "Selecione a unidade", description: "Escolha a unidade para esta autorização." });
      return;
    }

    setSubmitting(true);
    try {
      const result = await createAuthorization({
        condominioId,
        accessType,
        nome: nome.trim(),
        visitDate,
        expectedEntryAt: toIsoOrNull(visitDate, horaChegada),
        expectedExitAt: toIsoOrNull(visitDate, horaSaida),
        telefone: telefone.trim() || null,
        placa: placa.trim() || null,
        observacao: observacao.trim() || null,
        // Unidade única: omite unitId e preserva a auto-derivação do servidor (ACCESS.5B §11).
        unitId: context && context.selectionRequired ? selectedUnitId : null,
      });
      reset();
      onOpenChange(false);
      onCreated(result);
    } catch (err: any) {
      const mapped = mapCreateError(err);
      toast({ variant: "destructive", ...mapped });
      if (err?.code === "INVALID_UNIT" || err?.code === "NO_ACTIVE_UNIT") {
        loadContext(); // dado ficou obsoleto (unidade removida/inativada) — recarrega em vez de confiar no contexto antigo.
      }
    } finally {
      setSubmitting(false);
    }
  }

  const blocked = !contextLoading && !contextError && context !== null && context.units.length === 0;
  const canSubmit = !contextLoading && !contextError && !blocked;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto sm:max-w-lg sm:mx-auto sm:rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Autorizar novo acesso</SheetTitle>
          <SheetDescription>Autorize visitantes, prestadores e entregas para sua unidade.</SheetDescription>
        </SheetHeader>

        {contextLoading && (
          <div className="grid gap-3 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {!contextLoading && contextError && (
          <div className="py-6 text-center grid gap-3">
            <p className="text-sm text-muted-foreground">{contextError}</p>
            <Button variant="outline" onClick={loadContext}>Tentar novamente</Button>
          </div>
        )}

        {!contextLoading && !contextError && blocked && (
          <div className="py-6 text-center grid gap-3">
            <p className="text-sm text-muted-foreground">Não encontramos uma unidade vinculada ao seu acesso.</p>
          </div>
        )}

        {!contextLoading && !contextError && !blocked && (
        <form onSubmit={handleSubmit} noValidate className="grid gap-4 py-4">
          <div className="grid gap-1.5">
            <Label htmlFor="acesso-nome">Nome *</Label>
            <Input id="acesso-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} placeholder="Nome do visitante" required />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="acesso-tipo">Tipo *</Label>
            <select
              id="acesso-tipo"
              value={accessType}
              onChange={(e) => setAccessType(e.target.value as AccessTypeUi)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
            >
              {ACCESS_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {context && context.units.length === 1 && (
            <div className="grid gap-1.5">
              <Label>Unidade</Label>
              <p className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">{context.units[0].label}</p>
            </div>
          )}

          {context && context.selectionRequired && (
            <div className="grid gap-1.5">
              <Label htmlFor="acesso-unidade">Unidade *</Label>
              <select
                id="acesso-unidade"
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="" disabled>Selecione a unidade</option>
                {context.units.map((u) => (
                  <option key={u.unitId} value={u.unitId}>{u.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="acesso-data">Data da visita *</Label>
            <Input id="acesso-data" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="acesso-chegada">Chegada prevista</Label>
              <Input id="acesso-chegada" type="time" value={horaChegada} onChange={(e) => setHoraChegada(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="acesso-saida">Saída prevista</Label>
              <Input id="acesso-saida" type="time" value={horaSaida} onChange={(e) => setHoraSaida(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Horários são apenas uma previsão para a portaria — não é preciso saber exatamente quando a visita irá embora.</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="acesso-telefone">Telefone</Label>
              <Input id="acesso-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={20} placeholder="Opcional" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="acesso-placa">Placa do veículo</Label>
              <Input id="acesso-placa" value={placa} onChange={(e) => setPlaca(e.target.value)} maxLength={12} placeholder="Opcional" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="acesso-obs">Observação</Label>
            <Textarea id="acesso-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={280} placeholder="Opcional" rows={2} />
          </div>

          <SheetFooter className="mt-2">
            <Button type="submit" disabled={submitting || !canSubmit} className="w-full">
              {submitting ? "Autorizando..." : "Autorizar acesso"}
            </Button>
          </SheetFooter>
        </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────── Credential success screen ───────────────────────────

function CredentialScreen({
  result,
  onClose,
}: {
  result: CreateAuthorizationResult;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (result.credential.qrToken) {
      // Payload do QR é SOMENTE o token opaco — nunca authorizationId/condominioId/PII (ACCESS.5 §26).
      QRCode.toDataURL(result.credential.qrToken, { margin: 1, width: 220 }).then((url) => {
        if (!cancelled) setQrDataUrl(url);
      });
    }
    return () => { cancelled = true; };
  }, [result.credential.qrToken]);

  function handleCopyPin() {
    if (!result.credential.pin) return;
    navigator.clipboard.writeText(result.credential.pin).then(() => {
      toast({ title: "PIN copiado." });
    });
  }

  async function handleShare() {
    const visitorName = result.authorization.visitorSnapshot.nome;
    const text = `Acesso autorizado para ${visitorName} em ${formatVisitDate(result.authorization.visitDate)}.${
      result.credential.pin ? ` PIN de acesso: ${result.credential.pin}` : ""
    }`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Acesso autorizado", text });
      } catch {
        // usuário cancelou o share — não é um erro a reportar.
      }
    } else {
      navigator.clipboard.writeText(text).then(() => toast({ title: "Informações copiadas." }));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Acesso autorizado</DialogTitle>
          <DialogDescription>
            Salve ou compartilhe esta credencial agora. Por segurança, ela não poderá ser exibida novamente depois que esta tela for fechada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="text-center">
            <p className="font-medium">{result.authorization.visitorSnapshot.nome}</p>
            <p className="text-sm text-muted-foreground">
              {ACCESS_TYPE_LABELS[result.authorization.accessType]} · {formatVisitDate(result.authorization.visitDate)}
            </p>
          </div>

          {qrDataUrl && (
            <img src={qrDataUrl} alt="QR Code de acesso" width={220} height={220} className="rounded-lg border" />
          )}

          {result.credential.pin && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">PIN de acesso</p>
              <p className="text-3xl font-mono font-semibold tracking-[0.35em]">{result.credential.pin}</p>
            </div>
          )}

          <div className="flex w-full gap-2">
            {result.credential.pin && (
              <Button variant="outline" className="flex-1" onClick={handleCopyPin}>
                <Copy className="h-4 w-4 mr-2" /> Copiar PIN
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" /> Compartilhar
            </Button>
          </div>

          <Button className="w-full" onClick={onClose}>Concluir</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────── Detail dialog ───────────────────────────

function AuthorizationDetailDialog({
  authorization,
  onClose,
  onRevoked,
}: {
  authorization: AuthorizationDto;
  onClose: () => void;
  onRevoked: (id: string) => void;
}) {
  const [revoking, setRevoking] = React.useState(false);

  const chegada = formatTimeOfDay(authorization.expectedEntryAt);
  const saida = formatTimeOfDay(authorization.expectedExitAt);

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{authorization.visitorSnapshot.nome}</DialogTitle>
          <DialogDescription>{ACCESS_TYPE_LABELS[authorization.accessType]}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <StatusBadge tone={STATUS_TONE[authorization.effectiveStatus]}>{STATUS_LABELS[authorization.effectiveStatus]}</StatusBadge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Data</span>
            <span>{formatVisitDate(authorization.visitDate)}</span>
          </div>
          {(chegada || saida) && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Horários previstos</span>
              <span>{chegada || "—"} {saida ? `– ${saida}` : ""}</span>
            </div>
          )}
          {authorization.visitorSnapshot.telefone && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Telefone</span>
              <span>{authorization.visitorSnapshot.telefone}</span>
            </div>
          )}
          {authorization.visitorSnapshot.placa && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Placa</span>
              <span>{authorization.visitorSnapshot.placa}</span>
            </div>
          )}
          {authorization.visitorSnapshot.observacao && (
            <div>
              <span className="text-muted-foreground block mb-1">Observação</span>
              <p>{authorization.visitorSnapshot.observacao}</p>
            </div>
          )}

          {authorization.effectiveStatus === "AUTORIZADO" && (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground flex items-center gap-2">
              <KeyRound className="h-4 w-4 shrink-0" />
              Por segurança, a credencial (QR/PIN) não pode ser exibida novamente.
            </div>
          )}
        </div>

        {authorization.effectiveStatus === "AUTORIZADO" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full mt-2">
                <Ban className="h-4 w-4 mr-2" /> Revogar autorização
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revogar autorização?</AlertDialogTitle>
                <AlertDialogDescription>Essa ação impedirá novas entradas usando esta autorização.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={revoking}
                  onClick={async (e) => {
                    e.preventDefault();
                    setRevoking(true);
                    try {
                      onRevoked(authorization.id);
                    } finally {
                      setRevoking(false);
                    }
                  }}
                >
                  {revoking ? "Revogando..." : "Revogar autorização"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────── Main page ───────────────────────────

export default function AcessosPage() {
  const { session } = useSessionCtx();
  const { toast } = useToast();

  const condominioId = session?.activeCondominioId ?? null;

  const [tab, setTab] = React.useState<TabKey>("active");
  const [itemsByTab, setItemsByTab] = React.useState<Record<TabKey, AuthorizationDto[] | null>>({
    active: null, upcoming: null, history: null,
  });
  const [loadingTab, setLoadingTab] = React.useState<Record<TabKey, boolean>>({
    active: false, upcoming: false, history: false,
  });
  const [errorTab, setErrorTab] = React.useState<Record<TabKey, string | null>>({
    active: null, upcoming: null, history: null,
  });

  const [createOpen, setCreateOpen] = React.useState(false);
  const [credentialResult, setCredentialResult] = React.useState<CreateAuthorizationResult | null>(null);
  const [detailItem, setDetailItem] = React.useState<AuthorizationDto | null>(null);

  const loadTab = React.useCallback(async (t: TabKey) => {
    if (!condominioId) return;
    setLoadingTab((prev) => ({ ...prev, [t]: true }));
    setErrorTab((prev) => ({ ...prev, [t]: null }));
    try {
      const items = await listAuthorizations(condominioId, t);
      setItemsByTab((prev) => ({ ...prev, [t]: items }));
    } catch (err: any) {
      setErrorTab((prev) => ({ ...prev, [t]: String(err?.message || "Não foi possível carregar seus acessos.") }));
    } finally {
      setLoadingTab((prev) => ({ ...prev, [t]: false }));
    }
  }, [condominioId]);

  React.useEffect(() => {
    if (condominioId) loadTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condominioId, tab]);

  function refreshAllTabs() {
    (["active", "upcoming", "history"] as TabKey[]).forEach((t) => loadTab(t));
  }

  function closeCredentialScreen() {
    // Descarta o segredo transitório da memória do componente — nunca persistido em nenhum momento.
    setCredentialResult(null);
    refreshAllTabs();
  }

  async function handleRevoke(authorizationId: string) {
    if (!condominioId) return;
    try {
      await revokeAuthorization(condominioId, authorizationId);
      toast({ title: "Autorização revogada." });
      setDetailItem(null);
      refreshAllTabs();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Não foi possível revogar", description: String(err?.message || "Tente novamente.") });
    }
  }

  function renderList(t: TabKey) {
    if (loadingTab[t]) {
      return (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      );
    }
    if (errorTab[t]) {
      return (
        <EmptyState
          title="Não foi possível carregar seus acessos."
          description={errorTab[t] || undefined}
          action={{ label: "Tentar novamente", onClick: () => loadTab(t) }}
        />
      );
    }
    const items = itemsByTab[t];
    if (!items || items.length === 0) {
      return (
        <EmptyState
          icon={KeyRound}
          title={EMPTY_COPY[t]}
          action={t !== "history" ? { label: "Autorizar novo acesso", onClick: () => setCreateOpen(true) } : undefined}
        />
      );
    }
    return (
      <div className="grid gap-3">
        {items.map((item) => (
          <Card key={item.id} className="min-w-0 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setDetailItem(item)}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium truncate">{item.visitorSnapshot.nome}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {ACCESS_TYPE_LABELS[item.accessType]} · {formatVisitDate(item.visitDate)}
                  {formatTimeOfDay(item.expectedEntryAt) ? ` · ${formatTimeOfDay(item.expectedEntryAt)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge tone={STATUS_TONE[item.effectiveStatus]}>{STATUS_LABELS[item.effectiveStatus]}</StatusBadge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <AppLayout
      pageTitle="Acessos"
      headerActions={
        <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!condominioId}>
          <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Autorizar novo acesso</span>
        </Button>
      }
    >
      <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full">
        <p className="text-sm text-muted-foreground mb-4 sm:hidden">
          Autorize visitantes, prestadores e entregas para sua unidade.
        </p>

        <Button className="w-full mb-4 sm:hidden" onClick={() => setCreateOpen(true)} disabled={!condominioId}>
          <Plus className="h-4 w-4 mr-2" /> Autorizar novo acesso
        </Button>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">Ativos</TabsTrigger>
            <TabsTrigger value="upcoming">Próximos</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4">{renderList("active")}</TabsContent>
          <TabsContent value="upcoming" className="mt-4">{renderList("upcoming")}</TabsContent>
          <TabsContent value="history" className="mt-4">{renderList("history")}</TabsContent>
        </Tabs>
      </div>

      {condominioId && (
        <CreateAccessSheet
          condominioId={condominioId}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(result) => setCredentialResult(result)}
        />
      )}

      {credentialResult && (
        <CredentialScreen result={credentialResult} onClose={closeCredentialScreen} />
      )}

      {detailItem && (
        <AuthorizationDetailDialog
          authorization={detailItem}
          onClose={() => setDetailItem(null)}
          onRevoked={handleRevoke}
        />
      )}
    </AppLayout>
  );
}
