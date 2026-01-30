
"use client";

import React from "react";
import { useSessionCtx } from "@/contexts/SessionContext";
import { ChevronsUpDown, Check } from "lucide-react";
import { useCondominio } from "@/contexts/CondominioContext";
import { useFirestore } from "@/firebase";
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
import { collection, getDocs, orderBy, query } from "firebase/firestore";

function norm(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function CondominioSelector() {
  const { session } = useSessionCtx();
  const firestore = useFirestore();
  const {
    vinculos,
    condominioAtivoId,
    setCondominioAtivoId,
    isLoadingVinculos,
    setBlocoAtivoId,
    setUnidadeAtivaId,
  } = useCondominio();

  const [open, setOpen] = React.useState(false);
  const [superOptions, setSuperOptions] = React.useState<{ id: string; nome: string }[]>([]);
  const [isLoadingSuperOptions, setIsLoadingSuperOptions] = React.useState(false);

  React.useEffect(() => {
    const isSuper = String(session?.role || "") === "SUPER_ADMIN" || session?.superAdmin === true;
    if (!isSuper) return;
    if (!firestore) return;

    // se já tem vínculos, não precisa do fallback
    if (Array.isArray(vinculos) && vinculos.length > 0) return;

    const loadSuperOptions = async () => {
      try {
        setIsLoadingSuperOptions(true);
        const qPub = query(collection(firestore, "condominios"), orderBy("nome"));
        const snap = await getDocs(qPub);
        const list = snap.docs.map(d => {
          const data = d.data() as any;
          return { id: d.id, nome: data?.nome || d.id };
        });
        setSuperOptions(list);
      } catch (e) {
        console.error("[CondominioSelector] erro ao carregar condominios (super admin):", e);
        setSuperOptions([]);
      } finally {
        setIsLoadingSuperOptions(false);
      }
    };

    loadSuperOptions();
  }, [session?.role, session?.superAdmin, firestore, Array.isArray(vinculos) ? vinculos.length : 0]);


  const options = React.useMemo(() => {
    const isSuper = String(session?.role || "") === "SUPER_ADMIN" || session?.superAdmin === true;

    const base = (vinculos || [])
      .filter((v) => v?.status !== "INATIVO")
      .map((v) => ({
        id: v.condominioId,
        nome: (v as any).condominioNome || v.condominioId,
      }));

    if (isSuper) {
        const allOptions = [...base, ...superOptions];
        const seen = new Set<string>();
        return allOptions.filter((o) => {
            if (seen.has(o.id)) return false;
            seen.add(o.id);
            return true;
        }).sort((a,b) => a.nome.localeCompare(b.nome));
    }
    
    const seen = new Set<string>();
    return base.filter((o) => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });
  }, [vinculos, superOptions, session?.role, session?.superAdmin]);
  

  const active = React.useMemo(() => {
    return options.find((o) => o.id === condominioAtivoId) || null;
  }, [options, condominioAtivoId]);

  if (isLoadingVinculos || isLoadingSuperOptions) return <Skeleton className="h-10 w-full" />;

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
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-[220px] justify-between">
          <span className="truncate">
            {active ? active.nome : "Selecione..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[220px] p-0" align="end">
        <Command
          filter={(value, search) => (norm(value).includes(norm(search)) ? 1 : 0)}
        >
          <CommandInput placeholder="Procurar..." />
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
                      setCondominioAtivoId(o.id);

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
