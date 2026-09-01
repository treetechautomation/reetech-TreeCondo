/**
 * ACCESS.5B — testes de `listEligibleUnitsWithLabels` (contexto de
 * unidades elegíveis para a UX) contra o Firestore Emulator, mesmo
 * padrão de `authorizationService.test.ts`.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import admin from "firebase-admin";
import { resolveEligibleUnits, listEligibleUnitsWithLabels } from "../unitResolution";

if (!admin.apps.length) {
  admin.initializeApp({ projectId: "access5b-eligible-units-test" });
}
const db = admin.firestore();

const CONDO_A = "condo-a";
const CONDO_B = "condo-b";

async function wipe() {
  for (const condo of [CONDO_A, CONDO_B]) {
    for (const col of ["membros", "vinculosUnidades"]) {
      const snap = await db.collection("condominios").doc(condo).collection(col).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
    const blocosSnap = await db.collection("condominios").doc(condo).collection("blocos").get();
    for (const b of blocosSnap.docs) {
      const unidadesSnap = await b.ref.collection("unidades").get();
      await Promise.all(unidadesSnap.docs.map((u) => u.ref.delete()));
      await b.ref.delete();
    }
  }
}

before(async () => {
  await wipe();

  await db.doc(`condominios/${CONDO_A}/blocos/bloco-a`).set({ nome: "Bloco A" });
  await db.doc(`condominios/${CONDO_A}/blocos/bloco-a/unidades/unit-101`).set({ numero: "101" });
  await db.doc(`condominios/${CONDO_A}/blocos/bloco-a/unidades/unit-102`).set({ numero: "102" });

  // single-unit resident
  await db.doc(`condominios/${CONDO_A}/membros/morador-single`).set({ role: "MORADOR", status: "ATIVO", pessoaId: "pessoa-single" });
  await db.doc(`condominios/${CONDO_A}/vinculosUnidades/v1`).set({ pessoaId: "pessoa-single", status: "ATIVO", resideNaUnidade: true, unitDocId: "unit-101", blocoId: "bloco-a" });

  // multi-unit resident (2 active + 1 inactive vinculo that must be excluded)
  await db.doc(`condominios/${CONDO_A}/membros/morador-multi`).set({ role: "MORADOR", status: "ATIVO", pessoaId: "pessoa-multi" });
  await db.doc(`condominios/${CONDO_A}/vinculosUnidades/v2`).set({ pessoaId: "pessoa-multi", status: "ATIVO", resideNaUnidade: true, unitDocId: "unit-101", blocoId: "bloco-a" });
  await db.doc(`condominios/${CONDO_A}/vinculosUnidades/v3`).set({ pessoaId: "pessoa-multi", status: "ATIVO", resideNaUnidade: true, unitDocId: "unit-102", blocoId: "bloco-a" });
  await db.doc(`condominios/${CONDO_A}/vinculosUnidades/v4-inactive`).set({ pessoaId: "pessoa-multi", status: "INATIVO", resideNaUnidade: true, unitDocId: "unit-999-should-not-appear", blocoId: "bloco-a" });

  // duplicate vinculo pointing at the same unit (e.g. historical re-link) must dedupe
  await db.doc(`condominios/${CONDO_A}/vinculosUnidades/v5-dup`).set({ pessoaId: "pessoa-multi", status: "ATIVO", resideNaUnidade: true, unitDocId: "unit-101", blocoId: "bloco-a" });

  // zero-unit resident
  await db.doc(`condominios/${CONDO_A}/membros/morador-zero`).set({ role: "MORADOR", status: "ATIVO", pessoaId: "pessoa-zero" });

  // legacy fallback resident (membroData.unidadeId, no vinculosUnidades at all)
  await db.doc(`condominios/${CONDO_A}/membros/morador-legacy`).set({ role: "MORADOR", status: "ATIVO", pessoaId: "pessoa-legacy", unidadeId: "unit-legacy", blocoId: "bloco-a" });

  // cross-condo resident: same pessoaId string used in condo B, must never leak into condo A results
  await db.doc(`condominios/${CONDO_B}/membros/morador-b`).set({ role: "MORADOR", status: "ATIVO", pessoaId: "pessoa-single" });
  await db.doc(`condominios/${CONDO_B}/vinculosUnidades/vb1`).set({ pessoaId: "pessoa-single", status: "ATIVO", resideNaUnidade: true, unitDocId: "unit-b-only", blocoId: "bloco-b" });
});

after(async () => { await wipe(); });

test("zero units -> []", async () => {
  const md = { pessoaId: "pessoa-zero" };
  const eligible = await resolveEligibleUnits(db, CONDO_A, "morador-zero", md);
  assert.deepEqual(eligible, []);
  const withLabels = await listEligibleUnitsWithLabels(db, CONDO_A, "morador-zero", md);
  assert.deepEqual(withLabels, []);
});

test("one unit -> exactly own unit, with human-readable label", async () => {
  const md = { pessoaId: "pessoa-single" };
  const eligible = await resolveEligibleUnits(db, CONDO_A, "morador-single", md);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].unitId, "unit-101");

  const withLabels = await listEligibleUnitsWithLabels(db, CONDO_A, "morador-single", md);
  assert.equal(withLabels.length, 1);
  assert.equal(withLabels[0].label, "Apto 101 — Bloco A");
});

test("multiple units -> all own eligible units, inactive vínculo excluded, duplicates deduplicated", async () => {
  const md = { pessoaId: "pessoa-multi" };
  const eligible = await resolveEligibleUnits(db, CONDO_A, "morador-multi", md);
  const ids = eligible.map((u) => u.unitId).sort();
  assert.deepEqual(ids, ["unit-101", "unit-102"], "inactive vínculo (unit-999) must be excluded; duplicate v5-dup must not create a third entry");

  const withLabels = await listEligibleUnitsWithLabels(db, CONDO_A, "morador-multi", md);
  assert.equal(withLabels.length, 2);
  const labels = withLabels.map((u) => u.label).sort();
  assert.deepEqual(labels, ["Apto 101 — Bloco A", "Apto 102 — Bloco A"]);
});

test("legacy unidadeId fallback works when no vinculosUnidades exist", async () => {
  const md = { pessoaId: "pessoa-legacy", unidadeId: "unit-legacy", blocoId: "bloco-a" };
  const eligible = await resolveEligibleUnits(db, CONDO_A, "morador-legacy", md);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].unitId, "unit-legacy");
});

test("foreign condo unit excluded: same pessoaId in condo B never appears when querying condo A", async () => {
  const md = { pessoaId: "pessoa-single" };
  const eligible = await resolveEligibleUnits(db, CONDO_A, "morador-single", md);
  assert.ok(!eligible.some((u) => u.unitId === "unit-b-only"));
});

test("foreign resident unit excluded: one resident's eligible set never includes another resident's unit", async () => {
  const singleMd = { pessoaId: "pessoa-single" };
  const multiMd = { pessoaId: "pessoa-multi" };
  const singleUnits = (await resolveEligibleUnits(db, CONDO_A, "morador-single", singleMd)).map((u) => u.unitId);
  const multiUnits = (await resolveEligibleUnits(db, CONDO_A, "morador-multi", multiMd)).map((u) => u.unitId);
  // Overlap on unit-101 is expected/legitimate (two co-residents of the same unit) — but morador-single must never see unit-102 exclusively owned by morador-multi.
  assert.ok(!singleUnits.includes("unit-102"));
});

test("labels fall back to the unit ID only when no bloco/unidade metadata exists (never crashes)", async () => {
  await db.doc(`condominios/${CONDO_A}/membros/morador-nometadata`).set({ role: "MORADOR", status: "ATIVO", pessoaId: "pessoa-nometadata" });
  await db.doc(`condominios/${CONDO_A}/vinculosUnidades/vnm`).set({ pessoaId: "pessoa-nometadata", status: "ATIVO", resideNaUnidade: true, unitDocId: "unit-ghost", blocoId: "bloco-ghost" });
  const withLabels = await listEligibleUnitsWithLabels(db, CONDO_A, "morador-nometadata", { pessoaId: "pessoa-nometadata" });
  assert.equal(withLabels.length, 1);
  assert.ok(withLabels[0].label.length > 0);
  await db.doc(`condominios/${CONDO_A}/membros/morador-nometadata`).delete();
  await db.doc(`condominios/${CONDO_A}/vinculosUnidades/vnm`).delete();
});

test("route source restricts the context endpoint to MORADOR only (porteiro/seguranca denied)", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "src/app/api/acesso-controle/contexto/route.ts"), "utf8");
  assert.match(src, /allowedRoles:\s*\["MORADOR"\]/);
});
