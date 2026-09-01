/**
 * ACCESS.5B §24 — verificações estruturais (source-level) de que a UX
 * cobre os três casos (0/1/N unidades) e nunca confia em seleção obsoleta.
 * Sem framework de component testing instalado (§47/ACCESS.5's own
 * precedent) — estas são checagens de contrato sobre o código real, não
 * simulação de DOM.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readPage(): string {
  return fs.readFileSync(path.join(process.cwd(), "src/app/acessos/page.tsx"), "utf8");
}

test("page.tsx: renders a blocked state when zero eligible units", () => {
  const src = readPage();
  assert.match(src, /Não encontramos uma unidade vinculada ao seu acesso\./);
});

test("page.tsx: renders a read-only unit label when exactly one eligible unit (no forced selection)", () => {
  const src = readPage();
  assert.match(src, /context\.units\.length === 1/);
});

test("page.tsx: renders a required Select when selectionRequired (more than one eligible unit)", () => {
  const src = readPage();
  assert.match(src, /context\.selectionRequired/);
  assert.match(src, /id="acesso-unidade"/);
});

test("page.tsx: submit is blocked while context is loading, erroring, or blocked (zero units)", () => {
  const src = readPage();
  assert.match(src, /disabled=\{submitting \|\| !canSubmit\}/);
});

test("page.tsx: reloads context (does not trust stale selection) on NO_ACTIVE_UNIT/INVALID_UNIT create errors", () => {
  const src = readPage();
  assert.match(src, /err\?\.code === "INVALID_UNIT" \|\| err\?\.code === "NO_ACTIVE_UNIT"/);
  assert.match(src, /loadContext\(\)/);
});

test("page.tsx: resets a previously selected unit that's no longer present in a refreshed context", () => {
  const src = readPage();
  assert.match(src, /ctx\.units\.some\(\(u\) => u\.unitId === prev\)/);
});

test("page.tsx: single-unit create omits unitId (preserves server auto-derivation)", () => {
  const src = readPage();
  assert.match(src, /unitId: context && context\.selectionRequired \? selectedUnitId : null/);
});

test("uiClient.ts: getAccessContext hits the read-only contexto endpoint, not a mutating one", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "src/lib/access/uiClient.ts"), "utf8");
  assert.match(src, /\/api\/acesso-controle\/contexto/);
});

// ═══════════ ACCESS.5D — mobile polish (badge clipping / native validation) ═══════════

test("page.tsx: create form disables native browser validation, keeping the app's own Portuguese messages authoritative", () => {
  const src = readPage();
  assert.match(src, /<form onSubmit=\{handleSubmit\} noValidate/);
});

test("page.tsx: the existing Portuguese validation path (nome/data/unidade) is still present and untouched", () => {
  const src = readPage();
  assert.match(src, /title: "Nome obrigatório", description: "Informe o nome do visitante\."/);
  assert.match(src, /title: "Data obrigatória", description: "Informe a data da visita\."/);
  assert.match(src, /title: "Selecione a unidade", description: "Escolha a unidade para esta autorização\."/);
});

test("page.tsx: list card grid item allows shrinking so the status badge can't force horizontal overflow (source-level contract only — visual correctness verified separately in staging)", () => {
  const src = readPage();
  assert.match(src, /<Card key=\{item\.id\} className="min-w-0 cursor-pointer/);
});
