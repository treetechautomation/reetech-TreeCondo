/**
 * FASE D.9 — TESTES DO CICLO DE VIDA DE REGULAMENTOS.
 *
 * Cobre:
 *   - criar/editar/descartar rascunho;
 *   - validar rascunho (regras, artigos, política);
 *   - publicar (versão, hash, histórico, snapshot);
 *   - revogar;
 *   - histórico imutável;
 *   - exportar (JSON portável, hash);
 *   - importar (validação, nunca publica);
 *   - clonar (entre condomínios, nunca publica);
 *   - isolamento entre condomínios;
 *   - snapshots preservados após publicação.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  createRegulamentoAdminService,
  DEFAULT_POLICY,
  LEGACY_POLICY_CHACARA_ITAGUAI,
  mergePolicyLayers,
  policyHash,
  type PartialPolicy,
} from "../index";
import type { RegulamentoRepository } from "../regulamento-repository";
import type {
  RegulamentoAuthContext,
  RegulamentoDocument,
  RegulamentoDraftInput,
  RegulamentoExport,
  RegulamentoVersionInfo,
} from "../types";
import { buildSnapshot } from "../snapshots";

// ── Fake Repository (in-memory, sem Firestore) ──────────────────────────────

function fakeRegulamentoRepo(): RegulamentoRepository {
  const drafts = new Map<string, RegulamentoDocument>();
  const published = new Map<string, RegulamentoDocument>();
  const history = new Map<string, RegulamentoVersionInfo[]>();

  return {
    async getDraft(condominioId) {
      return drafts.get(condominioId) ?? null;
    },
    async saveDraft(condominioId, input) {
      drafts.set(condominioId, {
        condominioId,
        currentVersion: (published.get(condominioId)?.currentVersion ?? 0) + 1,
        publishedAt: null,
        history: [],
        artigos: (input.artigos as any) ?? [],
        regras: (input.regras as any) ?? [],
        policy: mergePolicyLayers([{ level: "CONDOMINIO", data: input.policy }]).policy,
        areaOverrides: input.areaOverrides ?? {},
        opcaoOverrides: input.opcaoOverrides ?? {},
        clonedFrom: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as RegulamentoDocument);
      return { success: true, message: "Rascunho salvo.", version: 0 };
    },
    async deleteDraft(condominioId) {
      drafts.delete(condominioId);
      return { success: true, message: "Rascunho removido." };
    },
    async getPublished(condominioId) {
      return published.get(condominioId) ?? null;
    },
    async publish(condominioId, versionInfo) {
      const draft = drafts.get(condominioId);
      if (!draft) return { success: false, message: "Nenhum rascunho para publicar." };
      const doc: RegulamentoDocument = {
        ...draft,
        currentVersion: versionInfo.version,
        publishedAt: versionInfo.publishedAt,
        history: [
          versionInfo,
          ...(published.get(condominioId)?.history ?? []),
        ],
        updatedAt: new Date().toISOString(),
      };
      published.set(condominioId, doc);
      const h = history.get(condominioId) ?? [];
      h.unshift(versionInfo);
      history.set(condominioId, h);
      drafts.delete(condominioId);
      return { success: true, message: "Publicado.", version: versionInfo.version };
    },
    async revoke(condominioId, versionInfo) {
      const pub = published.get(condominioId);
      if (!pub) return { success: false, message: "Nada para revogar." };
      const h = history.get(condominioId) ?? [];
      h.unshift(versionInfo);
      history.set(condominioId, h);
      return { success: true, message: "Revogado.", version: versionInfo.version };
    },
    async getHistory(condominioId) {
      return history.get(condominioId) ?? [];
    },
    async getVersion(condominioId, version) {
      const h = history.get(condominioId) ?? [];
      const v = h.find((x) => x.version === version);
      if (!v) return null;
      return published.get(condominioId) ?? null;
    },
    async buildExport(condominioId) {
      const pub = published.get(condominioId);
      if (!pub) return null;
      return {
        schemaVersion: 1 as const,
        exportedAt: new Date().toISOString(),
        exportedBy: "test",
        sourceCondominioId: condominioId,
        regulamento: {
          currentVersion: pub.currentVersion,
          publishedAt: pub.publishedAt,
          history: pub.history,
          artigos: pub.artigos,
          regras: pub.regras,
          policy: pub.policy,
          areaOverrides: pub.areaOverrides,
          opcaoOverrides: pub.opcaoOverrides,
          clonedFrom: pub.clonedFrom,
        },
        contentHash: policyHash(pub.policy),
      };
    },
    async importDraft(condominioId, data) {
      const policy = data.regulamento.policy as any;
      drafts.set(condominioId, {
        condominioId,
        currentVersion: 1,
        publishedAt: null,
        history: [],
        artigos: data.regulamento.artigos as any,
        regras: data.regulamento.regras as any,
        policy,
        areaOverrides: (data.regulamento.areaOverrides as any) ?? {},
        opcaoOverrides: (data.regulamento.opcaoOverrides as any) ?? {},
        clonedFrom: data.sourceCondominioId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as RegulamentoDocument);
      return { success: true, message: "Importado como rascunho.", version: 1 };
    },
    async getLatestVersion(condominioId) {
      return published.get(condominioId)?.currentVersion ?? 0;
    },
  };
}

const CHACARA = "RtJ7G92QwWvJ13Qq8Ntx";
const COND_NOVO = "condNovoD9";

function adminCtx(condominioId: string): RegulamentoAuthContext {
  return { uid: "admin-1", role: "ADMIN_CONDOMINIO", nome: "Síndico Teste", condominioId };
}

function draftInput(over: Partial<RegulamentoDraftInput> = {}): RegulamentoDraftInput {
  return {
    policy: {
      quota: { maxQueueSize: 5 },
      cancellation: { minHoursBeforeEvent: 24 },
    } as PartialPolicy,
    artigos: [
      { artigo: "1", titulo: "Disposições Gerais", descricao: "Regras gerais.", categoria: "ELEGIBILIDADE", ativo: true },
    ],
    regras: [
      { code: "MEMBRO_INATIVO", artigo: "1", categoria: "ELEGIBILIDADE", prioridade: "BLOQUEANTE", mensagem: "Membro inativo.", valor: true, origem: "CONDOMINIO" },
    ],
    ...over,
  };
}

beforeEach(() => {
  // Cada teste cria sua própria instância
});

// ════════════════════════════════════ RASCUNHO ═══════════════════════════════

test("D901 rascunho — criar e ler rascunho", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  const r = await svc.createDraft(CHACARA, draftInput());
  assert.equal(r.success, true);
  const draft = await svc.getDraft(CHACARA);
  assert.ok(draft);
  assert.ok(draft!.policy);
});

test("D902 rascunho — editar rascunho existente", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  await svc.createDraft(CHACARA, draftInput());
  const updated = await svc.updateDraft(CHACARA, draftInput({
    policy: { quota: { maxQueueSize: 10 } } as PartialPolicy,
  }));
  assert.equal(updated.success, true);
  const draft = await svc.getDraft(CHACARA);
  assert.equal((draft?.policy.quota as any)?.maxQueueSize, 10);
});

test("D903 rascunho — editar sem existir falha", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  const r = await svc.updateDraft(CHACARA, draftInput());
  assert.equal(r.success, false);
});

test("D904 rascunho — descartar remove o rascunho", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  await svc.createDraft(CHACARA, draftInput());
  await svc.discardDraft(CHACARA);
  const draft = await svc.getDraft(CHACARA);
  assert.equal(draft, null);
});

// ════════════════════════════════════ VALIDAÇÃO ══════════════════════════════

test("D905 validação — rascunho válido passa", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  await svc.createDraft(CHACARA, draftInput());
  const v = await svc.validateDraft(CHACARA);
  assert.equal(v.valid, true);
  assert.ok(v.resolvedPolicy);
});

test("D906 validação — sem rascunho falha", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  const v = await svc.validateDraft(CHACARA);
  assert.equal(v.valid, false);
});

test("D907 validação — RuleCode desconhecido gera erro", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  await svc.createDraft(CHACARA, draftInput({
    regras: [{ code: "REGRA_INEXISTENTE", artigo: "1", categoria: "ELEGIBILIDADE", prioridade: "BLOQUEANTE", mensagem: "X", valor: null, origem: "CONDOMINIO" }],
  }));
  const v = await svc.validateDraft(CHACARA);
  assert.equal(v.valid, false);
  assert.ok(v.errors.some((e) => e.includes("REGRA_INEXISTENTE")));
});

// ════════════════════════════════════ PUBLICAÇÃO ═════════════════════════════

test("D908 publicação — rascunho válido publica com sucesso (v1)", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  await svc.createDraft(CHACARA, draftInput());
  const r = await svc.publishPolicy({
    condominioId: CHACARA, observacao: "Primeira publicação.",
    author: adminCtx(CHACARA),
  });
  assert.equal(r.success, true);
  assert.equal(r.version, 1);
  assert.ok(r.contentHash);
  assert.ok(r.policy);
  assert.ok(r.snapshot);
});

test("D909 publicação — sem rascunho falha", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  const r = await svc.publishPolicy({
    condominioId: CHACARA, observacao: "Tentativa.",
    author: adminCtx(CHACARA),
  });
  assert.equal(r.success, false);
});

test("D910 publicação — autor de outro condomínio é rejeitado", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  await svc.createDraft(CHACARA, draftInput());
  const r = await svc.publishPolicy({
    condominioId: CHACARA, observacao: "Tentativa.",
    author: adminCtx("outroCondo"),
  });
  assert.equal(r.success, false);
});

test("D911 publicação — incrementa versão (v1 → v2 → v3)", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);

  await svc.createDraft(CHACARA, draftInput());
  const r1 = await svc.publishPolicy({ condominioId: CHACARA, observacao: "v1", author: adminCtx(CHACARA) });
  assert.equal(r1.version, 1);

  await svc.createDraft(CHACARA, draftInput({ policy: { quota: { maxQueueSize: 7 } } as PartialPolicy }));
  const r2 = await svc.publishPolicy({ condominioId: CHACARA, observacao: "v2", author: adminCtx(CHACARA) });
  assert.equal(r2.version, 2);

  await svc.createDraft(CHACARA, draftInput({ policy: { quota: { maxQueueSize: 15 } } as PartialPolicy }));
  const r3 = await svc.publishPolicy({ condominioId: CHACARA, observacao: "v3", author: adminCtx(CHACARA) });
  assert.equal(r3.version, 3);
});

// ════════════════════════════════════ REVOGAÇÃO ══════════════════════════════

test("D912 revogação — regulamento publicado pode ser revogado", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  await svc.createDraft(CHACARA, draftInput());
  await svc.publishPolicy({ condominioId: CHACARA, observacao: "v1", author: adminCtx(CHACARA) });
  const r = await svc.revokePolicy({ condominioId: CHACARA, observacao: "Revogado por teste.", author: adminCtx(CHACARA) });
  assert.equal(r.success, true);
});

test("D913 revogação — sem publicação prévia falha", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  const r = await svc.revokePolicy({ condominioId: CHACARA, observacao: "X", author: adminCtx(CHACARA) });
  assert.equal(r.success, false);
});

// ════════════════════════════════════ HISTÓRICO ══════════════════════════════

test("D914 histórico — cada publicação gera entrada imutável", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);

  await svc.createDraft(CHACARA, draftInput());
  await svc.publishPolicy({ condominioId: CHACARA, observacao: "v1", author: adminCtx(CHACARA) });

  await svc.createDraft(CHACARA, draftInput({ policy: { quota: { maxQueueSize: 10 } } as PartialPolicy }));
  await svc.publishPolicy({ condominioId: CHACARA, observacao: "v2", author: adminCtx(CHACARA) });

  const h = await svc.getHistory(CHACARA);
  assert.equal(h.length, 2);
  assert.equal(h[0].version, 2);
  assert.equal(h[0].status, "PUBLICADA");
  assert.equal(h[1].version, 1);
});

test("D915 histórico — revogação também gera entrada no histórico", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  await svc.createDraft(CHACARA, draftInput());
  await svc.publishPolicy({ condominioId: CHACARA, observacao: "v1", author: adminCtx(CHACARA) });
  await svc.revokePolicy({ condominioId: CHACARA, observacao: "revogado", author: adminCtx(CHACARA) });
  const h = await svc.getHistory(CHACARA);
  assert.equal(h.length, 2);
  assert.equal(h[0].status, "REVOGADA");
});

// ════════════════════════════════════ EXPORTAÇÃO ═════════════════════════════

test("D916 exportação — regulamento publicado gera JSON portável com hash", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  await svc.createDraft(CHACARA, draftInput());
  await svc.publishPolicy({ condominioId: CHACARA, observacao: "v1", author: adminCtx(CHACARA) });
  const r = await svc.exportPolicy(CHACARA);
  assert.equal(r.success, true);
  assert.ok(r.data);
  assert.equal(r.data!.schemaVersion, 1);
  assert.equal(r.data!.sourceCondominioId, CHACARA);
  assert.ok(r.data!.contentHash);
});

test("D917 exportação — sem regulamento retorna erro", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  const r = await svc.exportPolicy(CHACARA);
  assert.equal(r.success, false);
});

// ════════════════════════════════════ IMPORTAÇÃO ═════════════════════════════

test("D918 importação — JSON válido cria rascunho (NUNCA publica)", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  await svc.createDraft(CHACARA, draftInput());
  await svc.publishPolicy({ condominioId: CHACARA, observacao: "v1", author: adminCtx(CHACARA) });
  const exp = await svc.exportPolicy(CHACARA);

  const r = await svc.importPolicy(COND_NOVO, exp.data!);
  assert.equal(r.success, true);
  assert.ok(r.draftVersion);

  // Confirmar que NÃO publicou
  const pub = await repo.getPublished(COND_NOVO);
  assert.equal(pub, null);
  // Confirmar que criou rascunho
  const draft = await svc.getDraft(COND_NOVO);
  assert.ok(draft);
});

test("D919 importação — schema inválido é rejeitado", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  const r = await svc.importPolicy(COND_NOVO, { schemaVersion: 99 } as any);
  assert.equal(r.success, false);
  assert.ok(r.validation.errors.some((e) => e.includes("Schema version")));
});

// ════════════════════════════════════ CLONAGEM ═══════════════════════════════

test("D920 clonagem — regulamento da Chácara clonado para novo condomínio (NUNCA publica)", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);

  await svc.createDraft(CHACARA, draftInput());
  await svc.publishPolicy({ condominioId: CHACARA, observacao: "v1", author: adminCtx(CHACARA) });

  const r = await svc.clonePolicy({
    sourceCondominioId: CHACARA,
    targetCondominioId: COND_NOVO,
    author: adminCtx(COND_NOVO),
    observacao: "Clonado da Chácara.",
    overwrite: false,
  });

  assert.equal(r.success, true);
  assert.ok(r.contentHash);
  // Confirmar que NÃO publicou
  const pub = await repo.getPublished(COND_NOVO);
  assert.equal(pub, null);
});

test("D921 clonagem — origem = destino falha", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  const r = await svc.clonePolicy({
    sourceCondominioId: CHACARA, targetCondominioId: CHACARA,
    author: adminCtx(CHACARA), observacao: "X", overwrite: false,
  });
  assert.equal(r.success, false);
});

test("D922 clonagem — autor de outro condomínio falha", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  await svc.createDraft(CHACARA, draftInput());
  await svc.publishPolicy({ condominioId: CHACARA, observacao: "v1", author: adminCtx(CHACARA) });
  const r = await svc.clonePolicy({
    sourceCondominioId: CHACARA, targetCondominioId: COND_NOVO,
    author: adminCtx(CHACARA), // autor do source, não do target
    observacao: "X", overwrite: false,
  });
  assert.equal(r.success, false);
});

// ════════════════════════════ ISOLAMENTO + SNAPSHOTS ═════════════════════════

test("D923 isolamento — rascunho no condomínio A não afeta condomínio B", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  await svc.createDraft(CHACARA, draftInput());
  await svc.createDraft(COND_NOVO, draftInput({ policy: { quota: { maxQueueSize: 99 } } as PartialPolicy }));
  const da = await svc.getDraft(CHACARA);
  const db = await svc.getDraft(COND_NOVO);
  assert.equal((da?.policy?.quota as any)?.maxQueueSize, 5);
  assert.equal((db?.policy?.quota as any)?.maxQueueSize, 99);
});

test("D924 isolamento — publicação no condomínio A não afeta versão do B", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  await svc.createDraft(CHACARA, draftInput());
  await svc.publishPolicy({ condominioId: CHACARA, observacao: "v1", author: adminCtx(CHACARA) });
  const vB = await repo.getLatestVersion(COND_NOVO);
  assert.equal(vB, 0); // nunca publicado
});

test("D925 snapshots — publicação nova não altera snapshot do condomínio A no B", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);
  await svc.createDraft(CHACARA, draftInput());
  const r = await svc.publishPolicy({ condominioId: CHACARA, observacao: "v1", author: adminCtx(CHACARA) });
  const snap = r.snapshot;
  assert.equal(snap.condominioId, CHACARA);
  // Snapshot contém hash do regulamento do condomínio correto
  assert.equal(snap.policyHash, policyHash(r.policy));

  // Novo condomínio não tem este hash
  const draftB = await svc.getDraft(COND_NOVO);
  if (draftB) {
    assert.notEqual(policyHash(draftB.policy), snap.policyHash);
  }
});

// ════════════════════════════════════ PUBLICAÇÃO SIMULTÂNEA ═════════════════

test("D926 publicação simultânea — dois condomínios publicam versões independentes", async () => {
  const repo = fakeRegulamentoRepo();
  const svc = createRegulamentoAdminService(repo);

  await svc.createDraft(CHACARA, draftInput());
  await svc.createDraft(COND_NOVO, draftInput({ policy: { quota: { maxQueueSize: 20 } } as PartialPolicy }));

  const rA = await svc.publishPolicy({ condominioId: CHACARA, observacao: "vA", author: adminCtx(CHACARA) });
  const rB = await svc.publishPolicy({ condominioId: COND_NOVO, observacao: "vB", author: adminCtx(COND_NOVO) });

  assert.equal(rA.version, 1);
  assert.equal(rB.version, 1);
  // Hashes diferentes
  assert.notEqual(rA.contentHash, rB.contentHash);
  // Versões não interferem
  const hA = await svc.getHistory(CHACARA);
  const hB = await svc.getHistory(COND_NOVO);
  assert.equal(hA.length, 1);
  assert.equal(hB.length, 1);
});
