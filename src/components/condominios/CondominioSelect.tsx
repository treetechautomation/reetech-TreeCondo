"use client";

import * as React from "react";
import { initializeFirebase } from "@/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type CondoItem = { id: string; nome: string };

type Props = {
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
  label?: string;
};

export default function CondominioSelect({ value, onChange, className, label = "Condomínio" }: Props) {
  const [items, setItems] = React.useState<CondoItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const { firestore } = initializeFirebase();

        // Preferência: coleção pública (nomes)
        let col = collection(firestore, "condominiosPublicos");
        try {
          const q1 = query(col, orderBy("nome"));
          const s1 = await getDocs(q1);
          const list1: CondoItem[] = s1.docs.map((d) => ({ id: d.id, nome: (d.data() as any)?.nome ?? d.id }));
          if (mounted && list1.length > 0) {
            setItems(list1);
            return;
          }
        } catch {
          // ignora e tenta a coleção privada
        }

        // Fallback: coleção "condominios"
        col = collection(firestore, "condominios");
        const q2 = query(col, orderBy("nome"));
        const s2 = await getDocs(q2);
        const list2: CondoItem[] = s2.docs.map((d) => ({ id: d.id, nome: (d.data() as any)?.nome ?? d.id }));
        if (mounted) setItems(list2);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs font-medium text-white/70">{label}</div>
      <Select value={value ?? ""} onValueChange={(v) => onChange(v)}>
        <SelectTrigger
          className={cn(
            "h-11 rounded-2xl border-white/15 bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)] backdrop-blur",
            "focus:ring-0 focus:ring-offset-0"
          )}
        >
          <SelectValue placeholder={loading ? "Carregando..." : "Selecione um condomínio"} />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-white/10 bg-[#0b1220]/90 text-white backdrop-blur">
          {items.length === 0 ? (
            <SelectItem value="__empty" disabled>
              {loading ? "Carregando..." : "Nenhum condomínio encontrado"}
            </SelectItem>
          ) : (
            items.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <div className="text-[11px] text-white/40">
        Dica: este seletor salva o condomínio ativo para filtrar Anúncios, Encomendas, etc.
      </div>
    </div>
  );
}
