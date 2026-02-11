"use client";

import * as React from "react";
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
    let alive = true;

    async function load() {
      try {
        if (!condominioId) {
          if (alive) setBlocos([]);
          return;
        }

        setLoading(true);

        const r = await fetch(`/api/condominios/${condominioId}/blocos`, {
          cache: "no-store",
        });

        const j = await r.json();
        const list = (j?.blocos ?? j?.data ?? []) as any[];

        if (!alive) return;
        setBlocos(
          Array.isArray(list) ? list.map((b) => ({ id: String(b.id), nome: b.nome ? String(b.nome) : undefined })) : []
        );
      } catch (e) {
        console.error("[BlocoSelect] erro ao carregar blocos:", e);
        if (alive) setBlocos([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [condominioId]);

  const disabled = !condominioId || loading;

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
          Este condomínio não tem blocos cadastrados (ou você não tem acesso). Verifique em “Condomínios”.
        </p>
      )}
    </div>
  );
}
