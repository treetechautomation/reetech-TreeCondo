/**
 * ACCESS.4 — RESOLUÇÃO DE UNIDADE ELEGÍVEL DO MORADOR.
 *
 * O morador nunca é a autoridade sobre `unitId` (ACCESS.4 §11/§12) —
 * o servidor deriva o conjunto de unidades onde ele efetivamente reside
 * a partir de `VinculoUnidade` (fonte de verdade já usada por
 * `src/app/api/reservas/criar/route.ts` e `src/lib/notifications/unitRecipients.ts`),
 * com fallback para `membroData.unidadeId`/`blocoId` (o mesmo fallback
 * legado já usado por `GET /api/anuncios`) apenas quando não há nenhum
 * VinculoUnidade — nunca inventa uma unidade.
 */

export interface EligibleUnit {
  unitId: string;
  blocoId: string | null;
}

export async function resolveEligibleUnits(
  db: FirebaseFirestore.Firestore,
  condominioId: string,
  uid: string,
  membroData: Record<string, any> | null,
): Promise<EligibleUnit[]> {
  const pessoaId = String(membroData?.pessoaId || "");

  if (pessoaId) {
    const vincSnap = await db
      .collection("condominios")
      .doc(condominioId)
      .collection("vinculosUnidades")
      .where("pessoaId", "==", pessoaId)
      .where("status", "==", "ATIVO")
      .where("resideNaUnidade", "==", true)
      .get();

    if (!vincSnap.empty) {
      const seen = new Set<string>();
      const units: EligibleUnit[] = [];
      for (const doc of vincSnap.docs) {
        const v = doc.data() || {};
        const unitId = String(v.unitDocId || "");
        if (!unitId || seen.has(unitId)) continue;
        seen.add(unitId);
        units.push({ unitId, blocoId: v.blocoId ? String(v.blocoId) : null });
      }
      if (units.length > 0) return units;
    }
  }

  // Fallback legado: membro sem VinculoUnidade ainda migrado.
  const legacyUnitId = membroData?.unidadeId ? String(membroData.unidadeId) : "";
  if (legacyUnitId) {
    return [{ unitId: legacyUnitId, blocoId: membroData?.blocoId ? String(membroData.blocoId) : null }];
  }

  return [];
}

/**
 * Aplica a regra do §11: 1 unidade elegível -> deriva automaticamente;
 * >1 -> exige `requestedUnitId` e valida que pertence ao conjunto;
 * 0 -> nenhuma unidade elegível (o chamador deve tratar como
 * NO_ACTIVE_UNIT). Nunca aceita um `requestedUnitId` fora do conjunto
 * elegível, mesmo que sintaticamente válido.
 */
export type UnitSelectionResult =
  | { ok: true; unit: EligibleUnit }
  | { ok: false; reason: "NO_ACTIVE_UNIT" }
  | { ok: false; reason: "AMBIGUOUS_REQUIRES_UNIT_ID" }
  | { ok: false; reason: "INVALID_UNIT" };

export function selectUnit(eligible: EligibleUnit[], requestedUnitId?: string | null): UnitSelectionResult {
  if (eligible.length === 0) return { ok: false, reason: "NO_ACTIVE_UNIT" };

  if (eligible.length === 1) {
    if (requestedUnitId && requestedUnitId !== eligible[0].unitId) {
      return { ok: false, reason: "INVALID_UNIT" };
    }
    return { ok: true, unit: eligible[0] };
  }

  if (!requestedUnitId) return { ok: false, reason: "AMBIGUOUS_REQUIRES_UNIT_ID" };
  const match = eligible.find((u) => u.unitId === requestedUnitId);
  if (!match) return { ok: false, reason: "INVALID_UNIT" };
  return { ok: true, unit: match };
}

// ─────────────────────────── ACCESS.5B — labels for UI discovery ───────────────────────────

export interface EligibleUnitWithLabel extends EligibleUnit {
  label: string;
}

/**
 * Enriquece o MESMO conjunto retornado por `resolveEligibleUnits` (a
 * única fonte de verdade de elegibilidade, também usada pelo CREATE)
 * com um label humano, derivado dos campos canônicos reais de
 * `blocos/{blocoId}` (`nome`/legado `blocoNome`) e
 * `blocos/{blocoId}/unidades/{unitId}` (`numero`/legado
 * `unidadeNumero`) — mesmos campos já usados em
 * `/api/acessos/create` e `/api/anuncios`. Nunca inventa formato novo;
 * se nenhum metadado de nome/número existir, usa o próprio ID como
 * último recurso (nunca deveria acontecer em dados reais, mas não
 * lança).
 *
 * Usada SOMENTE pelo endpoint de contexto (`GET
 * /api/acesso-controle/contexto`) — o CREATE continua chamando
 * `resolveEligibleUnits`/`selectUnit` diretamente, sem depender desta
 * função nem dos campos de label.
 */
export async function listEligibleUnitsWithLabels(
  db: FirebaseFirestore.Firestore,
  condominioId: string,
  uid: string,
  membroData: Record<string, any> | null,
): Promise<EligibleUnitWithLabel[]> {
  const eligible = await resolveEligibleUnits(db, condominioId, uid, membroData);
  if (eligible.length === 0) return [];

  const blocoCache = new Map<string, { nome: string }>();

  const withLabels = await Promise.all(
    eligible.map(async (unit) => {
      let blocoNome = "";
      if (unit.blocoId) {
        if (!blocoCache.has(unit.blocoId)) {
          const blocoSnap = await db.collection("condominios").doc(condominioId).collection("blocos").doc(unit.blocoId).get();
          const bd = blocoSnap.exists ? (blocoSnap.data() || {}) : {};
          blocoCache.set(unit.blocoId, { nome: String(bd.nome || bd.blocoNome || unit.blocoId) });
        }
        blocoNome = blocoCache.get(unit.blocoId)!.nome;
      }

      let unidadeNumero = unit.unitId;
      if (unit.blocoId) {
        const unidadeSnap = await db
          .collection("condominios").doc(condominioId)
          .collection("blocos").doc(unit.blocoId)
          .collection("unidades").doc(unit.unitId)
          .get();
        if (unidadeSnap.exists) {
          const ud = unidadeSnap.data() || {};
          unidadeNumero = String(ud.numero || ud.unidadeNumero || unit.unitId);
        }
      }

      const label = blocoNome ? `Apto ${unidadeNumero} — ${blocoNome}` : `Unidade ${unidadeNumero}`;
      return { ...unit, label };
    }),
  );

  return withLabels;
}
