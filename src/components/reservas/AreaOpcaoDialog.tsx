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
import { cn } from "@/lib/utils";

export type AreaOpcao = {
  id: string;
  nome: string;
  preco: number; // centavos
  bloqueiaAreaId?: string | null;
  resourceIds?: string[] | null;
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
      <DialogContent className="tc-dialog-center sm:max-w-lg flex flex-col max-h-[90dvh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Opções de reserva</DialogTitle>
          <DialogDescription>
            Escolha como deseja reservar{" "}
            <span className="font-medium text-white">{areaNome}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
          <RadioGroup value={value} onValueChange={setValue} className="space-y-3">
            {items.map((i) => {
              const isSelected = value === i.id;
              return (
                <label
                  key={i.id}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-all",
                    isSelected
                      ? "bg-[#00D0E6]/10 border-[#00D0E6]/50 text-white shadow-[0_0_15px_rgba(0,208,230,0.15)]"
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white/90"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem
                      value={i.id}
                      className="border-white/30 text-[#00D0E6] data-[state=checked]:border-[#00D0E6]"
                    />
                    <div className="leading-tight">
                      <div className="font-medium text-white">
                        {i.nome}{" "}
                        {i.isBase ? (
                          <Badge variant="secondary" className="ml-2">
                            padrão
                          </Badge>
                        ) : null}
                      </div>

                      {i.bloqueiaAreaId ? (
                        <div className="text-xs text-white/60 mt-1">
                          Bloqueia:{" "}
                          <span className="font-semibold text-white/80">{i.bloqueiaAreaId}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-white/40 mt-1">—</div>
                      )}
                    </div>
                  </div>

                  <div className="text-sm font-semibold text-white">{brlFromCentavos(i.preco)}</div>
                </label>
              );
            })}
          </RadioGroup>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-sm text-white/60">Selecionado</div>
            <div className="text-sm font-semibold text-white">{brlFromCentavos(selected.preco)}</div>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-white/10 bg-background/95 backdrop-blur-md px-6 py-4 flex flex-col-reverse sm:flex-row justify-end gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="w-full sm:w-auto">
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
