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
  permiteAte?: number | null; // ex: 24
  opcoes?: AreaOpcao[] | null;
  fotoUrl?: string | null;
  capacidadeMax?: number | null;
  fotoHint?: string | null; // path candidato do storage
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

function normalizeId(v: any) {
  return String(v ?? "").trim();
}

function normalizeLower(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function resolvePrecoCentavos(raw: any): number {
  // tenta vários nomes comuns que podem existir no Firestore
  const v =
    raw?.preco ??
    raw?.precoCentavos ??
    raw?.valor ??
    raw?.valorCentavos ??
    raw?.valorCobrado ??
    raw?.valorCobradoCentavos ??
    raw?.price ??
    raw?.amount ??
    0;

  return toNum(v, 0);
}

function normalizeOpcoes(rawOpcoes: any): AreaOpcao[] | null {
  if (!Array.isArray(rawOpcoes)) return null;

  const list: AreaOpcao[] = rawOpcoes
    .map((o: any, idx: number) => {
      const id = normalizeId(o?.id ?? o?.opcaoId ?? o?.key ?? `op${idx + 1}`);
      const nome = String(o?.nome ?? o?.titulo ?? o?.label ?? "").trim();
      const preco = resolvePrecoCentavos(o);
      const bloqueiaAreaId =
        o?.bloqueiaAreaId ?? o?.bloqueia ?? o?.bloqueiaId ?? null;

      return {
        id,
        nome: nome || id,
        preco,
        bloqueiaAreaId: bloqueiaAreaId ? String(bloqueiaAreaId) : null,
      };
    })
    // remove opções vazias/duplicadas ruins
    .filter((o) => !!o.id && !!o.nome);

  // evita duplicar “base” se o dialog já mostra o “padrão”
  // (se você gravou uma opção "base" sem querer, ela sai daqui)
  const filtered = list.filter((o) => normalizeLower(o.id) !== "base");

  return filtered.length ? filtered : null;
}

export function useReservas(condominioId: string | null, dateStr: string) {
  const firestoreRaw = useFirestore();
  const firestore = React.useMemo(
    () => resolveFirestore(firestoreRaw),
    [firestoreRaw]
  );

  const storage = React.useMemo(() => {
    try {
      return getStorage(getApp());
    } catch {
      return null;
    }
  }, []);

  const [areas, setAreas] = React.useState<AreaReservavel[]>([]);
  const [areaStorageUrls, setAreaStorageUrls] = React.useState<
    Record<string, string>
  >({});
  const [reservas, setReservas] = React.useState<Reserva[]>([]);
  const [loadingAreas, setLoadingAreas] = React.useState(true);
  const [loadingReservas, setLoadingReservas] = React.useState(true);

  // ===== AREAS =====
  React.useEffect(() => {
    if (!firestore || !condominioId) {
      setAreas([]);
      setLoadingAreas(false);
      return;
    }

    let alive = true;
    setLoadingAreas(true);

    const refCol = collection(
      firestore,
      "condominios",
      condominioId,
      "areasReservaveis"
    );

    const unsub = onSnapshot(
      refCol,
      async (snap) => {
        try {
          const list: AreaReservavel[] = snap.docs.map((d) => {
            const data = d.data() as any;
            const id = normalizeId(d.id);

            // preço base (centavos) — seu Firestore hoje está usando "preco"
            const precoBase =
              toNum(data?.preco, NaN) ??
              toNum(data?.valorBaseCentavos, NaN) ??
              toNum(data?.precoCentavos, NaN);

            const preco =
              Number.isFinite(Number(precoBase)) ? Number(precoBase) : 0;

            const nome =
              String(data?.nome ?? data?.titulo ?? "").trim() ||
              areaNomeFallback[id] ||
              id;

            const fotoPath =
              (data?.fotoPath ||
                data?.fotoStoragePath ||
                data?.fotoHint ||
                null) as string | null;

            const fotoUrl =
              (data?.fotoUrl || data?.imagemUrl || null) as string | null;

            // fallback de path padrão do storage (com base no que você listou no bucket)
            const base = `condominios/${String(
              condominioId
            )}/areas/${String(id)}`;
            const imgPathCandidates = [
              fotoPath,
              `${base}.jpeg`,
              `${base}.jpg`,
              `${base}.png`,
            ].filter(Boolean);

            const opcoes = normalizeOpcoes(data?.opcoes);

            return {
              id,
              nome,
              descricao: data?.descricao ?? null,
              preco,
              ativo: Boolean(data?.ativo ?? true),
              tipo: data?.tipo ?? null,
              diaInteiro: data?.diaInteiro ?? undefined,
              horaInicio: data?.horaInicio ?? undefined,
              horaFim: data?.horaFim ?? undefined,
              permiteAte:
                Number.isFinite(Number(data?.permiteAte))
                  ? Number(data?.permiteAte)
                  : null,
              opcoes,
              capacidadeMax:
                Number.isFinite(Number(data?.capacidadeMax))
                  ? Number(data?.capacidadeMax)
                  : null,
              fotoUrl: fotoUrl ?? null,
              fotoHint: imgPathCandidates.length
                ? String(imgPathCandidates[0])
                : null,
            };
          });

          // resolve urls (storage) só para itens que não têm fotoUrl e ainda não estão no cache
          const pending = list.filter(
            (a) => !a.fotoUrl && a.fotoHint && !areaStorageUrls[a.id]
          );

          if (storage && pending.length) {
            const updates: Record<string, string> = {};
            for (const a of pending) {
              try {
                const url = await getDownloadURL(
                  storageRef(storage, String(a.fotoHint))
                );
                updates[a.id] = url;
              } catch {
                // ignora se não existe
              }
            }
            if (alive && Object.keys(updates).length) {
              setAreaStorageUrls((prev) => ({ ...prev, ...updates }));
            }
          }

          const withImgs = list.map((a) => ({
            ...a,
            fotoUrl: a.fotoUrl || areaStorageUrls[a.id] || null,
          }));

          if (alive) {
            // mostra só as 3 áreas principais no /reservas (campo/quadra fica “invisível” no card)
            const allowedIds = new Set(
              ["salao_festas", "churrasqueira_1", "churrasqueira_2"].map((x) =>
                normalizeLower(x)
              )
            );

            setAreas(
              withImgs.filter(
                (a) => a.ativo && allowedIds.has(normalizeLower(a.id))
              )
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
        if (alive) {
          setAreas([]);
          setLoadingAreas(false);
        }
      }
    );

    return () => {
      alive = false;
      unsub();
    };
  }, [firestore, storage, condominioId, areaStorageUrls]);

  // ===== RESERVAS DO DIA (usado na lista de “reservas do dia”) =====
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
      (err) => {
        console.error("[useReservas] snapshot reservas erro:", err);
        setReservas([]);
        setLoadingReservas(false);
      }
    );
  }, [firestore, condominioId, dateStr]);

  return { areas, reservas, loadingAreas, loadingReservas };
}
