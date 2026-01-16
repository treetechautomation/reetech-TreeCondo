"use client";

import * as React from "react";
import { useFirestore } from "@/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
  type Firestore,
  type FirestoreError,
} from "firebase/firestore";

export type AreaReservavel = {
  id: string;
  nome: string;
  descricao?: string | null;
  preco?: number;
  ativo: boolean;
  ordem?: number | null;
  diaInteiro?: boolean;
  horaFim?: number;
  horaInicio?: number;
  moeda?: string;
  tipo?: string | null;
};

export type Reserva = {
  id: string;
  areaId: string;
  status: string;
  uid: string;
  condominioId: string;
  data: Timestamp;
  dataFim?: Timestamp;
  valorCobrado?: number;
  criadoEm?: Timestamp;
};

function startOfDayUTC(dateStr: string) {
  // espera YYYY-MM-DD. Se vier DD/MM/YYYY, tenta converter.
  let s = (dateStr || "").trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split("/");
    s = `${yyyy}-${mm}-${dd}`;
  }

  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0));
}

function nextDayStartUTC(dateStr: string) {
  const dt = startOfDayUTC(dateStr);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt;
}

function resolveFirestore(ctx: unknown): Firestore | null {
  // aceita Firestore direto OU { firestore: Firestore } OU { db: Firestore }
  const anyCtx = ctx as any;
  const fs = anyCtx?.firestore ?? anyCtx?.db ?? anyCtx;
  if (!fs || typeof fs !== "object") return null;
  return fs as Firestore;
}

export function useReservas(condominioId: string | null, dateStr: string) {
  const firestoreCtx = useFirestore();
  const firestore = React.useMemo(() => resolveFirestore(firestoreCtx), [firestoreCtx]);

  const [areas, setAreas] = React.useState<AreaReservavel[]>([]);
  const [reservas, setReservas] = React.useState<Reserva[]>([]);
  const [loadingAreas, setLoadingAreas] = React.useState(true);
  const [loadingReservas, setLoadingReservas] = React.useState(true);
  const [errorAreas, setErrorAreas] = React.useState<string | null>(null);
  const [errorReservas, setErrorReservas] = React.useState<string | null>(null);

  React.useEffect(() => {
    setErrorAreas(null);

    if (!firestore || !condominioId) {
      setAreas([]);
      setLoadingAreas(false);
      return;
    }

    setLoadingAreas(true);

    try {
      const ref = collection(firestore, "condominios", condominioId, "areasReservaveis");
      const qy = query(ref, orderBy("ordem", "asc"));

      const unsub = onSnapshot(
        qy,
        (snap) => {
          const list: AreaReservavel[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              nome: String(data.nome ?? d.id),
              descricao: (data.descricao as string) ?? null,
              preco: Number(data.preco ?? 0),
              ativo: Boolean(data.ativo ?? true),
              ordem: (data.ordem as number) ?? null,
              diaInteiro: (data.diaInteiro as boolean) ?? undefined,
              horaFim: (data.horaFim as number) ?? undefined,
              horaInicio: (data.horaInicio as number) ?? undefined,
              moeda: (data.moeda as string) ?? undefined,
              tipo: (data.tipo as string) ?? null,
            };
          });

          setAreas(list.filter((a) => a.ativo));
          setLoadingAreas(false);
        },
        (err: FirestoreError) => {
          console.error("[Reservas] Erro areasReservaveis:", err);
          setErrorAreas(err.message);
          setAreas([]);
          setLoadingAreas(false);
        },
      );

      return () => unsub();
    } catch (e: any) {
      console.error("[Reservas] collection/areasReservaveis explodiu:", e);
      setErrorAreas(e?.message || "Erro desconhecido ao montar query de áreas.");
      setAreas([]);
      setLoadingAreas(false);
      return;
    }
  }, [firestore, condominioId]);

  React.useEffect(() => {
    setErrorReservas(null);

    if (!firestore || !condominioId) {
      setReservas([]);
      setLoadingReservas(false);
      return;
    }

    setLoadingReservas(true);

    try {
      const ini = startOfDayUTC(dateStr);
      const fim = nextDayStartUTC(dateStr);

      const ref = collection(firestore, "condominios", condominioId, "reservas");
      const qy = query(
        ref,
        where("data", ">=", Timestamp.fromDate(ini)),
        where("data", "<", Timestamp.fromDate(fim)),
        orderBy("data", "asc"),
      );

      const unsub = onSnapshot(
        qy,
        (snap) => {
          const list: Reserva[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              areaId: String(data.areaId ?? data.areaNome ?? ""),
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
        (err: FirestoreError) => {
          console.error("[Reservas] Erro reservas:", err);
          setErrorReservas(err.message);
          setReservas([]);
          setLoadingReservas(false);
        },
      );

      return () => unsub();
    } catch (e: any) {
      console.error("[Reservas] collection/reservas explodiu:", e);
      setErrorReservas(e?.message || "Erro desconhecido ao montar query de reservas.");
      setReservas([]);
      setLoadingReservas(false);
      return;
    }
  }, [firestore, condominioId, dateStr]);

  return { areas, reservas, loadingAreas, loadingReservas, errorAreas, errorReservas };
}
