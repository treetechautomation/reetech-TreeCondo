"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCondominio } from "@/contexts/CondominioContext";
import { useSessionCtx } from "@/contexts/SessionContext";
import { hasRole } from "@/lib/acl";
import { useToast } from "@/hooks/use-toast";
import { Home, PlusCircle, MoreVertical, Pencil, Trash2, Search } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UnidadeTipo, BlocoTipo } from "@/lib/normalization/unit-types";

const UNIT_TYPES: { value: UnidadeTipo; label: string }[] = [
  { value: "APARTAMENTO", label: "Apartamento" },
  { value: "CASA", label: "Casa" },
  { value: "SALA", label: "Sala" },
  { value: "LOJA", label: "Loja" },
  { value: "LOTE", label: "Lote" },
  { value: "CONJUNTO", label: "Conjunto" },
  { value: "OUTRO", label: "Outro..." },
];

interface BlocoItem {
  id: string;
  nome: string;
  isSistema: boolean;
  ativo: boolean;
}

interface Unidade {
  id: string;
  numero: string;
  numeroNorm: string;
  blocoId: string;
  condominioId: string;
  andar: number | null;
  tipo: UnidadeTipo;
  tipoCustom?: string | null;
  ocupacao: string;
  ativo: boolean;
  proprietarioUid?: string | null;
  inquilinoUid?: string | null;
}

export default function AdminUnidadesPage() {
  const { condominioAtivoId } = useCondominio();
  const { session } = useSessionCtx();
  const { toast } = useToast();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [blocos, setBlocos] = useState<BlocoItem[]>([]);
  const [blocoFiltro, setBlocoFiltro] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Unidade | null>(null);
  const [form, setForm] = useState({
    numero: "", blocoId: "", andar: "", tipo: "APARTAMENTO" as UnidadeTipo, tipoCustom: "", ocupacao: "VAGO",
  });
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState("");
  const [apenasAtivas, setApenasAtivas] = useState(true);

  const canManage = hasRole(session, ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"]);

  async function getToken() { return await session?.user?.getIdToken(); }

  async function loadBlocos() {
    if (!condominioAtivoId) return;
    const token = await getToken();
    const res = await fetch(`/api/blocos?condominioId=${encodeURIComponent(condominioAtivoId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.ok) {
      const list: BlocoItem[] = data.blocos || [];
      setBlocos(list);
      const active = list.filter((b: BlocoItem) => b.ativo);
      if (active.length === 1 && !blocoFiltro) {
        setBlocoFiltro(active[0].id);
      }
    }
  }

  async function loadUnidades() {
    if (!condominioAtivoId || !blocoFiltro) { setUnidades([]); setLoading(false); return; }
    setLoading(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams({ condominioId: condominioAtivoId, blocoId: blocoFiltro });
      if (apenasAtivas) params.set("apenasAtivas", "true");
      const res = await fetch(`/api/unidades?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setUnidades(data.unidades || []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { loadBlocos(); }, [condominioAtivoId]);
  useEffect(() => { loadUnidades(); }, [condominioAtivoId, blocoFiltro, apenasAtivas]);

  function openCreate() {
    setEditing(null);
    setForm({ numero: "", blocoId: blocoFiltro || "", andar: "", tipo: "APARTAMENTO", tipoCustom: "", ocupacao: "VAGO" });
    setDialogOpen(true);
  }
  function openEdit(u: Unidade) {
    setEditing(u);
    setForm({ numero: u.numero, blocoId: u.blocoId, andar: u.andar?.toString() || "", tipo: u.tipo, tipoCustom: u.tipoCustom || "", ocupacao: u.ocupacao });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.numero.trim()) return;
    if (!form.blocoId) { toast({ title: "Selecione um bloco", variant: "destructive" }); return; }
    if (form.tipo === "OUTRO" && !form.tipoCustom.trim()) {
      toast({ title: "Informe o tipo personalizado", variant: "destructive" }); return;
    }
    setSaving(true);
    const token = await getToken();
    const body: any = {
      condominioId: condominioAtivoId,
      blocoId: form.blocoId,
      numero: form.numero.trim(),
      tipo: form.tipo,
      tipoCustom: form.tipo === "OUTRO" ? form.tipoCustom.trim() : null,
      andar: form.andar ? parseInt(form.andar, 10) : null,
      ocupacao: form.ocupacao,
    };
    let res: Response;
    if (editing) {
      res = await fetch(`/api/unidades/${editing.id}`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch("/api/unidades", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    const data = await res.json();
    if (data.ok) {
      toast({ title: editing ? "Unidade atualizada" : "Unidade criada" });
      setDialogOpen(false);
      loadUnidades();
    } else {
      toast({ title: "Erro", description: data.error, variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDeactivate(u: Unidade) {
    if (!confirm(`Desativar unidade "${u.numero}"?`)) return;
    const token = await getToken();
    const params = new URLSearchParams({ condominioId: condominioAtivoId!, blocoId: u.blocoId });
    const res = await fetch(`/api/unidades/${u.id}?${params.toString()}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.ok) { toast({ title: "Unidade desativada" }); loadUnidades(); }
    else toast({ title: "Erro", description: data.error, variant: "destructive" });
  }

  async function handleReactivate(u: Unidade) {
    const token = await getToken();
    const res = await fetch(`/api/unidades/${u.id}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ condominioId: condominioAtivoId, blocoId: u.blocoId, ativo: true }),
    });
    const data = await res.json();
    if (data.ok) { toast({ title: "Unidade reativada" }); loadUnidades(); }
    else toast({ title: "Erro", description: data.error, variant: "destructive" });
  }

  const blocoSelecionado = blocos.find(b => b.id === blocoFiltro);
  const showBlocoSelector = blocos.filter(b => b.ativo).length > 1 || !blocoSelecionado?.isSistema;

  const filtered = unidades.filter(u =>
    !busca || u.numero.toLowerCase().includes(busca.toLowerCase()) || u.numeroNorm.includes(busca.toLowerCase())
  );

  const tipoLabel = (t: UnidadeTipo, tc?: string | null) =>
    t === "OUTRO" && tc ? tc : (UNIT_TYPES.find(ut => ut.value === t)?.label || t);

  const stats = {
    total: unidades.length,
    ativas: unidades.filter(u => u.ativo).length,
    vagas: unidades.filter(u => u.ativo && u.ocupacao === "VAGO").length,
    ocupadas: unidades.filter(u => u.ativo && u.ocupacao !== "VAGO" && u.ocupacao !== "EM_REFORMA" && u.ocupacao !== "INTERDITADO").length,
  };

  return (
    <AppLayout
      pageTitle="Unidades"
      headerActions={
        canManage ? (
          <Button onClick={openCreate}>
            <PlusCircle className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Nova unidade</span>
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[{ label: "Total", value: stats.total }, { label: "Ativas", value: stats.ativas }, { label: "Vagas", value: stats.vagas }, { label: "Ocupadas", value: stats.ocupadas }].map(s => (
            <div key={s.label} className="tc-glass-card p-3 text-center">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          {showBlocoSelector && blocos.length > 0 && (
            <Select value={blocoFiltro} onValueChange={setBlocoFiltro}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Bloco" /></SelectTrigger>
              <SelectContent>
                {blocos.filter(b => b.ativo).map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input placeholder="Buscar unidade..." value={busca} onChange={e => setBusca(e.target.value)} className="max-w-xs" />
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={apenasAtivas} onChange={e => setApenasAtivas(e.target.checked)} />
            Ativas
          </label>
        </div>

        {/* Listagem */}
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : !blocoFiltro ? (
          <div className="tc-glass-card p-8 text-center">
            <Home className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Selecione um bloco para ver suas unidades.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="tc-glass-card p-8 text-center">
            <Home className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhuma unidade cadastrada{blocoSelecionado ? ` em "${blocoSelecionado.nome}"` : ""}.</p>
            {canManage && (
              <Button variant="outline" className="mt-3" onClick={openCreate}>
                <PlusCircle className="h-4 w-4 mr-2" /> Criar primeira unidade
              </Button>
            )}
          </div>
        ) : (
          <div className="tc-glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Andar</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  {canManage && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.numero}</TableCell>
                    <TableCell className="hidden sm:table-cell">{tipoLabel(u.tipo, u.tipoCustom)}</TableCell>
                    <TableCell className="hidden md:table-cell">{u.andar ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={
                        u.ocupacao === "VAGO" ? "secondary" :
                        u.ocupacao === "OCUPADO" ? "default" :
                        u.ocupacao === "EM_REFORMA" ? "outline" : "destructive"
                      }>
                        {u.ocupacao === "VAGO" ? "Vago" :
                         u.ocupacao === "OCUPADO" ? "Ocupado" :
                         u.ocupacao === "EM_REFORMA" ? "Em reforma" : "Interditado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={u.ativo ? "default" : "secondary"}>
                        {u.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {u.ativo ? (
                              <>
                                <DropdownMenuItem onClick={() => openEdit(u)}>
                                  <Pencil className="h-4 w-4 mr-2" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeactivate(u)} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" /> Desativar
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem onClick={() => handleReactivate(u)}>
                                Reativar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar unidade" : "Nova unidade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {showBlocoSelector && blocos.length > 1 && (
              <div>
                <Label>Bloco</Label>
                <Select value={form.blocoId} onValueChange={v => setForm({ ...form, blocoId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o bloco" /></SelectTrigger>
                  <SelectContent>
                    {blocos.filter(b => b.ativo).map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Número</Label>
              <Input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} placeholder="Ex: 101" />
            </div>
            <div>
              <Label>Andar</Label>
              <Input type="number" value={form.andar} onChange={e => setForm({ ...form, andar: e.target.value })} placeholder="Ex: 1" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as UnidadeTipo, tipoCustom: v !== "OUTRO" ? "" : form.tipoCustom })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIT_TYPES.map(ut => (
                    <SelectItem key={ut.value} value={ut.value}>{ut.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.tipo === "OUTRO" && (
              <div>
                <Label>Tipo personalizado *</Label>
                <Input value={form.tipoCustom} onChange={e => setForm({ ...form, tipoCustom: e.target.value })} placeholder="Ex: Galpão" />
              </div>
            )}
            <div>
              <Label>Estado</Label>
              <Select value={form.ocupacao} onValueChange={v => setForm({ ...form, ocupacao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VAGO">Vago</SelectItem>
                  <SelectItem value="OCUPADO">Ocupado</SelectItem>
                  <SelectItem value="EM_REFORMA">Em reforma</SelectItem>
                  <SelectItem value="INTERDITADO">Interditado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
