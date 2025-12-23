"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";

import { cn } from "@/lib/utils";
import { useCondominio } from "@/contexts/CondominioContext";

type Option = {
  condominioId: string;
  condominioNome: string;
};

function norm(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function CondominioSwitcher() {
  const {
    condominioAtivoId,
    setCondominioAtivoId,
    vinculos,
    isLoadingVinculos,
  } = useCondominio();

  const [open, setOpen] = React.useState(false);

  const options: Option[] = React.useMemo(() => {
    const list = (vinculos || [])
      .filter((v) => v?.status !== "INATIVO")
      .map((v) => ({
        condominioId: v.condominioId,
        condominioNome: v.condominioNome || v.condominioId,
      }));

    // evita duplicados por condominioId
    const seen = new Set<string>();
    return list.filter((o) => {
      if (seen.has(o.condominioId)) return false;
      seen.add(o.condominioId);
      return true;
    });
  }, [vinculos]);

  const active = React.useMemo(() => {
    return options.find((o) => o.condominioId === condominioAtivoId) || null;
  }, [options, condominioAtivoId]);

  const isDisabled = isLoadingVinculos || options.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={isDisabled}
        >
          <span className="truncate">
            {active ? active.condominioNome : isDisabled ? "Carregando..." : "Selecione um condomínio"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[260px] p-0" align="start">
        <Command
          // filtro com acento/sem acento
          filter={(value, search) => {
            const v = norm(value);
            const s = norm(search);
            return v.includes(s) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Procurar condomínio..." />
          <CommandEmpty>Nenhum condomínio encontrado.</CommandEmpty>

          <CommandGroup>
            {options.map((o) => {
              // IMPORTANTE: value tem que existir para a busca funcionar
              const value = `${o.condominioId} | ${o.condominioNome}`;
              const selected = o.condominioId === condominioAtivoId;

              return (
                <CommandItem
                  key={o.condominioId}
                  value={value}
                  onSelect={() => {
                    setCondominioAtivoId(o.condominioId);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.condominioNome}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
