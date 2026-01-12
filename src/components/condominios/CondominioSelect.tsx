"use client";

import * as React from "react";
import { initializeFirebase } from "@/firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  documentId,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type CondoItem = { id: string; nome: string };

type Props = {
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
  label?: string;
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function CondominioSelect({
  value,
  onChange,
  className,
  label = "Condomínio",
}: Props) {
  const [items, setItems] = React.useState<CondoItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const { firestore } = initializeFirebase();
        const auth = getAuth();
        const uid = auth.currentUser?.uid;

        if (!uid) {
          if (mounted) setItems([]);
          return;
        }

        // 1) Pega SOMENTE os vínculos do usuário (permitido pelas rules: userCondominios/{uid}/**)
        const vincRef = collection(firestore, `userCondominios/${uid}/vinculos`);
        const vincSnap = await getDocs(vincRef);

        const condoIds = vincSnap.docs
          .map((d) => (d.data() as any)?.condominioId || d.id)
          .filter(Boolean);

        if (condoIds.length === 0) {
          if (mounted) setItems([]);
          return;
        }

        // 2) Busca nomes em condominiosPublicos APENAS desses IDs (em lotes de 10 por limite do "in")
        const pubCol = collection(firestore, "condominiosPublicos");
        const results: CondoItem[] = [];

        for (const group of chunk(condoIds, 10)) {
          const qPub = query(pubCol, where(documentId(), "in", group));
          const sPub = await getDocs(qPub);
          for (const d of sPub.docs) {
            results.push({
              id: d.id,
              nome: (d.data() as any)?.nome ?? d.id,
            });
          }
        }

        // se algum condomínio não existir em condominiosPublicos, cai no id
        const byId = new Map(results.map((r) => [r.id, r]));
        const finalList: CondoItem[] = condoIds.map((id) => byId.get(id) ?? { id, nome: id });

        // ordena por nome (opcional)
        finalList.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));

        if (mounted) setItems(finalList);
      } catch (e: any) {
        console.error("[CondominioSelect] erro ao carregar condos do usuário:", {
          code: e?.code,
          message: e?.message,
          e,
        });
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const safeValue = value ?? "";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs font-medium text-slate-800">{label}</div>

      <Select
        value={safeValue}
        onValueChange={(v) => {
          if (v === "__empty") return;
          onChange(v);
        }}
      >
        <SelectTrigger
          className={cn(
            "h-11 rounded-2xl border-white/15 bg-white/10 text-slate-800 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)] backdrop-blur",
            "focus:ring-0 focus:ring-offset-0"
          )}
        >
          <SelectValue
            placeholder={loading ? "Carregando..." : "Selecione um condomínio"}
          />
        </SelectTrigger>

        <SelectContent className="rounded-2xl border-white/10 bg-[#0b1220]/90 text-white backdrop-blur">
          {items.length === 0 ? (
            <SelectItem value="__empty" disabled>
              {loading ? "Carregando..." : "Nenhum condomínio vinculado ao seu usuário."}
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

      <div className="text-[11px] text-slate-700/80">
        Dica: este seletor salva o condomínio ativo para filtrar Anúncios, Encomendas, etc.
      </div>
    </div>
  );
}
