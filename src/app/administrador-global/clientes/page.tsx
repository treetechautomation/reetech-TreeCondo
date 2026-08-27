"use client";

import * as React from "react";
import { Plus, Search, RefreshCw, FilterX, Edit2, FileText, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGlobalClientes } from "@/hooks/useGlobalClientes";
import type { GlobalClienteItem, GlobalAuditLogItem } from "@/services/globalClientes";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, string> = {
  TRIAL: "Trial",
  ATIVO: "Ativo",
  SUSPENSO: "Suspenso",
  CANCELADO: "Cancelado",
};

const STATUS_OPTIONS = [
  { value: "TRIAL", label: "Trial" },
  { value: "ATIVO", label: "Ativo" },
  { value: "SUSPENSO", label: "Suspenso" },
  { value: "CANCELADO", label: "Cancelado" },
];

function formatDate(iso: string | null, includeTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return includeTime ? d.toLocaleString("pt-BR") : d.toLocaleDateString("pt-BR");
}

function StatusBadge({ status }: { status: string }) {
  const isAtivo = status === "ATIVO";
  return (
    <Badge variant={isAtivo ? "success" : "neutral"}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b pb-3">
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreate, onClearFilters, hasFilters }: { onCreate: () => void, onClearFilters: () => void, hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FilterX className="mb-4 h-12 w-12 text-slate-300" />
      <h3 className="text-lg font-semibold text-slate-700">
        {hasFilters ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        {hasFilters 
          ? "Tente ajustar os filtros ou limpar a busca." 
          : "Cadastre o primeiro cliente para começar a utilizar o painel global."}
      </p>
      {hasFilters ? (
        <Button variant="outline" className="mt-6 gap-2" onClick={onClearFilters}>
          Limpar Filtros
        </Button>
      ) : (
        <Button className="mt-6 gap-2" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Cadastrar cliente
        </Button>
      )}
    </div>
  );
}

function ErrorAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-red-50/50">
      <div className="rounded-full bg-red-100 p-3">
        <RefreshCw className="h-8 w-8 text-red-500" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-700">Erro ao carregar</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      <Button variant="outline" className="mt-6 gap-2" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        Tentar novamente
      </Button>
    </div>
  );
}

export default function ClientesGlobaisPage() {
  const { toast } = useToast();
  const clientes = useGlobalClientes();

  // Search/Filters states
  const [searchNome, setSearchNome] = React.useState("");
  const [searchDoc, setSearchDoc] = React.useState("");
  const [searchCidade, setSearchCidade] = React.useState("");
  const [searchUf, setSearchUf] = React.useState("");
  const [searchStatus, setSearchStatus] = React.useState("ALL");
  const [searchOrder, setSearchOrder] = React.useState("nome_asc");
  const [searchLimit, setSearchLimit] = React.useState("20");

  // Create/Edit Modal states
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editVersion, setEditVersion] = React.useState(0);
  
  const [formNome, setFormNome] = React.useState("");
  const [formDocumento, setFormDocumento] = React.useState("");
  const [formCidade, setFormCidade] = React.useState("");
  const [formUf, setFormUf] = React.useState("");
  const [formStatus, setFormStatus] = React.useState("TRIAL");
  
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Detail Modal states
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [activeItem, setActiveItem] = React.useState<GlobalClienteItem | null>(null);

  // History Modal states
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historyItems, setHistoryItems] = React.useState<GlobalAuditLogItem[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyUnavailable, setHistoryUnavailable] = React.useState<string | null>(null);

  const items = clientes.status === "success" ? clientes.data.items : [];
  const hasFilters = Boolean(clientes.filtroNome || clientes.filtroDocumento || clientes.filtroCidade || clientes.filtroUf || clientes.filtroStatus);

  function handleApplyFilters() {
    clientes.aplicarFiltros({
      nome: searchNome,
      documento: searchDoc,
      cidade: searchCidade,
      uf: searchUf,
      status: searchStatus === "ALL" ? "" : searchStatus,
      orderBy: searchOrder,
      limit: Number(searchLimit),
    });
  }

  function handleClearFilters() {
    setSearchNome("");
    setSearchDoc("");
    setSearchCidade("");
    setSearchUf("");
    setSearchStatus("ALL");
    setSearchOrder("nome_asc");
    
    clientes.aplicarFiltros({
      nome: "",
      documento: "",
      cidade: "",
      uf: "",
      status: "",
      orderBy: "nome_asc",
      limit: Number(searchLimit),
    });
  }

  function openCreateModal() {
    setEditId(null);
    setEditVersion(0);
    setFormNome("");
    setFormDocumento("");
    setFormCidade("");
    setFormUf("");
    setFormStatus("TRIAL");
    setSaveError(null);
    setModalOpen(true);
  }

  function openEditModal(item: GlobalClienteItem) {
    setEditId(item.id);
    setEditVersion(item.version);
    setFormNome(item.nome);
    setFormDocumento(item.documento || "");
    setFormCidade(item.cidade || "");
    setFormUf(item.uf || "");
    setFormStatus(item.status);
    setSaveError(null);
    setModalOpen(true);
    setDetailOpen(false); // Close detail if open
  }

  function openDetailModal(item: GlobalClienteItem) {
    setActiveItem(item);
    setDetailOpen(true);
  }

  async function openHistoryModal(item: GlobalClienteItem) {
    setActiveItem(item);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryItems([]);
    setHistoryUnavailable(null);
    try {
      const result = await clientes.fetchGlobalClienteHistory(item.id);
      setHistoryItems(result.items);
      setHistoryUnavailable(result.indexRequired ? result.message : null);
    } catch (e: any) {
      toast({ title: "Erro ao carregar histórico", description: e.message, variant: "destructive" });
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formNome.trim()) return;
    
    setSaving(true);
    setSaveError(null);
    
    try {
      const payload = {
        nome: formNome.trim(),
        documento: formDocumento.trim() || undefined,
        cidade: formCidade.trim() || undefined,
        uf: formUf.trim().toUpperCase() || undefined,
        status: formStatus,
      };

      if (editId) {
        await clientes.editar(editId, { ...payload, version: editVersion });
        toast({ title: "Cliente atualizado com sucesso." });
      } else {
        await clientes.criar(payload);
        toast({ title: "Cliente criado com sucesso." });
      }
      setModalOpen(false);
    } catch (err: any) {
      setSaveError(err?.message || "Erro ao salvar cliente.");
    } finally {
      setSaving(false);
    }
  }

  // Prevenir ordenação customizada quando há filtros ativos em modo STRICT.
  // Em G1.6.4 não podemos usar (status == X && orderBy == Y) s/ index composto.
  const hasEqualityFilter = Boolean(searchStatus !== "ALL" || searchDoc || searchCidade || searchUf);
  const isNomeFilterActive = Boolean(searchNome);

  React.useEffect(() => {
    // Force valid order based on constraints
    if (isNomeFilterActive) {
      setSearchOrder("nome_asc");
    } else if (hasEqualityFilter) {
      setSearchOrder(""); // default __name__
    }
  }, [isNomeFilterActive, hasEqualityFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clientes Globais</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão de empresas que utilizam produtos Treetech.
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Nome</label>
              <Input
                placeholder="Busca exata do começo..."
                value={searchNome}
                onChange={(e) => setSearchNome(e.target.value)}
                disabled={hasEqualityFilter}
                title={hasEqualityFilter ? "Limpe outros filtros para buscar por nome" : ""}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Documento</label>
              <Input
                placeholder="Apenas números..."
                value={searchDoc}
                onChange={(e) => setSearchDoc(e.target.value)}
                disabled={isNomeFilterActive}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Status</label>
              <Select value={searchStatus} onValueChange={setSearchStatus} disabled={isNomeFilterActive}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <div className="space-y-1.5 flex-1">
                <label className="text-xs font-medium text-slate-700">Cidade</label>
                <Input
                  placeholder="Cidade"
                  value={searchCidade}
                  onChange={(e) => setSearchCidade(e.target.value)}
                  disabled={isNomeFilterActive}
                />
              </div>
              <div className="space-y-1.5 w-16">
                <label className="text-xs font-medium text-slate-700">UF</label>
                <Input
                  placeholder="UF"
                  maxLength={2}
                  value={searchUf}
                  onChange={(e) => setSearchUf(e.target.value.toUpperCase())}
                  disabled={isNomeFilterActive}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Ordenar por:</span>
              <Select 
                value={searchOrder} 
                onValueChange={setSearchOrder} 
                disabled={isNomeFilterActive || hasEqualityFilter}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={hasEqualityFilter ? "Padrão (Sem índice)" : "Selecione..."} />
                </SelectTrigger>
                <SelectContent>
                  {!hasEqualityFilter && <SelectItem value="nome_asc">Nome A-Z</SelectItem>}
                  {!hasEqualityFilter && !isNomeFilterActive && <SelectItem value="nome_desc">Nome Z-A</SelectItem>}
                  {!hasEqualityFilter && !isNomeFilterActive && <SelectItem value="recentes">Mais recentes</SelectItem>}
                  {!hasEqualityFilter && !isNomeFilterActive && <SelectItem value="antigos">Mais antigos</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Button variant="outline" className="flex-1 md:flex-none" onClick={handleClearFilters}>
                Limpar
              </Button>
              <Button className="flex-1 md:flex-none gap-2" onClick={handleApplyFilters}>
                <Search className="h-4 w-4" />
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {clientes.status === "loading" && (
        <Card>
          <CardContent className="py-6">
            <TableSkeleton />
          </CardContent>
        </Card>
      )}

      {clientes.status === "error" && (
        <ErrorAlert message={clientes.error} onRetry={() => clientes.aplicarFiltros({})} />
      )}

      {clientes.status === "success" && items.length === 0 && (
        <EmptyState 
          onCreate={openCreateModal} 
          onClearFilters={handleClearFilters}
          hasFilters={hasFilters} 
        />
      )}

      {clientes.status === "success" && items.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Localidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer group hover:bg-slate-50" onClick={() => openDetailModal(item)}>
                    <TableCell className="font-medium">{item.nome}</TableCell>
                    <TableCell className="text-slate-500">{item.documento || "—"}</TableCell>
                    <TableCell className="text-slate-500">
                      {item.cidade && item.uf ? `${item.cidade}/${item.uf}` : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {formatDate(item.createdAt)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(item)} title="Editar">
                          <Edit2 className="h-4 w-4 text-slate-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <CardFooter className="flex items-center justify-between p-4 border-t bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Linhas por página</span>
              <Select value={searchLimit} onValueChange={setSearchLimit}>
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 mr-2">Página {clientes.pageIndex + 1}</span>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8" 
                disabled={clientes.pageIndex === 0}
                onClick={clientes.prevPage}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8" 
                disabled={!clientes.data.hasMore}
                onClick={clientes.nextPage}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="flex flex-row items-start justify-between border-b pb-4 mb-4">
            <div>
              <DialogTitle className="text-xl">{activeItem?.nome}</DialogTitle>
              <DialogDescription>ID: {activeItem?.id}</DialogDescription>
            </div>
            <div className="flex items-center gap-2 mt-0 pt-0">
              <Button variant="outline" size="sm" onClick={() => { if (activeItem) openHistoryModal(activeItem); }}>
                <FileText className="h-4 w-4 mr-2" />
                Histórico
              </Button>
              <Button size="sm" onClick={() => { if (activeItem) openEditModal(activeItem); }}>
                <Edit2 className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
          </DialogHeader>
          {activeItem && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 text-sm">
              <div>
                <dt className="text-slate-500 font-medium">Nome Fantasia / Razão Social</dt>
                <dd className="mt-1">{activeItem.nomeFantasia || activeItem.razaoSocial || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Documento</dt>
                <dd className="mt-1">{activeItem.documento || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Localidade</dt>
                <dd className="mt-1">{activeItem.cidade && activeItem.uf ? `${activeItem.cidade} - ${activeItem.uf}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Contato</dt>
                <dd className="mt-1">
                  {activeItem.email || "Sem e-mail"} <br />
                  {activeItem.telefone || "Sem telefone"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Status</dt>
                <dd className="mt-1"><StatusBadge status={activeItem.status} /></dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Controle</dt>
                <dd className="mt-1 text-xs text-slate-400">
                  Criado: {formatDate(activeItem.createdAt, true)} <br/>
                  Atualizado: {formatDate(activeItem.updatedAt, true)} <br/>
                  Versão: {activeItem.version}
                </dd>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit/Create Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => !saving && setModalOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogDescription>
              {editId ? "Altere os dados do cliente abaixo." : "Preencha os dados para cadastrar uma nova empresa."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="nome" className="text-sm font-medium">
                  Nome *
                </label>
                <Input
                  id="nome"
                  placeholder="Nome da empresa"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="documento" className="text-sm font-medium">
                  Documento (CNPJ/CPF)
                </label>
                <Input
                  id="documento"
                  placeholder="Apenas números ou formatado"
                  value={formDocumento}
                  onChange={(e) => setFormDocumento(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label htmlFor="cidade" className="text-sm font-medium">
                    Cidade
                  </label>
                  <Input
                    id="cidade"
                    placeholder="Cidade"
                    value={formCidade}
                    onChange={(e) => setFormCidade(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="uf" className="text-sm font-medium">
                    UF
                  </label>
                  <Input
                    id="uf"
                    placeholder="UF"
                    maxLength={2}
                    value={formUf}
                    onChange={(e) => setFormUf(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="status" className="text-sm font-medium">
                  Status
                </label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {saveError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
                  {saveError}
                </div>
              )}
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !formNome.trim()}>
                {saving ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Salvando</>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Alterações</DialogTitle>
            <DialogDescription>
              Log de auditoria para o cliente {activeItem?.nome}.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {historyLoading ? (
              <div className="flex justify-center p-8">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : historyUnavailable ? (
              <div className="text-center p-8 text-amber-700 bg-amber-50 rounded-md border border-amber-100 text-sm">
                Histórico temporariamente indisponível — requer configuração de índice no Firestore.
              </div>
            ) : historyItems.length === 0 ? (
              <div className="text-center p-8 text-slate-500">Nenhum registro encontrado.</div>
            ) : (
              <div className="space-y-4 border-l-2 border-slate-100 pl-4 ml-2">
                {historyItems.map((log) => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[25px] top-1 h-3 w-3 rounded-full bg-slate-300 ring-4 ring-white" />
                    <div className="text-sm font-medium text-slate-900">{log.action}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatDate(log.createdAt, true)} por {log.actorEmail || log.actorUid} via {log.source}
                    </div>
                    {log.after && (
                      <div className="mt-2 text-xs bg-slate-50 p-2 rounded border font-mono overflow-x-auto text-slate-600">
                        {JSON.stringify(log.after, null, 2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
