"use client";

import React from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { useCondominio } from "@/contexts/CondominioContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function norm(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function CondominioSelector() {
  const {
    vinculos,
    condominioAtivoId,
    setCondominioAtivoId,
    isLoadingVinculos,
    setBlocoAtivoId,
    setUnidadeAtivaId,
  } = useCondominio();

  const [open, setOpen] = React.useState(false);

  const options = React.useMemo(() => {
    const list = (vinculos || [])
      .filter((v) => v?.status !== "INATIVO")
      .map((v) => ({
        id: v.condominioId,
        nome: v.condominioNome || v.condominioId,
      }));

    // evita duplicados
    const seen = new Set<string>();
    return list.filter((o) => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });
  }, [vinculos]);

  const active = React.useMemo(() => {
    return options.find((o) => o.id === condominioAtivoId) || null;
  }, [options, condominioAtivoId]);

  if (isLoadingVinculos) return <Skeleton className="h-10 w-full" />;

  if (options.length === 0) {
    return (
      <Button variant="outline" role="combobox" className="w-full justify-between" disabled>
        Nenhum condomínio
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          <span className="truncate">
            {active ? active.nome : "Selecione o condomínio"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--sidebar-width)] p-0" align="start">
        <Command
          filter={(value, search) => (norm(value).includes(norm(search)) ? 1 : 0)}
        >
          <CommandInput placeholder="Procurar condomínio..." />
          <CommandList>
            <CommandEmpty>Nenhum condomínio encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const selected = o.id === condominioAtivoId;
                const value = `${o.id} | ${o.nome}`;

                return (
                  <CommandItem
                    key={o.id}
                    value={value}
                    disabled={selected}
                    onSelect={() => {
                      // ✅ troca sempre para o id do item (nunca manda "")
                      setCondominioAtivoId(o.id);

                      // reset local do layout
                      setBlocoAtivoId(null);
                      setUnidadeAtivaId(null);

                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{o.nome}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
