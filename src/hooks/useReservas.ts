"use client";

import * as React from "react";
import { useFirestore } from "@/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";

export type AreaOpcao = {
  id: string;
  nome: string;
  preco: number; // centavos
  bloqueiaAreaId?: string | null;
};

export type AreaReservavel = {
  id: string;
  nome: string;
  descricao?: string | null;
  preco: number; // centavos (valor base)
  ativo: boolean;
  tipo?: string | null;
  diaInteiro?: boolean;
  horaInicio?: string;
  horaFim?: string;
  permiteAte?: number | null; // ex: 24
  opcoes?: AreaOpcao[] | null;
  fotoUrl?: string | null; // opcional (pra imagem)
};

export type Reserva = {
  id: string;
  areaId: string;
  status: string;
  uid: string;
  condominioId: string;
  data: Timestamp;
  dataFim?: Timestamp;
  valorCobrado?: number; // centavos
  criadoEm?: Timestamp;
};

function startOfDayUTC(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0));
}

function nextDayStartUTC(dateStr: string) {
  const dt = startOfDayUTC(dateStr);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt;
}

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function resolveFirestore(maybe: any) {
  // Alguns projetos retornam { firestore }, outros retornam o firestore direto.
  return maybe?.firestore ?? maybe;
}

export function useReservas(condominioId: string | null, dateStr: string) {
  const firestoreRaw = useFirestore();
  const firestore = React.useMemo(() => resolveFirestore(firestoreRaw), [firestoreRaw]);

  const [areas, setAreas] = React.useState<AreaReservavel[]>([]);
  const [reservas, setReservas] = React.useState<Reserva[]>([]);
  const [loadingAreas, setLoadingAreas] = React.useState(true);
  const [loadingReservas, setLoadingReservas] = React.useState(true);

  React.useEffect(() => {
    if (!condominioId) {
      setAreas([]);
      setLoadingAreas(false);
      return;
    }

    // Se firestore vier inválido, evita quebrar a tela
    if (!firestore) {
      setAreas([]);
      setLoadingAreas(false);
      return;
    }

    setLoadingAreas(true);

    const ref = collection(firestore, "condominios", condominioId, "areasReservaveis");
    const qy = query(ref);

    return onSnapshot(
      qy,
      (snap) => {
        const list: AreaReservavel[] = snap.docs.map((d) => {
          const data = d.data() as any;

          return {
            id: d.id,
            nome: String(data.nome ?? d.id),
            descricao: data.descricao ?? null,
            preco: toNum(data.preco ?? data.valorCentavos ?? 0),
            ativo: Boolean(data.ativo ?? true),
            tipo: data.tipo ?? null,
            diaInteiro: data.diaInteiro ?? false,
            horaInicio: data.horaInicio ?? null,
            horaFim: data.horaFim ?? null,
            permiteAte: (data.horaFim ?? data.permiteAte ?? null) as any,
            opcoes: (data.opcoes ?? null) as any,
            fotoUrl: (data.fotoUrl ?? null) as any,
          };
        });

        setAreas(list.filter((a) => a.ativo));
        setLoadingAreas(false);
      },
      () => {
        setAreas([]);
        setLoadingAreas(false);
      },
    );
  }, [firestore, condominioId]);

  React.useEffect(() => {
    if (!condominioId) {
      setReservas([]);
      setLoadingReservas(false);
      return;
    }

    if (!firestore) {
      setReservas([]);
      setLoadingReservas(false);
      return;
    }

    setLoadingReservas(true);

    const ini = startOfDayUTC(dateStr);
    const fim = nextDayStartUTC(dateStr);

    const ref = collection(firestore, "condominios", condominioId, "reservas");
    const qy = query(
      ref,
      where("data", ">=", Timestamp.fromDate(ini)),
      where("data", "<", Timestamp.fromDate(fim)),
      orderBy("data", "asc"),
    );

    return onSnapshot(
      qy,
      (snap) => {
        const list: Reserva[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            areaId: String(data.areaId ?? ""),
            status: String(data.status ?? "PENDENTE"),
            uid: String(data.uid ?? ""),
            condominioId: String(data.condominioId ?? condominioId),
            data: data.data as Timestamp,
            dataFim: (data.dataFim as Timestamp) ?? undefined,
            valorCobrado: (data.valorCobrado as number) ?? undefined,
            criadoEm: (data.criadoEm as Timestamp) ?? undefined,
          };
        });

        setReservas(list);
        setLoadingReservas(false);
      },
      () => {
        setReservas([]);
        setLoadingReservas(false);
      },
    );
  }, [firestore, condominioId, dateStr]);

  return { areas, reservas, loadingAreas, loadingReservas };
}
