"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FileText, Wrench, Users, Search } from "lucide-react";

interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  href: string;
  icon: React.ComponentType<any>;
}

interface MaintenanceCommandSearchProps {
  rotinas: { id: string; titulo: string; categoria?: string }[];
  fornecedores: { id: string; nome: string; servico?: string }[];
}

export default function MaintenanceCommandSearch({ rotinas, fornecedores }: MaintenanceCommandSearchProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const items: SearchItem[] = React.useMemo(() => {
    const result: SearchItem[] = [
      ...rotinas.map((r) => ({
        id: r.id,
        title: r.titulo || "Sem título",
        subtitle: r.categoria,
        group: "Rotinas",
        href: `/manutencao-preventiva/rotinas/${r.id}`,
        icon: FileText,
      })),
      ...fornecedores.map((f) => ({
        id: f.id,
        title: f.nome,
        subtitle: f.servico,
        group: "Fornecedores",
        href: `/manutencao-preventiva/fornecedores`,
        icon: Users,
      })),
    ];
    result.push({
      id: "nav-rotinas",
      title: "Ir para Rotinas",
      group: "Navegação",
      href: "/manutencao-preventiva/rotinas",
      icon: FileText,
    });
    result.push({
      id: "nav-calendario",
      title: "Ir para Calendário",
      group: "Navegação",
      href: "/manutencao-preventiva/calendario",
      icon: Search,
    });
    result.push({
      id: "nav-fornecedores",
      title: "Ir para Fornecedores",
      group: "Navegação",
      href: "/manutencao-preventiva/fornecedores",
      icon: Users,
    });
    return result;
  }, [rotinas, fornecedores]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-slate-900/40 text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
        aria-label="Buscar no módulo (Ctrl+K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Buscar manutenção...</span>
        <kbd className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/30 font-mono">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar rotina, fornecedor..." className="text-white" aria-label="Buscar no módulo" />
        <CommandList className="bg-slate-950 border-white/10" role="listbox" aria-label="Resultados da busca">
          <CommandEmpty className="text-white/40 text-sm py-6 text-center">
            Nenhum resultado encontrado.
          </CommandEmpty>
          {["Rotinas", "Fornecedores", "Navegação"].map((group) => {
            const groupItems = items.filter((i) => i.group === group);
            if (groupItems.length === 0) return null;
            return (
              <CommandGroup key={group} heading={group} className="text-white/50 text-[10px] font-bold uppercase tracking-wider">
                {groupItems.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.title + (item.subtitle || "")}
                    onSelect={() => {
                      router.push(item.href);
                      setOpen(false);
                    }}
                    className="text-white/80 hover:bg-[#00D0E6]/10 aria-selected:bg-[#00D0E6]/10"
                  >
                    <item.icon className="h-4 w-4 mr-2 text-white/40" />
                    <div className="flex flex-col">
                      <span>{item.title}</span>
                      {item.subtitle && (
                        <span className="text-[10px] text-white/30">{item.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
