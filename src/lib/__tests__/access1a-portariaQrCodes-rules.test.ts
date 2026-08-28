/**
 * ACCESS.1A — Firestore Rules tests for the `portariaQrCodes` legacy
 * visitor-pass prototype hotfix.
 *
 * Proves the P0/P1 findings from ACCESS.1 are closed:
 *   P0 — replay: a consumed/cancelled pass can never go back to ATIVO.
 *   P1 — privacy: a resident can only read their own passes.
 *   P1 — authorization inversion: PORTEIRO/SEGURANCA cannot create a pass.
 * Also confirms legitimate flows still work (create, own-read, cancel,
 * portaria consumption) and standard tenant/anonymous isolation holds.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const CONDO_A = "condo-a";
const CONDO_B = "condo-b";

let testEnv: RulesTestEnvironment;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "access1a-rules-test",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const membro = (condoId: string, uid: string, role: string) =>
      db.doc(`condominios/${condoId}/membros/${uid}`).set({ role, status: "ATIVO" });

    await membro(CONDO_A, "morador-a1", "MORADOR");
    await membro(CONDO_A, "morador-a2", "MORADOR");
    await membro(CONDO_A, "porteiro-a", "PORTEIRO");
    await membro(CONDO_A, "sindico-a", "SINDICO");
    await membro(CONDO_B, "morador-b1", "MORADOR");
    await membro(CONDO_B, "porteiro-b", "PORTEIRO");

    // Fixture passes, written with rules disabled (bypassing app logic —
    // this is test setup, not something the rules need to allow).
    await db.doc(`condominios/${CONDO_A}/portariaQrCodes/pass-ativo-a1`).set({
      criadoPor: "morador-a1",
      status: "ATIVO",
      nomeVisitante: "Fixture Visitor",
    });
    await db.doc(`condominios/${CONDO_A}/portariaQrCodes/pass-utilizado-a1`).set({
      criadoPor: "morador-a1",
      status: "UTILIZADO",
      nomeVisitante: "Fixture Visitor 2",
    });
    await db.doc(`condominios/${CONDO_A}/portariaQrCodes/pass-cancelado-a1`).set({
      criadoPor: "morador-a1",
      status: "CANCELADO",
      nomeVisitante: "Fixture Visitor 3",
    });
  });
});

after(async () => {
  await testEnv.cleanup();
});

function as(uid: string | null) {
  return uid ? testEnv.authenticatedContext(uid).firestore() : testEnv.unauthenticatedContext().firestore();
}

// ---- ALLOW cases ----

test("ALLOW: morador cria passe próprio (status ATIVO)", async () => {
  const db = as("morador-a1");
  await assertSucceeds(
    db.doc(`condominios/${CONDO_A}/portariaQrCodes/novo-1`).set({
      criadoPor: "morador-a1",
      status: "ATIVO",
      nomeVisitante: "Novo Visitante",
    })
  );
});

test("ALLOW: morador lê o próprio passe", async () => {
  const db = as("morador-a1");
  await assertSucceeds(db.doc(`condominios/${CONDO_A}/portariaQrCodes/pass-ativo-a1`).get());
});

test("ALLOW: portaria consome passe ATIVO -> UTILIZADO", async () => {
  const db = as("porteiro-a");
  await assertSucceeds(
    db.doc(`condominios/${CONDO_A}/portariaQrCodes/pass-ativo-a1`).update({
      status: "UTILIZADO",
      utilizadoEm: new Date(),
      validadoPorNome: "Porteiro Teste",
    })
  );
});

test("ALLOW: criador cancela o próprio passe ATIVO -> CANCELADO", async () => {
  const db = as("morador-a1");
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`condominios/${CONDO_A}/portariaQrCodes/para-cancelar`).set({
      criadoPor: "morador-a1",
      status: "ATIVO",
    });
  });
  await assertSucceeds(
    db.doc(`condominios/${CONDO_A}/portariaQrCodes/para-cancelar`).update({ status: "CANCELADO" })
  );
});

test("ALLOW: sindico (operador) lê qualquer passe do próprio condomínio", async () => {
  const db = as("sindico-a");
  await assertSucceeds(db.doc(`condominios/${CONDO_A}/portariaQrCodes/pass-ativo-a1`).get());
});

// ---- DENY cases (P0/P1 closure) ----

test("DENY (P1 privacy): outro morador do mesmo condomínio não lê passe alheio", async () => {
  const db = as("morador-a2");
  await assertFails(db.doc(`condominios/${CONDO_A}/portariaQrCodes/pass-ativo-a1`).get());
});

test("DENY: morador de outro condomínio (cross-tenant) não lê", async () => {
  const db = as("morador-b1");
  await assertFails(db.doc(`condominios/${CONDO_A}/portariaQrCodes/pass-ativo-a1`).get());
});

test("DENY (P1 authorization inversion): porteiro não pode criar passe", async () => {
  const db = as("porteiro-a");
  await assertFails(
    db.doc(`condominios/${CONDO_A}/portariaQrCodes/porteiro-tentativa`).set({
      criadoPor: "porteiro-a",
      status: "ATIVO",
      nomeVisitante: "Auto-emitido",
    })
  );
});

test("DENY (P0 replay): criador não pode reativar o próprio passe UTILIZADO", async () => {
  const db = as("morador-a1");
  await assertFails(
    db.doc(`condominios/${CONDO_A}/portariaQrCodes/pass-utilizado-a1`).update({ status: "ATIVO" })
  );
});

test("DENY (P0 replay): criador não pode reativar o próprio passe CANCELADO", async () => {
  const db = as("morador-a1");
  await assertFails(
    db.doc(`condominios/${CONDO_A}/portariaQrCodes/pass-cancelado-a1`).update({ status: "ATIVO" })
  );
});

test("DENY (P0 replay): portaria não pode reativar passe UTILIZADO para ATIVO", async () => {
  const db = as("porteiro-a");
  await assertFails(
    db.doc(`condominios/${CONDO_A}/portariaQrCodes/pass-utilizado-a1`).update({ status: "ATIVO" })
  );
});

test("DENY: porteiro de outro condomínio não opera passe do condo A (cross-tenant)", async () => {
  const db = as("porteiro-b");
  await assertFails(
    db.doc(`condominios/${CONDO_A}/portariaQrCodes/pass-ativo-a1`).update({ status: "UTILIZADO" })
  );
});

test("DENY: criador não pode alterar campos fora do allowlist ao cancelar", async () => {
  const db = as("morador-a1");
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`condominios/${CONDO_A}/portariaQrCodes/tenta-adulterar`).set({
      criadoPor: "morador-a1",
      status: "ATIVO",
    });
  });
  await assertFails(
    db.doc(`condominios/${CONDO_A}/portariaQrCodes/tenta-adulterar`).update({
      status: "CANCELADO",
      nomeVisitante: "Nome Adulterado",
    })
  );
});

test("DENY: anonymous não lê", async () => {
  const db = as(null);
  await assertFails(db.doc(`condominios/${CONDO_A}/portariaQrCodes/pass-ativo-a1`).get());
});

test("DENY: anonymous não escreve", async () => {
  const db = as(null);
  await assertFails(
    db.doc(`condominios/${CONDO_A}/portariaQrCodes/anon-tentativa`).set({
      criadoPor: "ninguem",
      status: "ATIVO",
    })
  );
});
