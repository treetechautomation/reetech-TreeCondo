"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type AreaOpcao = {
  id: string;
  nome: string;
  preco: number; // centavos
  bloqueiaAreaId?: string | null;
};

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function brlFromCentavos(v: number) {
  const n = Number(v || 0) / 100;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;

  areaNome: string;
  precoBaseCentavos: number;
  opcoes: AreaOpcao[];
  selectedOpcaoId: string | null;

  onConfirm: (payload: {
    opcaoId: string;
    opcaoNome: string;
    precoCentavos: number;
    bloqueiaAreaId?: string | null;
  }) => void;
};

export function AreaOpcaoDialog({
  open,
  onOpenChange,
  areaNome,
  precoBaseCentavos,
  opcoes,
  selectedOpcaoId,
  onConfirm,
}: Props) {
  const defaultId = selectedOpcaoId ?? (opcoes?.[0]?.id ?? "base");
  const [value, setValue] = React.useState<string>(defaultId);

  React.useEffect(() => {
    if (open) setValue(defaultId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const items = React.useMemo(() => {
    const base = {
      id: "base",
      nome: areaNome,
      preco: Number(precoBaseCentavos || 0),
      bloqueiaAreaId: null as string | null,
      isBase: true,
    };

    const opts = (opcoes || [])
      .map((o: any) => {
        const preco = toNum(
          o?.preco ??
            o?.precoCentavos ??
            o?.valor ??
            o?.valorCentavos ??
            o?.valorCobrado ??
            o?.valorCobradoCentavos ??
            o?.precoBaseCentavos ??
            0,
          0
        );

        return {
          id: String(o?.id ?? ""),
          nome: String(o?.nome ?? ""),
          preco,
          bloqueiaAreaId: (o?.bloqueiaAreaId ??
            o?.bloqueia ??
            o?.bloqueiaId ??
            null) as string | null,
          isBase: false,
        };
      })
      .filter(
        (x: any) =>
          !!String(x.id || "").trim() &&
          !!String(x.nome || "").trim() &&
          String(x.id).toLowerCase() !== "base"
      );

    return [base, ...opts];
  }, [areaNome, precoBaseCentavos, opcoes]);

  const selected = items.find((i) => i.id === value) ?? items[0];

  function handleConfirm() {
    onConfirm({
      opcaoId: selected.id,
      opcaoNome: selected.nome,
      precoCentavos: selected.preco,
      bloqueiaAreaId: selected.bloqueiaAreaId ?? null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Opções de reserva</DialogTitle>
          <DialogDescription>
            Escolha como deseja reservar{" "}
            <span className="font-medium">{areaNome}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={value} onValueChange={setValue} className="space-y-3">
            {items.map((i) => (
              <label
                key={i.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-card p-3 hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={i.id} />
                  <div className="leading-tight">
                    <div className="font-medium">
                      {i.nome}{" "}
                      {i.isBase ? (
                        <Badge variant="secondary" className="ml-2">
                          padrão
                        </Badge>
                      ) : null}
                    </div>

                    {i.bloqueiaAreaId ? (
                      <div className="text-xs text-muted-foreground">
                        Bloqueia:{" "}
                        <span className="font-medium">{i.bloqueiaAreaId}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">—</div>
                    )}
                  </div>
                </div>

                <div className="text-sm font-semibold">{brlFromCentavos(i.preco)}</div>
              </label>
            ))}
          </RadioGroup>

          <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-3">
            <div className="text-sm text-muted-foreground">Selecionado</div>
            <div className="text-sm font-semibold">{brlFromCentavos(selected.preco)}</div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm}>Confirmar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
