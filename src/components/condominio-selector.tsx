"use client";

import React from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { useCondominio } from "@/contexts/CondominioContext";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

export function CondominioSelector() {
  const {
    vinculos,
    condominioAtivoId,
    setCondominioAtivoId,
    isLoadingVinculos,
    setBlocoAtivoId,
    setUnidadeAtivaId
  } = useCondominio();
  const [open, setOpen] = React.useState(false);

  const condominioAtivo = vinculos.find(
    (v) => v.condominioId === condominioAtivoId
  );

  if (isLoadingVinculos) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (vinculos.length === 0) {
      return (
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled
          >
           Nenhum condomínio
          </Button>
      );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {condominioAtivo
            ? condominioAtivo.condominioNome
            : "Selecione o condomínio"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--sidebar-width)] p-0">
        <Command>
          <CommandInput placeholder="Procurar condomínio..." />
          <CommandList>
            <CommandEmpty>Nenhum condomínio encontrado.</CommandEmpty>
            <CommandGroup>
              {vinculos.map((vinculo) => (
                <CommandItem
                  key={vinculo.condominioId}
                  value={vinculo.condominioId}
                  onSelect={(currentValue) => {
                    setCondominioAtivoId(
                      currentValue === condominioAtivoId ? "" : currentValue
                    );
                    setBlocoAtivoId(null);
                    setUnidadeAtivaId(null);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      condominioAtivoId === vinculo.condominioId
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {vinculo.condominioNome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
