"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

import { VeiculoSchema, type VeiculoInput } from "@/modules/ficha/validators/veiculo.schema";
import {
  listVeiculos,
  createVeiculo,
  updateVeiculo,
  deleteVeiculo,
  type Veiculo,
} from "@/modules/ficha/services/veiculos.service";

type Props = {
  condominioId: string;
  uid: string;
  firestore: any; // Firestore instance
  canEdit: boolean;
};

export function VeiculosSection({ condominioId, uid, firestore, canEdit }: Props) {
  const [items, setItems] = React.useState<Veiculo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Veiculo | null>(null);
  const [saving, setSaving] = React.useState(false);

  const form = useForm<VeiculoInput>({
    resolver: zodResolver(VeiculoSchema),
    defaultValues: {
      marca: "",
      modelo: "",
      cor: "",
      ano: new Date().getFullYear(),
      placa: "",
      tagNumero: "",
    },
    mode: "onBlur",
  });

  async function refresh() {
    if (!firestore || !condominioId || !uid) return;
    setLoading(true);
    setErr(null);
    try {
      const list = await listVeiculos(firestore, condominioId, uid);
      setItems(list);
    } catch (e: any) {
      setErr(e?.message || "Falha ao carregar veículos.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, condominioId, uid]);

  function openCreate() {
    setEditing(null);
    form.reset({
      marca: "",
      modelo: "",
      cor: "",
      ano: new Date().getFullYear(),
      placa: "",
      tagNumero: "",
    });
    setOpen(true);
  }

  function openEdit(v: Veiculo) {
    setEditing(v);
    form.reset({
      marca: v.marca ?? "",
      modelo: v.modelo ?? "",
      cor: v.cor ?? "",
      ano: Number(v.ano ?? new Date().getFullYear()),
      placa: v.placa ?? "",
      tagNumero: v.tagNumero ?? "",
    });
    setOpen(true);
  }

  async function onSubmit(values: VeiculoInput) {
    if (!canEdit) return;
    setSaving(true);
    setErr(null);
    try {
      if (!editing) {
        await createVeiculo(firestore, condominioId, uid, values as any);
      } else {
        await updateVeiculo(firestore, condominioId, uid, editing.id, values as any);
      }
      setOpen(false);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Falha ao salvar veículo.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(v: Veiculo) {
    if (!canEdit) return;
    if (!confirm(`Remover veículo ${v.tagNumero}?`)) return;
    setErr(null);
    try {
      await deleteVeiculo(firestore, condominioId, uid, v.id);
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Falha ao remover veículo.");
    }
  }

  return (
    <Card className="tc-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Veículos</CardTitle>
          <CardDescription>Cadastre os veículos do morador. A TAG é obrigatória e única por condomínio.</CardDescription>
        </div>

        <Button type="button" className="tc-btn-primary" onClick={openCreate} disabled={!canEdit}>
          + Adicionar
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {err && <p className="text-sm text-red-600">{err}</p>}

        {loading ? (
          <p className="text-sm text-slate-600">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-600">Nenhum veículo cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {items.map((v) => (
              <div key={v.id} className="rounded-md border p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="text-sm">
                  <div className="font-semibold">{v.tagNumero}</div>
                  <div className="text-slate-600">
                    {v.marca} {v.modelo} • {v.cor} • {v.ano} • Placa: {v.placa}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="tc-btn-soft" onClick={() => openEdit(v)} disabled={!canEdit}>
                    Editar
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => onDelete(v)} disabled={!canEdit}>
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={(v) => { if (canEdit) setOpen(v); }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar veículo" : "Novo veículo"}</DialogTitle>
              <DialogDescription>Preencha os dados. A TAG deve ser única dentro do condomínio.</DialogDescription>
            </DialogHeader>

            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>TAG do carro *</Label>
                  <Input className="tc-input" {...form.register("tagNumero")} placeholder="Ex: 0192" />
                  <p className="text-xs text-slate-600">Será salva em maiúsculo. Única por condomínio.</p>
                </div>

                <div className="space-y-1">
                  <Label>Placa *</Label>
                  <Input className="tc-input" {...form.register("placa")} placeholder="ABC1D23" />
                </div>

                <div className="space-y-1">
                  <Label>Marca *</Label>
                  <Input className="tc-input" {...form.register("marca")} placeholder="Toyota" />
                </div>

                <div className="space-y-1">
                  <Label>Modelo *</Label>
                  <Input className="tc-input" {...form.register("modelo")} placeholder="Corolla" />
                </div>

                <div className="space-y-1">
                  <Label>Cor *</Label>
                  <Input className="tc-input" {...form.register("cor")} placeholder="Prata" />
                </div>

                <div className="space-y-1">
                  <Label>Ano *</Label>
                  <Input className="tc-input" type="number" {...form.register("ano")} />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" className="tc-btn-soft" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="tc-btn-primary" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
