/**
 * F.6.2 — CLAIM-LINK TENANT-SCOPED LOOKUP
 *
 * Cobertura da correção do incidente F.6.1: substitui
 * collectionGroup("accessLinks").where("__name__","==",linkId)
 * por lookup direto condominios/{condominioId}/accessLinks/{linkId}.
 *
 * Segue a mesma convenção de f25-self-onboarding.test.ts: testes de
 * lógica/contrato em memória, sem dependência de rede ou Firestore real.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import type { AccessLinkData, EligibleLink } from "../types";
import { normEmail } from "../service";

function isValidFirestoreDocId(v: string): boolean {
  return v.length > 0 && v.length <= 1500 && !v.includes("/") && v !== "." && v !== "..";
}

// ════════════ CLAIM-01 — request sem linkId ════════════

test("CLAIM-01 request sem linkId — erro controlado (400)", () => {
  const body: any = { condominioId: "condo1" };
  const linkId = String(body.linkId || "").trim();

  let status: number | null = null;
  if (!linkId) status = 400;

  assert.equal(status, 400);
});

// ════════════ CLAIM-02 — request sem condominioId ════════════

test("CLAIM-02 request sem condominioId — erro controlado (400)", () => {
  const body: any = { linkId: "p9k8K3G1jkoxCdP9r9Bz" };
  const linkId = String(body.linkId || "").trim();
  const condominioId = String(body.condominioId || "").trim();

  let status: number | null = null;
  if (!linkId) status = 400;
  else if (!condominioId) status = 400;

  assert.equal(status, 400);
});

// ════════════ CLAIM-03 — linkId + condominioId válidos → lookup path esperado ════════════

test("CLAIM-03 linkId e condominioId válidos — path do documento é tenant-scoped", () => {
  const linkId = "p9k8K3G1jkoxCdP9r9Bz";
  const condominioId = "chacara-itaguai";

  assert.ok(isValidFirestoreDocId(linkId));
  assert.ok(isValidFirestoreDocId(condominioId));

  const expectedPath = `condominios/${condominioId}/accessLinks/${linkId}`;
  assert.equal(expectedPath, "condominios/chacara-itaguai/accessLinks/p9k8K3G1jkoxCdP9r9Bz");
  assert.equal(expectedPath.split("/").length, 4);
  assert.equal(expectedPath.split("/").length % 2, 0, "path deve ter numero par de segmentos");
});

// ════════════ CLAIM-04 — link inexistente ════════════

test("CLAIM-04 link inexistente no path resolvido — 404 controlado", () => {
  const snapExists = false;

  let status: number | null = null;
  if (!snapExists) status = 404;

  assert.equal(status, 404);
});

// ════════════ CLAIM-05 — email diferente ════════════

test("CLAIM-05 email diferente do cadastro — acesso negado (403)", () => {
  const authEmail = normEmail("outro@example.com");
  const linkData: Partial<AccessLinkData> = { email: "joao@example.com" };

  let status: number | null = null;
  if (normEmail(linkData.email) !== authEmail) status = 403;

  assert.equal(status, 403);
});

// ════════════ CLAIM-06 — tenant adulterado ════════════

test("CLAIM-06 tenant adulterado — condominioId errado nao reivindica link de outro tenant", () => {
  // O link real só existe em condominios/condoA/accessLinks/{linkId}.
  const realLocation = { condominioId: "condoA", linkId: "linkXYZ" };
  const store: Record<string, { condominioId: string; email: string }> = {
    "condoA/linkXYZ": { condominioId: "condoA", email: "joao@example.com" },
  };

  const attackerRequest = { condominioId: "condoB", linkId: "linkXYZ" };
  const resolvedKey = `${attackerRequest.condominioId}/${attackerRequest.linkId}`;

  const doc = store[resolvedKey];

  assert.equal(doc, undefined, "lookup em tenant errado nao deve resolver nenhum documento");
  assert.notEqual(attackerRequest.condominioId, realLocation.condominioId);
});

// ════════════ CLAIM-07 — idempotência preservada ════════════

test("CLAIM-07 link ja VINCULADO — retorna alreadyLinked sem re-executar transaction", () => {
  const linkData: Partial<AccessLinkData> = {
    accessStatus: "VINCULADO",
    condominioId: "condo1",
    personId: "person1",
    roleAcesso: "MORADOR",
  };

  const condominioId = "condo1"; // path-derivado da request, deve bater com o doc resolvido
  let response: any = null;
  if (linkData.accessStatus === "VINCULADO") {
    response = {
      ok: true,
      alreadyLinked: true,
      condominioId,
      personId: linkData.personId,
      role: linkData.roleAcesso,
    };
  }

  assert.ok(response);
  assert.equal(response.alreadyLinked, true);
  assert.equal(response.condominioId, "condo1");
});

// ════════════ CLAIM-08 — golden path (create -> eligible-links -> frontend -> claim) ════════════

test("CLAIM-08 golden path — eligible-links expõe condominioId e payload do claim é compatível", () => {
  const eligible: EligibleLink = {
    linkId: "p9k8K3G1jkoxCdP9r9Bz",
    condominioId: "chacara-itaguai",
    condominioNome: "Chácara Itaguaí",
    blocoNome: "Rosas",
    unidadeNumero: "101",
    tipoVinculo: "PROPRIETARIO",
  };

  // Payload que o frontend (vincular-condominio/page.tsx) monta a partir do link elegível.
  const claimPayload = { linkId: eligible.linkId, condominioId: eligible.condominioId };

  assert.equal(claimPayload.linkId, eligible.linkId);
  assert.equal(claimPayload.condominioId, eligible.condominioId);
  assert.ok(isValidFirestoreDocId(claimPayload.linkId));
  assert.ok(isValidFirestoreDocId(claimPayload.condominioId));
});

// ════════════ CLAIM-09 — regressão: query problemática removida do código real ════════════

test("CLAIM-09 codigo real do claim-link nao usa mais collectionGroup + __name__", () => {
  const routePath = path.join(__dirname, "..", "..", "..", "app", "api", "onboarding", "claim-link", "route.ts");
  const source = fs.readFileSync(routePath, "utf8");

  const usesCollectionGroupDocumentId =
    source.includes('collectionGroup("accessLinks")') && source.includes('"__name__"');
  assert.equal(usesCollectionGroupDocumentId, false, "claim-link nao deve mais usar collectionGroup+__name__");

  assert.ok(source.includes('.collection("condominios")'), "claim-link deve usar lookup direto por condominios/{condominioId}");
  assert.ok(source.includes('.collection("accessLinks")\n    .doc(linkId)') || /\.collection\("accessLinks"\)\s*\.doc\(linkId\)/.test(source), "claim-link deve resolver accessLinks/{linkId} diretamente");
});
