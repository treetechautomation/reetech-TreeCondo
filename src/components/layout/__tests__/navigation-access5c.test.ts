/**
 * ACCESS.5C — verificação estrutural (source-level) de que o item de
 * navegação compartilhado "acesso" aponta para o novo domínio
 * (`/acessos`) apenas para MORADOR, preservando o destino legado
 * (`/acesso`) para todos os outros papéis (porteiro/admin/síndico) que
 * também têm essa permissão. Sem framework de component testing
 * instalado (mesmo precedente de multiUnitUx.test.ts) — checagens de
 * contrato sobre o código real, não simulação de DOM/render.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
}

test("AppLayout.tsx: base NAV_ITEMS entry for 'acesso' still targets the legacy route", () => {
  const src = read("src/components/layout/AppLayout.tsx");
  assert.match(src, /\{\s*href:\s*"\/acesso",\s*label:\s*"Acesso",\s*key:\s*"acesso"\s*\}/);
});

test("AppLayout.tsx: filteredNav remaps 'acesso' to /acessos only when role is MORADOR", () => {
  const src = read("src/components/layout/AppLayout.tsx");
  assert.match(
    src,
    /i\.key === "acesso" && session\?\.role === "MORADOR" \? \{ \.\.\.i, href: "\/acessos" \} : i/,
  );
});

test("menu/page.tsx: base 'acesso' category item still targets the legacy route", () => {
  const src = read("src/app/menu/page.tsx");
  assert.match(src, /key:\s*"acesso",\s*href:\s*"\/acesso"/);
});

test("menu/page.tsx: filtered items remap 'acesso' to /acessos only when role is MORADOR", () => {
  const src = read("src/app/menu/page.tsx");
  assert.match(
    src,
    /i\.key === "acesso" && role === "MORADOR" \? \{ \.\.\.i, href: "\/acessos" \} : i/,
  );
});

test("BottomNav.tsx: MORADOR_ITEMS, PORTEIRO_ITEMS and ADMIN_ITEMS are unchanged by ACCESS.5C (no new tab added)", () => {
  const src = read("src/components/shell/BottomNav.tsx");
  // Porteiro keeps its own dedicated /acesso tab, untouched.
  assert.match(src, /\{ href: "\/acesso", label: "Acessos", icon: KeyRound, color: "#22D3EE" \}/);
  // Admin keeps /acesso with the pre-existing /acessos alias, untouched.
  assert.match(
    src,
    /\{ href: "\/acesso", label: "Acessos", icon: KeyRound, aliases: \["\/acessos"\], color: "#22D3EE" \}/,
  );
});
