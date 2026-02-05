"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useFirestore } from "@/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { useSessionCtx } from "@/contexts/SessionContext";

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
  const { session } = useSessionCtx();
  const firestore = useFirestore();
  const {
    condominioAtivoId,
    setCondominioAtivoId,
    vinculos,
    isLoadingVinculos,
  } = useCondominio();

  const [open, setOpen] = React.useState(false);
  const [superOptions, setSuperOptions] = React.useState<Option[]>([]);
  const [isLoadingSuperOptions, setIsLoadingSuperOptions] = React.useState(false);

  const isSuper = !!session?.superAdmin;

  React.useEffect(() => {
    if (!isSuper || !firestore) return;

    const loadSuperOptions = async () => {
      setIsLoadingSuperOptions(true);
      try {
        const q = query(collection(firestore, "condominiosPublicos"), orderBy("nome"));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            condominioId: d.id,
            condominioNome: data?.nome || d.id,
          };
        });
        setSuperOptions(list);
      } catch (e) {
        console.error("[CondominioSwitcher] Erro ao carregar condominios (super admin):", e);
        setSuperOptions([]);
      } finally {
        setIsLoadingSuperOptions(false);
      }
    };
    loadSuperOptions();
  }, [isSuper, firestore]);

  const options: Option[] = React.useMemo(() => {
    const base = (vinculos || [])
      .filter((v) => v?.status !== "INATIVO")
      .map((v) => ({
        condominioId: v.condominioId,
        condominioNome: (v as any).condominioNome || v.condominioId,
      }));

    if (isSuper) {
      const allOptionsMap = new Map<string, Option>();
      base.forEach(o => allOptionsMap.set(o.condominioId, o));
      superOptions.forEach(o => allOptionsMap.set(o.condominioId, o));
      
      return Array.from(allOptionsMap.values()).sort((a, b) => a.condominioNome.localeCompare(b.condominioNome));
    }
    
    const seen = new Set<string>();
    return base.filter((o) => {
      if (seen.has(o.condominioId)) return false;
      seen.add(o.condominioId);
      return true;
    });
  }, [vinculos, superOptions, isSuper]);

  const active = React.useMemo(() => {
    return options.find((o) => o.condominioId === condominioAtivoId) || null;
  }, [options, condominioAtivoId]);

  const isDisabled = isLoadingVinculos || isLoadingSuperOptions || options.length === 0;

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
              const value = `${o.condominioId} | ${o.condominioNome}`;
              const selected = o.condominioId === condominioAtivoId;

              return (
                <CommandItem
                  key={o.condominioId}
                  value={value}
                  onSelect={() => {
                    if (condominioAtivoId !== o.condominioId) {
                       setCondominioAtivoId(o.condominioId);
                    }
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
