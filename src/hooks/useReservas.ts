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
import { useSession } from "@/hooks/useSession";

export type AreaOpcao = {
  id: string;
  nome: string;
  preco: number; // centavos
  precoCentavos?: number;
  bloqueiaAreaId?: string | null;
  resourceIds?: string[] | null;
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
  ordem?: number | null;
  escopoReserva?: string | null;
  blocosPermitidos?: string[] | null;
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
  salao_festas_rosas: "Salão de Festas — Bloco Rosas",
  salao_festas_dalias: "Salão de Festas — Bloco Dalias",
  churrasqueira_1: "Churrasqueira 1",
  churrasqueira_2: "Churrasqueira 2",
  campo_quadra: "Campo",
  quadra: "Campo / Quadra",
};

// Perfis que operam reservas por targetUid e precisam ver todas as áreas ativas.
// O backend continua validando o bloco do titular final ao criar a reserva.
const OPERADOR_ROLES = new Set(["SUPER_ADMIN", "ADMIN_CONDOMINIO", "SINDICO", "ADMIN"]);

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

      const resourceIds: string[] | null = Array.isArray(o?.resourceIds)
        ? o.resourceIds.map((x: any) => String(x)).filter(Boolean)
        : null;

      return {
        id,
        nome: nome || id,
        preco,
        precoCentavos: preco,
        bloqueiaAreaId: bloqueiaAreaId ? String(bloqueiaAreaId) : null,
        resourceIds: resourceIds && resourceIds.length ? resourceIds : null,
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

  const { session } = useSession();
  const role = session?.role ?? null;
  const isOperador = !!role && OPERADOR_ROLES.has(role);
  const meuBlocoNorm = React.useMemo(() => {
    if (!condominioId) return "";
    const vinculo =
      (session?.vinculos ?? []).find((v) => v.condominioId === condominioId) ??
      null;
    return normalizeLower(vinculo?.blocoId ?? "");
  }, [session?.vinculos, condominioId]);

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
  const areaStorageUrlsRef = React.useRef<Record<string, string>>({});
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

            const blocosPermitidos: string[] | null = Array.isArray(
              data?.blocosPermitidos
            )
              ? data.blocosPermitidos
                  .map((b: any) => normalizeLower(b))
                  .filter(Boolean)
              : null;

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
              ordem: Number.isFinite(Number(data?.ordem))
                ? Number(data?.ordem)
                : null,
              escopoReserva: data?.escopoReserva
                ? String(data.escopoReserva).toUpperCase().trim()
                : null,
              blocosPermitidos:
                blocosPermitidos && blocosPermitidos.length
                  ? blocosPermitidos
                  : null,
            };
          });

          // resolve urls (storage) só para itens que não têm fotoUrl e ainda não estão no cache
          const pending = list.filter(
            (a) => !a.fotoUrl && a.fotoHint && !areaStorageUrlsRef.current[a.id]
          );

          if (storage && pending.length) {
            const updates: Record<string, string> = {};
            for (const a of pending) {
              try {
                const url = await getDownloadURL(
                  storageRef(storage, String(a.fotoHint))
                );
                updates[a.id] = url;
                areaStorageUrlsRef.current[a.id] = url;
              } catch {
                // ignora se não existe
              }
            }
            if (alive && Object.keys(updates).length) {
              setAreaStorageUrls((prev) => ({ ...prev, ...updates }));
            }
          }

          const withImgs = list.map((a) => {
            let fallbackUrl: string | null = null;
            const normId = a.id.toLowerCase();
            if (normId.startsWith("salao_festas")) {
              fallbackUrl = "/salao.jpeg";
            } else if (normId === "churrasqueira_1") {
              fallbackUrl = "/churrasqueira1.jpeg";
            } else if (normId === "churrasqueira_2") {
              fallbackUrl = "/churrasqueira2.jpeg";
            } else if (normId === "quadra" || normId === "campo" || normId === "campo_quadra") {
              fallbackUrl = "/campo.jpg";
            }

            return {
              ...a,
              fotoUrl: a.fotoUrl || areaStorageUrlsRef.current[a.id] || areaStorageUrls[a.id] || fallbackUrl,
            };
          });

          if (alive) {
            // Fonte da verdade: coleção areasReservaveis do Firestore.
            // Regras de visibilidade:
            // - somente áreas ativas (docs legados sem "ativo" contam como ativos);
            // - escopoReserva === "BLOCO": morador só vê se seu bloco (normalizado)
            //   estiver em blocosPermitidos; operadores veem todas (reserva manual
            //   por targetUid — o backend valida o bloco do titular final);
            // - escopoReserva === "CONDOMINIO" ou ausente (legado): visível a todos.
            const visiveis = withImgs.filter((a) => {
              if (!a.ativo) return false;
              if ((a as any).ehUsoComum) return false;
              const isPorBloco =
                a.escopoReserva === "BLOCO" &&
                Array.isArray(a.blocosPermitidos) &&
                a.blocosPermitidos.length > 0;
              if (!isPorBloco) return true;
              if (isOperador) return true;
              return !!meuBlocoNorm && a.blocosPermitidos!.includes(meuBlocoNorm);
            });

            // Ordenação determinística: ordem numérica (se existir) > nome > id.
            visiveis.sort((a, b) => {
              const oa = a.ordem ?? Number.POSITIVE_INFINITY;
              const ob = b.ordem ?? Number.POSITIVE_INFINITY;
              if (oa !== ob) return oa - ob;
              const byNome = String(a.nome).localeCompare(String(b.nome), "pt-BR");
              if (byNome !== 0) return byNome;
              return a.id.localeCompare(b.id);
            });

            setAreas(visiveis);
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
  }, [firestore, storage, condominioId, isOperador, meuBlocoNorm]);

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
