/**
 * F.2.6 — TESTES DE EQUIVALÊNCIA buildMenuPermissions
 *
 * Garante que a versão canônica não amplie permissões
 * em relação à versão mais completa (finalizar-primeiro-acesso).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildMenuPermissions } from "../menuPermissions";
import type { MenuPermissions } from "../menuPermissions";

function permsSupersetOf(canonical: Record<string, boolean>, reference: Record<string, boolean>): string | null {
  for (const [key, value] of Object.entries(canonical)) {
    if (value === true) {
      if (!reference[key]) {
        return `Canônico concede '${key}' mas referência não concede`;
      }
    }
  }
  return null;
}

// ═══════ Referência: finalizar-primeiro-acesso (a mais completa) ═══════

const REFERENCE: Record<string, Record<string, boolean>> = {
  MORADOR: {
    dashboard: true,
    acesso: true,
    anuncios: true,
    documentos: true,
    enquetes: true,
    reservas: true,
    encomendas: true,
    reunioes: true,
    cadastros: false,
    configuracoes: false,
    condominios: false,
    administradorGlobal: false,
    incidentes: false,
  },
  PORTEIRO: {
    dashboard: true,
    acesso: true,
    encomendas: true,
    incidentes: true,
    anuncios: true,
    documentos: true,
    cadastros: false,
    configuracoes: false,
    condominios: false,
    reservas: false,
    enquetes: false,
    reunioes: false,
    administradorGlobal: false,
  },
  "SINDICO/ADMIN/ADMIN_CONDOMINIO": {
    dashboard: true,
    condominios: true,
    cadastros: true,
    configuracoes: true,
    anuncios: true,
    documentos: true,
    enquetes: true,
    reservas: true,
    encomendas: true,
    incidentes: true,
    reunioes: true,
    acesso: true,
    administradorGlobal: false,
  },
};

test("F2601 MORADOR canônico não amplia permissões", () => {
  const r = buildMenuPermissions("MORADOR");
  const ref = REFERENCE.MORADOR;
  assert.equal(permsSupersetOf(r, ref), null);
});

test("F2602 PORTEIRO canônico não amplia permissões", () => {
  const r = buildMenuPermissions("PORTEIRO");
  const ref = REFERENCE.PORTEIRO;
  assert.equal(permsSupersetOf(r, ref), null);
});

test("F2603 SINDICO canônico não amplia permissões", () => {
  const r = buildMenuPermissions("SINDICO");
  const ref = REFERENCE["SINDICO/ADMIN/ADMIN_CONDOMINIO"];
  assert.equal(permsSupersetOf(r, ref), null);
});

test("F2604 ADMIN canônico não amplia permissões", () => {
  const r = buildMenuPermissions("ADMIN");
  const ref = REFERENCE["SINDICO/ADMIN/ADMIN_CONDOMINIO"];
  assert.equal(permsSupersetOf(r, ref), null);
});

test("F2605 ADMIN_CONDOMINIO canônico não amplia permissões", () => {
  const r = buildMenuPermissions("ADMIN_CONDOMINIO");
  const ref = REFERENCE["SINDICO/ADMIN/ADMIN_CONDOMINIO"];
  assert.equal(permsSupersetOf(r, ref), null);
});

test("F2606 ZELADOR canônico concede acesso + encomendas + incidentes", () => {
  const r = buildMenuPermissions("ZELADOR");
  assert.equal(r.dashboard, true);
  assert.equal(r.acesso, true);
  assert.equal(r.encomendas, true);
  assert.equal(r.incidentes, true);
  assert.equal(r.cadastros, false);
  assert.equal(r.condominios, false);
  assert.equal(r.administradorGlobal, false);
});

test("F2607 FUNCIONARIO mapeia para ZELADOR", () => {
  const rZ = buildMenuPermissions("ZELADOR");
  const rF = buildMenuPermissions("FUNCIONARIO");
  for (const key of Object.keys(rZ)) {
    assert.equal((rF as any)[key], (rZ as any)[key], `Divergência em ${key}`);
  }
});

test("F2608 SUPER_ADMIN não ganha administradorGlobal", () => {
  const r = buildMenuPermissions("SUPER_ADMIN");
  assert.equal(r.administradorGlobal, false);
  assert.equal(r.condominios, true);
});

test("F2609 Role desconhecida recebe somente dashboard", () => {
  const r = buildMenuPermissions("INEXISTENTE");
  assert.equal(r.dashboard, true);
  assert.equal(r.acesso, undefined);
  assert.equal(r.cadastros, undefined);
});

test("F2610 Nenhuma role perde dashboard", () => {
  for (const role of ["MORADOR", "PORTEIRO", "ZELADOR", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "FUNCIONARIO"]) {
    const r = buildMenuPermissions(role);
    assert.equal(r.dashboard, true, `${role} perdeu dashboard`);
  }
});
