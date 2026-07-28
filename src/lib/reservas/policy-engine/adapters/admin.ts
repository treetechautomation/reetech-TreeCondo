/**
 * ADAPTER: Firebase Admin SDK (server) → PolicyRepository.
 *
 * Uso futuro (D.4): APIs, promoção FIFO e scheduler.
 * SOMENTE LEITURA — este adapter jamais escreve no Firestore.
 *
 * Nesta fase (D.3) o engine está isolado: nenhum código de produção o consome.
 */

import type { Firestore } from "firebase-admin/firestore";
import type {
  MemberFacts,
  PartialPolicy,
  PolicyRepository,
  PolicyVersionInfo,
  QuotaFacts,
} from "../types";
import { buildUnitKey } from "../types";
import { LEGACY_VERSION_INFO } from "../versioning";
import {
  mapLegacyArea,
  mapLegacyCondominioConfig,
  mapLegacyOpcao,
  mapMemberBlocoNorm,
  mapMemberUnidadeNorm,
} from "./legacy-mapping";

export function createAdminPolicyRepository(db: Firestore): PolicyRepository {
  const condoRef = (condominioId: string) => db.collection("condominios").doc(condominioId);

  async function readAreaDoc(
    condominioId: string,
    areaId: string
  ): Promise<Record<string, unknown> | null> {
    const snap = await condoRef(condominioId).collection("areasReservaveis").doc(areaId).get();
    return snap.exists ? ((snap.data() as Record<string, unknown>) ?? null) : null;
  }

  return {
    async getPublishedVersion(condominioId): Promise<PolicyVersionInfo> {
      // Doc futuro (D.6): condominios/{id}/config/reservasPolicy. Ausente ⇒ legado v0.
      const snap = await condoRef(condominioId).collection("config").doc("reservasPolicy").get();
      if (!snap.exists) return LEGACY_VERSION_INFO;
      const d = (snap.data() as Record<string, unknown>) ?? {};
      const version = Number(d.version);
      if (!Number.isFinite(version) || version <= 0) return LEGACY_VERSION_INFO;
      const publishedAt = d.publishedAt ? String(d.publishedAt) : null;
      return { version, publishedAt };
    },

    async getCondominioPolicy(condominioId): Promise<PartialPolicy | null> {
      const published = await condoRef(condominioId).collection("config").doc("reservasPolicy").get();
      if (published.exists) {
        const p = (published.data() as Record<string, unknown>)?.policy;
        if (p && typeof p === "object") return p as PartialPolicy;
      }
      // Compat: doc legado config/reservas (mapeamento com paridade servidor).
      const legacy = await condoRef(condominioId).collection("config").doc("reservas").get();
      return mapLegacyCondominioConfig(
        legacy.exists ? ((legacy.data() as Record<string, unknown>) ?? null) : null
      );
    },

    async getAreaPolicy(condominioId, areaId): Promise<PartialPolicy | null> {
      return mapLegacyArea(await readAreaDoc(condominioId, areaId));
    },

    async getOpcaoPolicy(condominioId, areaId, opcaoId): Promise<PartialPolicy | null> {
      return mapLegacyOpcao(await readAreaDoc(condominioId, areaId), opcaoId);
    },

    async getMemberFacts(condominioId, uid): Promise<MemberFacts> {
      const snap = await condoRef(condominioId).collection("membros").doc(uid).get();
      const md = snap.exists ? ((snap.data() as Record<string, unknown>) ?? {}) : {};
      const unidadeIdNorm = snap.exists ? mapMemberUnidadeNorm(md) : null;
      const blocoIdNorm = mapMemberBlocoNorm(md);

      // D.11.6: isPaidUp via consulta real ao financeiro (pendentes por moradorUid).
      let isPaidUp: boolean | null = null;
      try {
        const pendentesSnap = await condoRef(condominioId)
          .collection("financeiro")
          .where("moradorUid", "==", uid)
          .where("status", "in", ["AGUARDANDO_ENVIO", "ENVIADO_ADMINISTRADORA", "PROCESSANDO", "LANCADO_BOLETO"])
          .limit(1)
          .get();
        // Se existe qualquer pendência → inadimplente. Senão → adimplente.
        isPaidUp = pendentesSnap.empty;
      } catch {
        // Módulo financeiro pode não existir neste condomínio — mantém null (SKIP).
      }

      // D.11.6: recentNoShows a partir de reservas com status NO_SHOW.
      let recentNoShows = 0;
      try {
        const noShowSnap = await condoRef(condominioId)
          .collection("reservas")
          .where("uid", "==", uid)
          .where("status", "==", "NO_SHOW")
          .get();
        recentNoShows = noShowSnap.size;
      } catch {
        // status NO_SHOW pode não existir ainda — SKIP.
      }

      return {
        uid,
        exists: snap.exists,
        status: String(md.status ?? ""),
        role: String(md.role ?? ""),
        blocoIdNorm,
        unidadeIdNorm,
        isSuperAdmin: false,
        isPaidUp,
        recentNoShows,
        suspendedUntil: null, // Fonte de dados inexistente — REVISÃO HUMANA (D.12)
      };
    },

    async getQuotaFacts(condominioId, query): Promise<QuotaFacts> {
      const slotId = `${query.areaId}__${query.dateStr}`;
      const slotSnap = await condoRef(condominioId).collection("reservasSlots").doc(slotId).get();
      const filaCount = slotSnap.exists
        ? Number((slotSnap.data() as Record<string, unknown>)?.filaCount ?? 0) || 0
        : 0;

      // D.11.6+: contagem real de reservas do mês para a unidade.
      // D.11.8: sem unidadeIdNorm → UNKNOWN (não cai para UID).
      let monthCountForUnit = 0;
      let monthCountState: "KNOWN" | "UNKNOWN" | "ERROR" | undefined;
      try {
        const dateStr = query.dateStr;
        const [y, m] = dateStr.split("-").map(Number);
        const startOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
        const nextMonth = m === 12
          ? `${y + 1}-01-01`
          : `${y}-${String(m + 1).padStart(2, "0")}-01`;

        const reservaCol = condoRef(condominioId).collection("reservas");
        if (query.unidadeIdNorm) {
          const monthSnap = await reservaCol
            .where("unidadeIdNorm", "==", query.unidadeIdNorm)
            .where("dateStr", ">=", startOfMonth)
            .where("dateStr", "<", nextMonth)
            .get();
          monthCountForUnit = monthSnap.size;
          monthCountState = "KNOWN";
        } else {
          monthCountState = "UNKNOWN";
        }
      } catch {
        monthCountState = "ERROR";
      }

      // D.11.8: reservas futuras ativas — mesmo tratamento.
      let activeFutureForUnit = 0;
      let activeFutureState: "KNOWN" | "UNKNOWN" | "ERROR" | undefined;
      try {
        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date());

        const reservaCol = condoRef(condominioId).collection("reservas");
        if (query.unidadeIdNorm) {
          const futureSnap = await reservaCol
            .where("unidadeIdNorm", "==", query.unidadeIdNorm)
            .where("dateStr", ">=", today)
            .where("status", "in", ["APROVADA", "PENDENTE", "PENDENTE_PAGAMENTO"])
            .get();
          activeFutureForUnit = futureSnap.size;
          activeFutureState = "KNOWN";
        } else {
          activeFutureState = "UNKNOWN";
        }
      } catch {
        activeFutureState = "ERROR";
      }

      return {
        queueSizeForSlot: filaCount,
        monthCountForUnit,
        activeFutureForUnit,
        monthCountState,
        activeFutureState,
      };
    },
  };
}
