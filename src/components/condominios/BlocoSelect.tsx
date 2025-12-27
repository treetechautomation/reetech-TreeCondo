"use client";

import * as React from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { initializeFirebase } from "@/firebase";
import { cn } from "@/lib/utils";

type Bloco = { id: string; nome?: string };

export default function BlocoSelect({
  condominioId,
  value,
  onChange,
  className,
  label = "Bloco",
}: {
  condominioId: string | null;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  label?: string;
}) {
  const [blocos, setBlocos] = React.useState<Bloco[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!condominioId) {
      setBlocos([]);
      return;
    }

    setLoading(true);
    const { firestore } = initializeFirebase();

    const ref = collection(firestore, "condominios", condominioId, "blocos");
    const q = query(ref, orderBy("nome"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Bloco[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setBlocos(list);
        setLoading(false);
      },
      () => {
        setBlocos([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [condominioId]);

  const disabled = !condominioId || loading || blocos.length === 0;

  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-sm">{label}</label>
      <select
        className="h-10 w-full rounded-md border border-black/10 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {!condominioId && <option value="">Selecione um condomínio primeiro</option>}
        {condominioId && loading && <option value="">Carregando blocos...</option>}
        {condominioId && !loading && blocos.length === 0 && <option value="">Nenhum bloco cadastrado</option>}
        {condominioId && !loading && blocos.length > 0 && <option value="">Selecione o bloco</option>}
        {blocos.map((b) => (
          <option key={b.id} value={b.id}>
            {b.nome ?? b.id}
          </option>
        ))}
      </select>

      {condominioId && !loading && blocos.length === 0 && (
        <p className="text-xs text-amber-700">
          Este condomínio não tem blocos cadastrados. Cadastre os blocos em “Condomínios”.
        </p>
      )}
    </div>
  );
}
