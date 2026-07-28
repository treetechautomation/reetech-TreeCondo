/**
 * FASE D.10 — FIRESTORE REGULAMENTO REPOSITORY.
 *
 * Implementação concreta do RegulamentoRepository com Firebase Admin SDK.
 * Toda gravação é transacional. Toda operação recebe condominioId.
 *
 * Firestore paths:
 *   condominios/{id}/config/reservasPolicy/  (doc raiz)
 *   condominios/{id}/config/reservasPolicy/rascunho
 *   condominios/{id}/config/reservasPolicy/publicada
 *   condominios/{id}/config/reservasPolicy/historico/version_{N}
 */

import type { Firestore, Transaction } from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { RegulamentoRepository } from "./regulamento-repository";
import { policyHash } from "./versioning";
import { LEGACY_POLICY_CHACARA_ITAGUAI } from "./defaults";
import { mergePolicyLayers } from "./resolver";
import type {
  OperacaoStatus,
  PolicyDocument,
  RegulamentoDocument,
  RegulamentoDraftInput,
  RegulamentoExport,
  RegulamentoVersionInfo,
} from "./types";

function configRef(db: Firestore, condominioId: string) {
  return db.collection("condominios").doc(condominioId).collection("config").doc("reservasPolicy");
}

function draftRef(db: Firestore, condominioId: string) {
  // rascunho é subcoleção para manter o doc raiz limpo
  return configRef(db, condominioId).collection("dados").doc("rascunho");
}

function publicadaRef(db: Firestore, condominioId: string) {
  return configRef(db, condominioId).collection("dados").doc("publicada");
}

function historyRef(db: Firestore, condominioId: string, version: number) {
  return configRef(db, condominioId).collection("historico").doc(`version_${version}`);
}

function historyCol(db: Firestore, condominioId: string) {
  return configRef(db, condominioId).collection("historico");
}

function serializeDoc(doc: RegulamentoDocument): Record<string, unknown> {
  return {
    condominioId: doc.condominioId,
    currentVersion: doc.currentVersion,
    publishedAt: doc.publishedAt,
    artigos: doc.artigos,
    regras: doc.regras,
    policy: doc.policy,
    areaOverrides: doc.areaOverrides ?? {},
    opcaoOverrides: doc.opcaoOverrides ?? {},
    clonedFrom: doc.clonedFrom ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function parseDoc(data: Record<string, unknown> | undefined, condominioId: string): RegulamentoDocument | null {
  if (!data) return null;
  return {
    condominioId: String(data.condominioId ?? condominioId),
    currentVersion: Number(data.currentVersion ?? 0),
    publishedAt: data.publishedAt ? String(data.publishedAt) : null,
    history: [],
    artigos: (data.artigos as any[]) ?? [],
    regras: (data.regras as any[]) ?? [],
    policy: (data.policy ?? LEGACY_POLICY_CHACARA_ITAGUAI) as PolicyDocument,
    areaOverrides: (data.areaOverrides as any) ?? {},
    opcaoOverrides: (data.opcaoOverrides as any) ?? {},
    clonedFrom: data.clonedFrom ? String(data.clonedFrom) : null,
    createdAt: data.createdAt ? String(data.createdAt) : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createFirestoreRegulamentoRepository(db: Firestore): RegulamentoRepository {
  // ── Rascunho ─────────────────────────────────────────────────────────────

  async function getDraft(condominioId: string): Promise<RegulamentoDocument | null> {
    const snap = await draftRef(db, condominioId).get();
    return snap.exists ? parseDoc(snap.data(), condominioId) : null;
  }

  async function saveDraft(condominioId: string, input: RegulamentoDraftInput): Promise<OperacaoStatus> {
    const policy = mergePolicyLayers([
      { level: "CONDOMINIO", data: input.policy },
    ]).policy;

    const doc: Record<string, unknown> = {
      condominioId,
      currentVersion: 0,
      publishedAt: null,
      artigos: input.artigos ?? [],
      regras: input.regras ?? [],
      policy,
      areaOverrides: input.areaOverrides ?? {},
      opcaoOverrides: input.opcaoOverrides ?? {},
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await draftRef(db, condominioId).set(doc, { merge: true });
    return { success: true, message: "Rascunho salvo." };
  }

  async function deleteDraft(condominioId: string): Promise<OperacaoStatus> {
    await draftRef(db, condominioId).delete();
    return { success: true, message: "Rascunho removido." };
  }

  // ── Publicação ───────────────────────────────────────────────────────────

  async function getPublished(condominioId: string): Promise<RegulamentoDocument | null> {
    const snap = await publicadaRef(db, condominioId).get();
    return snap.exists ? parseDoc(snap.data(), condominioId) : null;
  }

  async function publish(
    condominioId: string,
    versionInfo: RegulamentoVersionInfo,
  ): Promise<OperacaoStatus> {
    const draftSnap = await draftRef(db, condominioId).get();
    if (!draftSnap.exists) {
      return { success: false, message: "Nenhum rascunho para publicar." };
    }
    const draft = parseDoc(draftSnap.data(), condominioId)!;

    try {
      await db.runTransaction(async (tx: Transaction) => {
        // 1. Reler publicada dentro da transação (concorrência)
        const pubSnap = await tx.get(publicadaRef(db, condominioId));
        const currentPub = pubSnap.exists ? parseDoc(pubSnap.data(), condominioId) : null;
        const currentVersion = currentPub?.currentVersion ?? 0;

        // 2. Versão esperada: current + 1
        const expectedVersion = currentVersion + 1;
        if (versionInfo.version !== expectedVersion) {
          throw new Error(
            `Conflito de versão: esperado v${expectedVersion}, recebido v${versionInfo.version}. Outra publicação ocorreu simultaneamente.`
          );
        }

        // 3. Gravar histórico (imutável)
        tx.set(historyRef(db, condominioId, versionInfo.version), {
          version: versionInfo.version,
          publishedAt: versionInfo.publishedAt,
          authorUid: versionInfo.authorUid,
          authorNome: versionInfo.authorNome,
          contentHash: versionInfo.contentHash,
          observacao: versionInfo.observacao,
          status: versionInfo.status,
          createdAt: FieldValue.serverTimestamp(),
        });

        // 4. Atualizar publicada
        tx.set(publicadaRef(db, condominioId), {
          ...serializeDoc(draft),
          currentVersion: versionInfo.version,
          publishedAt: versionInfo.publishedAt,
          createdAt: draftSnap.data()?.createdAt ?? FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: false });

        // 5. Marcar rascunho como publicado (flag)
        tx.set(draftRef(db, condominioId), {
          condominioId,
          status: "PUBLISHED",
          publishedAsVersion: versionInfo.version,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      });

      return { success: true, message: `Publicado v${versionInfo.version}.`, version: versionInfo.version };
    } catch (err: any) {
      return { success: false, message: `Falha na publicação: ${err?.message || err}` };
    }
  }

  // ── Revogação ────────────────────────────────────────────────────────────

  async function revoke(
    condominioId: string,
    versionInfo: RegulamentoVersionInfo,
  ): Promise<OperacaoStatus> {
    const pubSnap = await publicadaRef(db, condominioId).get();
    if (!pubSnap.exists) {
      return { success: false, message: "Nenhum regulamento publicado para revogar." };
    }

    await db.runTransaction(async (tx: Transaction) => {
      // Reler dentro da transação
      const currentPubSnap = await tx.get(publicadaRef(db, condominioId));
      if (!currentPubSnap.exists) {
        throw new Error("Regulamento removido durante a transação.");
      }

      // Gravar entrada de revogação no histórico
      tx.set(historyRef(db, condominioId, versionInfo.version), {
        version: versionInfo.version,
        publishedAt: versionInfo.publishedAt,
        authorUid: versionInfo.authorUid,
        authorNome: versionInfo.authorNome,
        contentHash: versionInfo.contentHash,
        observacao: versionInfo.observacao,
        status: "REVOGADA",
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, message: `Revogado (v${versionInfo.version}).`, version: versionInfo.version };
  }

  // ── Histórico ────────────────────────────────────────────────────────────

  async function getHistory(condominioId: string): Promise<RegulamentoVersionInfo[]> {
    const snap = await historyCol(db, condominioId)
      .orderBy("version", "desc")
      .limit(50)
      .get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        version: Number(data.version ?? 0),
        publishedAt: String(data.publishedAt ?? ""),
        authorUid: String(data.authorUid ?? ""),
        authorNome: String(data.authorNome ?? ""),
        contentHash: String(data.contentHash ?? ""),
        observacao: String(data.observacao ?? ""),
        status: String(data.status ?? "PUBLICADA") as "PUBLICADA" | "REVOGADA" | "RASCUNHO",
      };
    });
  }

  async function getVersion(condominioId: string, version: number): Promise<RegulamentoDocument | null> {
    const histSnap = await historyRef(db, condominioId, version).get();
    if (!histSnap.exists) return null;
    const pubSnap = await publicadaRef(db, condominioId).get();
    return pubSnap.exists ? parseDoc(pubSnap.data(), condominioId) : null;
  }

  // ── Exportação / Importação ──────────────────────────────────────────────

  async function buildExport(condominioId: string): Promise<RegulamentoExport | null> {
    const pubSnap = await publicadaRef(db, condominioId).get();
    if (!pubSnap.exists) return null;
    const pub = parseDoc(pubSnap.data(), condominioId)!;
    const history = await getHistory(condominioId);

    return {
      schemaVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      exportedBy: "firestore-admin",
      sourceCondominioId: condominioId,
      regulamento: {
        currentVersion: pub.currentVersion,
        publishedAt: pub.publishedAt,
        history,
        artigos: pub.artigos,
        regras: pub.regras,
        policy: pub.policy,
        areaOverrides: pub.areaOverrides,
        opcaoOverrides: pub.opcaoOverrides,
        clonedFrom: pub.clonedFrom,
      },
      contentHash: policyHash(pub.policy),
    };
  }

  async function importDraft(condominioId: string, data: RegulamentoExport): Promise<OperacaoStatus> {
    const policy = (data.regulamento.policy ?? LEGACY_POLICY_CHACARA_ITAGUAI) as PolicyDocument;
    await draftRef(db, condominioId).set({
      condominioId,
      currentVersion: 0,
      publishedAt: null,
      artigos: data.regulamento.artigos ?? [],
      regras: data.regulamento.regras ?? [],
      policy,
      areaOverrides: data.regulamento.areaOverrides ?? {},
      opcaoOverrides: data.regulamento.opcaoOverrides ?? {},
      clonedFrom: data.sourceCondominioId ?? null,
      _importedFrom: data.sourceCondominioId,
      _importedAt: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { success: true, message: "Importado como rascunho.", version: 1 };
  }

  // ── Metadados ────────────────────────────────────────────────────────────

  async function getLatestVersion(condominioId: string): Promise<number> {
    const pubSnap = await publicadaRef(db, condominioId).get();
    return pubSnap.exists ? Number(pubSnap.data()?.currentVersion ?? 0) : 0;
  }

  // ── Utilitário extra: obter a política publicada (compatível com PolicyRepository) ──

  async function getPublishedPolicy(condominioId: string): Promise<PolicyDocument | null> {
    const pubSnap = await publicadaRef(db, condominioId).get();
    if (!pubSnap.exists) return null;
    const data = pubSnap.data();
    return (data?.policy as PolicyDocument) ?? null;
  }

  return {
    getDraft,
    saveDraft,
    deleteDraft,
    getPublished,
    publish,
    revoke,
    getHistory,
    getVersion,
    buildExport,
    importDraft,
    getLatestVersion,
  };
}

export type FirestoreRegulamentoRepository = ReturnType<typeof createFirestoreRegulamentoRepository>;
