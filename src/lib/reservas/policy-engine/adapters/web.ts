/**
 * ADAPTER: Firebase Web SDK (client) → PolicyRepository.
 *
 * Uso futuro (D.5): calendário, hooks e páginas passam a consumir as MESMAS
 * regras puras do engine para UX (o enforcement continua 100% no server).
 * SOMENTE LEITURA. Nesta fase (D.3), nenhum componente o consome.
 */

import { doc, getDoc, collection, query, where, getDocs, limit, type Firestore } from "firebase/firestore";
import type {
  MemberFacts,
  PartialPolicy,
  PolicyRepository,
  PolicyVersionInfo,
  QuotaFacts,
} from "../types";
import { LEGACY_VERSION_INFO } from "../versioning";
import {
  mapLegacyArea,
  mapLegacyCondominioConfig,
  mapLegacyOpcao,
  mapMemberBlocoNorm,
  mapMemberUnidadeNorm,
} from "./legacy-mapping";

export function createWebPolicyRepository(db: Firestore): PolicyRepository {
  async function readDoc(...path: [string, string, ...string[]]): Promise<Record<string, unknown> | null> {
    try {
      const snap = await getDoc(doc(db, ...path));
      return snap.exists() ? ((snap.data() as Record<string, unknown>) ?? null) : null;
    } catch {
      return null;
    }
  }

  return {
    async getPublishedVersion(condominioId): Promise<PolicyVersionInfo> {
      const d = await readDoc("condominios", condominioId, "config", "reservasPolicy");
      if (!d) return LEGACY_VERSION_INFO;
      const version = Number(d.version);
      if (!Number.isFinite(version) || version <= 0) return LEGACY_VERSION_INFO;
      return { version, publishedAt: d.publishedAt ? String(d.publishedAt) : null };
    },

    async getCondominioPolicy(condominioId): Promise<PartialPolicy | null> {
      const published = await readDoc("condominios", condominioId, "config", "reservasPolicy");
      const p = published?.policy;
      if (p && typeof p === "object") return p as PartialPolicy;
      const legacy = await readDoc("condominios", condominioId, "config", "reservas");
      return mapLegacyCondominioConfig(legacy);
    },

    async getAreaPolicy(condominioId, areaId): Promise<PartialPolicy | null> {
      return mapLegacyArea(await readDoc("condominios", condominioId, "areasReservaveis", areaId));
    },

    async getOpcaoPolicy(condominioId, areaId, opcaoId): Promise<PartialPolicy | null> {
      return mapLegacyOpcao(
        await readDoc("condominios", condominioId, "areasReservaveis", areaId),
        opcaoId
      );
    },

    async getMemberFacts(condominioId, uid): Promise<MemberFacts> {
      const md = (await readDoc("condominios", condominioId, "membros", uid)) ?? {};
      const exists = Object.keys(md).length > 0;

      // D.11.6: isPaidUp via consulta real ao financeiro.
      let isPaidUp: boolean | null = null;
      try {
        const finCol = collection(db, "condominios", condominioId, "financeiro");
        const q = query(
          finCol,
          where("moradorUid", "==", uid),
          where("status", "in", ["AGUARDANDO_ENVIO", "ENVIADO_ADMINISTRADORA", "PROCESSANDO", "LANCADO_BOLETO"]),
          limit(1),
        );
        const snap = await getDocs(q);
        isPaidUp = snap.empty;
      } catch {
        // Módulo financeiro pode não existir.
      }

      return {
        uid,
        exists,
        status: String(md.status ?? ""),
        role: String(md.role ?? ""),
        blocoIdNorm: mapMemberBlocoNorm(md),
        unidadeIdNorm: mapMemberUnidadeNorm(md),
        isSuperAdmin: false,
        isPaidUp,
        recentNoShows: 0,
        suspendedUntil: null,
      };
    },

    async getQuotaFacts(condominioId, quotaQuery): Promise<QuotaFacts> {
      const slot = await readDoc(
        "condominios",
        condominioId,
        "reservasSlots",
        `${quotaQuery.areaId}__${quotaQuery.dateStr}`
      );

      // D.11.6: contagem real de reservas do mês.
      let monthCountForUnit = 0;
      try {
        const [y, m] = quotaQuery.dateStr.split("-").map(Number);
        const startOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
        const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
        const resCol = collection(db, "condominios", condominioId, "reservas");
        const monthQ = query(resCol, where("uid", "==", quotaQuery.uid), where("dateStr", ">=", startOfMonth), where("dateStr", "<", nextMonth));
        monthCountForUnit = (await getDocs(monthQ)).size;
      } catch { /* SKIP */ }

      // D.11.6: contagem real de reservas futuras ativas.
      let activeFutureForUnit = 0;
      try {
        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date());
        const resCol = collection(db, "condominios", condominioId, "reservas");
        const futureQ = query(resCol, where("uid", "==", quotaQuery.uid), where("dateStr", ">=", today), where("status", "in", ["APROVADA", "PENDENTE", "PENDENTE_PAGAMENTO"]));
        activeFutureForUnit = (await getDocs(futureQ)).size;
      } catch { /* SKIP */ }

      return {
        queueSizeForSlot: Number(slot?.filaCount ?? 0) || 0,
        monthCountForUnit,
        activeFutureForUnit,
      };
    },
  };
}
