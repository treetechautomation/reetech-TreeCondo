"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useFirestore } from "@/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { useSessionCtx } from "@/contexts/SessionContext";

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
  const { condominioAtivoId, setCondominioAtivoId, vinculos, isLoadingVinculos } =
    useCondominio();

  const [open, setOpen] = React.useState(false);
  const [superOptions, setSuperOptions] = React.useState<Option[]>([]);
  const [isLoadingSuperOptions, setIsLoadingSuperOptions] = React.useState(false);

  const isSuper = !!session?.superAdmin || String(session?.role || "") === "SUPER_ADMIN";

  // SUPER_ADMIN: carrega SOMENTE a lista pública (condominiosPublicos)
  React.useEffect(() => {
    if (!isSuper || !firestore) return;

    const load = async () => {
      setIsLoadingSuperOptions(true);
      try {
        const q = query(collection(firestore, "condominiosPublicos"), orderBy("nome"));
        const snap = await getDocs(q);
        const list: Option[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            condominioId: d.id,
            condominioNome: data?.nome || d.id,
          };
        });
        setSuperOptions(list);
      } catch (e) {
        console.error("[CondominioSwitcher] Erro ao carregar condominiosPublicos (super admin):", e);
        setSuperOptions([]);
      } finally {
        setIsLoadingSuperOptions(false);
      }
    };

    load();
  }, [isSuper, firestore]);

  const options: Option[] = React.useMemo(() => {
    if (isSuper) {
      const map = new Map<string, Option>();
      superOptions.forEach((o) => map.set(o.condominioId, o));
      return Array.from(map.values()).sort((a, b) =>
        a.condominioNome.localeCompare(b.condominioNome)
      );
    }

    const map = new Map<string, Option>();
    (vinculos || []).forEach((v: any) => {
      if (v?.status === "ATIVO") {
        map.set(v.condominioId, {
          condominioId: v.condominioId,
          condominioNome: v?.condominioNome || v.condominioId,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.condominioNome.localeCompare(b.condominioNome)
    );
  }, [isSuper, superOptions, vinculos]);

  const active = React.useMemo(() => {
    return options.find((o) => o.condominioId === condominioAtivoId) || null;
  }, [options, condominioAtivoId]);

  const isDisabled = isLoadingVinculos || isLoadingSuperOptions;

  if (!isSuper && options.length <= 1) {
    return (
      <Button variant="outline" role="combobox" className="w-full min-w-0 h-11 sm:h-10 justify-between rounded-2xl overflow-hidden px-3 sm:px-4" disabled>
        <span className="truncate">{active ? active.condominioNome : "Nenhum condomínio"}</span>
      </Button>
    );
  }

  if (options.length === 0) {
    return (
      <Button variant="outline" role="combobox" className="w-full min-w-0 h-11 sm:h-10 justify-between rounded-2xl overflow-hidden px-3 sm:px-4" disabled>
        <span className="truncate">{isDisabled ? "Carregando..." : "Nenhum condomínio"}</span>
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
          className="w-full min-w-0 h-11 sm:h-10 justify-between rounded-2xl overflow-hidden px-3 sm:px-4"
          disabled={isDisabled}
        >
          <span className="truncate">
            {active ? active.condominioNome : isDisabled ? "Carregando..." : "Selecione um condomínio"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(260px,calc(100vw-24px))] p-0 z-[9999]" align="start" side="bottom" sideOffset={8}>
        <Command filter={(value, search) => (norm(value).includes(norm(search)) ? 1 : 0)}>
          <CommandInput placeholder="Procurar condomínio..." />
          <CommandList>
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
                    disabled={selected}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{o.condominioNome}</span>
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
