"use client";

import * as React from "react";
import { initializeFirebase } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";

type Props = {
  variant?: "sidebar" | "header";
  className?: string;
};

function getLocalCondoId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("treecondo_condominioId");
}

type VinculoAny = {
  blocoId?: string | null;
  unidadeId?: string | null;
  unidadeNumero?: string | number | null;
  apartamento?: string | number | null;
  blocoNome?: string | null;
  bloco?: string | null;
  unidade?: string | null;
};

export default function UserBadge({ variant = "sidebar", className }: Props) {
  const { session, isSessionLoading } = useSession();
  const user = session?.user ?? null;

  const [linha, setLinha] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!user) return;
        const condominioId = getLocalCondoId();
        if (!condominioId) {
          if (!cancelled) setLinha("");
          return;
        }

        const { firestore } = initializeFirebase();

        // vinculo do usuário com o condomínio ativo
        const vincRef = doc(firestore, "userCondominios", user.uid, "vinculos", condominioId);
        const vincSnap = await getDoc(vincRef);
        if (!vincSnap.exists()) {
          if (!cancelled) setLinha("");
          return;
        }

        const v = (vincSnap.data() as VinculoAny) || {};
        const blocoId = v.blocoId ?? null;
        const unidadeId = v.unidadeId ?? null;

        // tenta achar um número de unidade/apto direto no vínculo
        const unidadeNumero =
          v.unidadeNumero ?? v.apartamento ?? v.unidade ?? null;

        // tenta achar nome do bloco direto no vínculo
        let blocoNome = v.blocoNome ?? v.bloco ?? null;

        // se não veio, tenta buscar no Firestore pelo id do bloco
        if (!blocoNome && blocoId) {
          const bRef = doc(firestore, "condominios", condominioId, "blocos", blocoId);
          const bSnap = await getDoc(bRef);
          blocoNome = (bSnap.exists() ? (bSnap.data() as any)?.nome : null) ?? null;
        }

        // se não veio unidadeNumero mas tem unidadeId, tenta buscar no Firestore
        let unidadeNumResolved: string | number | null = unidadeNumero as any;
        if ((unidadeNumResolved === null || unidadeNumResolved === undefined || unidadeNumResolved === "") && blocoId && unidadeId) {
          const uRef = doc(
            firestore,
            "condominios",
            condominioId,
            "blocos",
            blocoId,
            "unidades",
            unidadeId
          );
          const uSnap = await getDoc(uRef);
          unidadeNumResolved = (uSnap.exists() ? (uSnap.data() as any)?.numero : null) ?? null;
        }

        const parts: string[] = [];
        if (blocoNome) parts.push(`Bloco ${blocoNome}`);
        if (unidadeNumResolved !== null && unidadeNumResolved !== undefined && `${unidadeNumResolved}`.trim() !== "") {
          parts.push(`Apto ${unidadeNumResolved}`);
        }

        if (!cancelled) setLinha(parts.join(" • "));
      } catch {
        if (!cancelled) setLinha("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  if (isSessionLoading || !user) return null;

  const nome = user.displayName?.trim() || user.email || "Morador";

  if (variant === "header") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="h-9 w-9 rounded-full bg-slate-900/10 flex items-center justify-center text-sm font-semibold text-slate-800">
          {(nome?.[0] ?? "M").toUpperCase()}
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-900">{nome}</div>
          {linha ? <div className="text-xs text-slate-600">{linha}</div> : null}
        </div>
      </div>
    );
  }

  // sidebar
  return (
    <div className={cn("rounded-xl border border-white/10 bg-white/5 p-3", className)}>
      <div className="text-xs text-white/50">Logado como</div>
      <div className="mt-1 text-sm font-semibold text-white">{nome}</div>
      {linha ? <div className="mt-1 text-xs text-white/60">{linha}</div> : null}
    </div>
  );
}
