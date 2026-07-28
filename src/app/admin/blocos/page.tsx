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
import { Building2, PlusCircle, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BlocoTipo } from "@/lib/normalization/unit-types";

const BLOCK_TYPES: { value: BlocoTipo; label: string }[] = [
  { value: "BLOCO", label: "Bloco" },
  { value: "TORRE", label: "Torre" },
  { value: "QUADRA", label: "Quadra" },
  { value: "SETOR", label: "Setor" },
  { value: "ALAMEDA", label: "Alameda" },
  { value: "OUTRO", label: "Outro..." },
];

interface Bloco {
  id: string;
  nome: string;
  nomeNorm: string;
  tipo: BlocoTipo;
  tipoCustom?: string | null;
  isSistema: boolean;
  ordem: number;
  ativo: boolean;
  condominioId: string;
}

export default function AdminBlocosPage() {
  const { condominioAtivoId } = useCondominio();
  const { session } = useSessionCtx();
  const { toast } = useToast();
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBloco, setEditingBloco] = useState<Bloco | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "BLOCO" as BlocoTipo, tipoCustom: "", ordem: 0 });
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState("");

  const canManage = hasRole(session, ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"]);

  async function load() {
    if (!condominioAtivoId) return;
    setLoading(true);
    try {
      const token = await session?.user?.getIdToken();
      const res = await fetch(`/api/blocos?condominioId=${encodeURIComponent(condominioAtivoId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setBlocos(data.blocos || []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, [condominioAtivoId]);

  async function getToken() {
    return await session?.user?.getIdToken();
  }

  function openCreate() {
    setEditingBloco(null);
    setForm({ nome: "", tipo: "BLOCO", tipoCustom: "", ordem: blocos.length });
    setDialogOpen(true);
  }

  function openEdit(b: Bloco) {
    setEditingBloco(b);
    setForm({ nome: b.nome, tipo: b.tipo, tipoCustom: b.tipoCustom || "", ordem: b.ordem ?? 0 });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) return;
    if (form.tipo === "OUTRO" && !form.tipoCustom.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe o tipo personalizado.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const token = await getToken();
    const body: any = {
      condominioId: condominioAtivoId,
      nome: form.nome.trim(),
      tipo: form.tipo,
      tipoCustom: form.tipo === "OUTRO" ? form.tipoCustom.trim() : null,
      ordem: form.ordem,
    };
    let res: Response;
    if (editingBloco) {
      res = await fetch(`/api/blocos/${editingBloco.id}`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch("/api/blocos", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    const data = await res.json();
    if (data.ok) {
      toast({ title: editingBloco ? "Bloco atualizado" : "Bloco criado" });
      setDialogOpen(false);
      load();
    } else {
      toast({ title: "Erro", description: data.error, variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDeactivate(b: Bloco) {
    if (!confirm(`Desativar bloco "${b.nome}"?`)) return;
    const token = await getToken();
    const res = await fetch(`/api/blocos/${b.id}?condominioId=${encodeURIComponent(condominioAtivoId!)}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.ok) {
      toast({ title: "Bloco desativado" });
      load();
    } else {
      toast({ title: "Erro", description: data.error, variant: "destructive" });
    }
  }

  async function handleReactivate(b: Bloco) {
    const token = await getToken();
    const res = await fetch(`/api/blocos/${b.id}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ condominioId: condominioAtivoId, ativo: true }),
    });
    const data = await res.json();
    if (data.ok) { toast({ title: "Bloco reativado" }); load(); }
    else toast({ title: "Erro", description: data.error, variant: "destructive" });
  }

  const filtered = blocos.filter(b =>
    !busca || b.nome.toLowerCase().includes(busca.toLowerCase())
  );
  const showBlocoSelect = blocos.filter(b => b.ativo && !b.isSistema).length > 1 || blocos.some(b => !b.isSistema && b.ativo);

  const tipoLabel = (t: BlocoTipo, tc?: string | null) => {
    const found = BLOCK_TYPES.find(bt => bt.value === t);
    return t === "OUTRO" && tc ? tc : (found?.label || t);
  };

  return (
    <AppLayout
      pageTitle="Blocos e Estruturas"
      headerActions={
        canManage ? (
          <Button onClick={openCreate}>
            <PlusCircle className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Novo bloco</span>
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <Input
          placeholder="Buscar bloco..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="max-w-sm"
        />

        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="tc-glass-card p-8 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum bloco cadastrado.</p>
            {canManage && (
              <Button variant="outline" className="mt-3" onClick={openCreate}>
                <PlusCircle className="h-4 w-4 mr-2" /> Criar primeiro bloco
              </Button>
            )}
          </div>
        ) : (
          <div className="tc-glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden sm:table-cell">Ordem</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      {b.nome}
                      {b.isSistema && <Badge variant="secondary" className="ml-2 text-xs">sistema</Badge>}
                    </TableCell>
                    <TableCell>{tipoLabel(b.tipo, b.tipoCustom)}</TableCell>
                    <TableCell className="hidden sm:table-cell">{b.ordem}</TableCell>
                    <TableCell>
                      <Badge variant={b.ativo ? "default" : "secondary"}>
                        {b.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={b.isSistema}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {b.ativo ? (
                              <>
                                <DropdownMenuItem onClick={() => openEdit(b)}>
                                  <Pencil className="h-4 w-4 mr-2" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeactivate(b)} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" /> Desativar
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem onClick={() => handleReactivate(b)}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBloco ? "Editar bloco" : "Novo bloco"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Bloco A" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as BlocoTipo, tipoCustom: v !== "OUTRO" ? "" : form.tipoCustom })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLOCK_TYPES.map(bt => (
                    <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
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
              <Label>Ordem</Label>
              <Input type="number" value={form.ordem} onChange={e => setForm({ ...form, ordem: parseInt(e.target.value) || 0 })} />
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
