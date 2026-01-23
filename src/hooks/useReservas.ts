"use client";

import * as React from "react";
import { getApp } from "firebase/app";
import { useFirestore } from "@/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";

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
  permiteAte?: number | null;
  opcoes?: AreaOpcao[] | null;
  fotoUrl?: string | null;
  fotoHint?: string | null;
  capacidadeMax?: number | null;
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

const areaNomeFallback: Record<string, string> = {
  salao_festas: "Salao de Festas",
  churrasqueira_1: "Churrasqueira 1",
  churrasqueira_2: "Churrasqueira 2",
  campo_quadra: "Campo",
  quadra: "Campo",
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

function normId(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

export function useReservas(condominioId: string | null, dateStr: string) {
  const firestoreRaw = useFirestore();
  const firestore = React.useMemo(() => resolveFirestore(firestoreRaw), [firestoreRaw]);

  const storage = React.useMemo(() => {
    try {
      return getStorage(getApp());
    } catch {
      return null;
    }
  }, []);

  const [areas, setAreas] = React.useState<AreaReservavel[]>([]);
  const [areaStorageUrls, setAreaStorageUrls] = React.useState<Record<string, string>>({});
  const [reservas, setReservas] = React.useState<Reserva[]>([]);
  const [loadingAreas, setLoadingAreas] = React.useState(true);
  const [loadingReservas, setLoadingReservas] = React.useState(true);

  React.useEffect(() => {
    if (!firestore || !condominioId) {
      setAreas([]);
      setLoadingAreas(false);
      return;
    }

    let alive = true;
    setLoadingAreas(true);

    const refCol = collection(firestore, "condominios", condominioId, "areasReservaveis");

    const unsub = onSnapshot(
      refCol,
      async (snap) => {
        try {
          const list: AreaReservavel[] = snap.docs.map((d) => {
            const data = d.data() as any;
            const id = normId(d.id);

            const nomeRaw = String(data.nome ?? data.titulo ?? "").trim();
            const nome = nomeRaw || areaNomeFallback[id] || d.id;

            const fotoPath = (data.fotoPath || data.fotoStoragePath || null) as string | null;
            const fotoUrl = (data.fotoUrl || data.imagemUrl || null) as string | null;

            // tenta descobrir um path padrão se não houver fotoPath
            const base = `condominios/${String(condominioId)}/areas/${String(d.id)}`;
            const imgPathCandidates = [
              fotoPath,
              `${base}.jpeg`,
              `${base}.jpg`,
              `${base}.png`,
            ].filter(Boolean);

            // preço base da área
            const preco = toNum(data.preco ?? data.valorBaseCentavos ?? 0, 0);

            // opcoes: normaliza preço (preco OU valorCobrado OU valor)
            const opcoes: AreaOpcao[] | null = Array.isArray(data.opcoes)
              ? data.opcoes.map((op: any, idx: number) => {
                  const opId = String(op?.id ?? `${id}_op_${idx}`).trim();
                  const opNome = String(op?.nome ?? op?.titulo ?? "Opcao").trim();
                  const opPreco = toNum(op?.preco ?? op?.valorCobrado ?? op?.valor ?? 0, 0);
                  const bloqueiaAreaId = op?.bloqueiaAreaId ?? op?.bloqueia ?? null;
                  return {
                    id: opId,
                    nome: opNome,
                    preco: opPreco,
                    bloqueiaAreaId: bloqueiaAreaId ? String(bloqueiaAreaId) : null,
                  };
                })
              : null;

            return {
              id: d.id, // mantém o id original para bater com o resto do app
              nome,
              descricao: data.descricao ?? null,
              ativo: Boolean(data.ativo ?? true),
              preco,
              capacidadeMax: Number.isFinite(Number(data.capacidadeMax)) ? Number(data.capacidadeMax) : null,
              opcoes,
              fotoUrl: fotoUrl ?? null,
              fotoHint: imgPathCandidates.length ? String(imgPathCandidates[0]) : null,
            };
          });

          // resolve urls (storage) só para itens que não têm fotoUrl, e ainda não estão no cache
          const pending = list.filter((a) => !a.fotoUrl && a.fotoHint && !areaStorageUrls[String(a.id)]);

          if (storage && pending.length) {
            const updates: Record<string, string> = {};
            for (const a of pending) {
              try {
                const url = await getDownloadURL(storageRef(storage, String(a.fotoHint)));
                updates[String(a.id)] = url;
              } catch {
                // ignora se não existe
              }
            }
            if (alive && Object.keys(updates).length) {
              setAreaStorageUrls((prev) => ({ ...prev, ...updates }));
            }
          }

          // aplica urls resolvidas ao list
          const withImgs = list.map((a) => ({
            ...a,
            fotoUrl: a.fotoUrl || areaStorageUrls[String(a.id)] || null,
          }));

          if (alive) {
            const allowedIds = new Set(
              ["salao_festas", "churrasqueira_1", "churrasqueira_2"].map((x) => String(x).trim().toLowerCase())
            );

            setAreas(
              withImgs.filter((a) => {
                const id = normId(a.id);
                return a.ativo && allowedIds.has(id);
              })
            );

            setLoadingAreas(false);
          }
        } catch (e) {
          console.error("[useReservas] erro ao montar areas:", e);
          if (alive) {
            setAreas([]);
            setLoadingAreas(false);
          }
        }
      },
      (err) => {
        console.error("[useReservas] snapshot areas erro:", err);
        setAreas([]);
        setLoadingAreas(false);
      }
    );

    return () => {
      alive = false;
      unsub();
    };
  }, [firestore, storage, condominioId, areaStorageUrls]);

  React.useEffect(() => {
    if (!condominioId || !firestore) {
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
      orderBy("data", "asc")
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
      }
    );
  }, [firestore, condominioId, dateStr]);

  return { areas, reservas, loadingAreas, loadingReservas };
}
