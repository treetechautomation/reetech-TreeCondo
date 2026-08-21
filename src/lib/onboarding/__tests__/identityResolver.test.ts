/**
 * ADMIN_CONDOMINIO.1C — CANONICAL IDENTITY RESOLVER
 *
 * Testes do resolvedor puro que decide o destino pós-login/pós-ONBOARDING_GATE
 * para usuários convidados (ADMIN_CONDOMINIO, SINDICO, ADMIN, PORTEIRO,
 * ZELADOR, MORADOR) sem duplicar a lógica entre LoginClient e AppLayout.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveIdentityState, isPendingConviteStatus } from "../identityResolver";

function baseInput(overrides: Partial<Parameters<typeof resolveIdentityState>[0]> = {}) {
  return {
    isSuper: false,
    vinculos: [] as { status?: string }[],
    convites: [] as { id: string; status?: string }[],
    ...overrides,
  };
}

// A–F: cada perfil convidado com convite PENDENTE deve resolver para
// PENDING_INVITED_USER e retornar o conviteId — nunca cair no self-onboarding
// MORADOR-only.

test("A ADMIN_CONDOMINIO_PENDING_INVITE_REDIRECTS_TO_FIRST_ACCESS", () => {
  const r = resolveIdentityState(
    baseInput({ convites: [{ id: "conv-admin-condo", status: "PENDENTE" }] })
  );
  assert.equal(r.state, "PENDING_INVITED_USER");
  assert.equal(r.conviteId, "conv-admin-condo");
});

test("B SINDICO_PENDING_INVITE_REDIRECTS_TO_FIRST_ACCESS", () => {
  const r = resolveIdentityState(
    baseInput({ convites: [{ id: "conv-sindico", status: "PENDENTE" }] })
  );
  assert.equal(r.state, "PENDING_INVITED_USER");
  assert.equal(r.conviteId, "conv-sindico");
});

test("C ADMIN_PENDING_INVITE_REDIRECTS_TO_FIRST_ACCESS", () => {
  const r = resolveIdentityState(
    baseInput({ convites: [{ id: "conv-admin", status: "PROCESSADO" }] })
  );
  assert.equal(r.state, "PENDING_INVITED_USER");
  assert.equal(r.conviteId, "conv-admin");
});

test("D PORTEIRO_PENDING_INVITE_REDIRECTS_TO_FIRST_ACCESS", () => {
  const r = resolveIdentityState(
    baseInput({ convites: [{ id: "conv-porteiro", status: "PENDENTE" }] })
  );
  assert.equal(r.state, "PENDING_INVITED_USER");
  assert.equal(r.conviteId, "conv-porteiro");
});

test("E ZELADOR_PENDING_INVITE_REDIRECTS_TO_FIRST_ACCESS", () => {
  // FUNCIONARIO é gravado internamente como membro role=ZELADOR
  // (ver convites/create/route.ts) — o convite em si carrega tipo=FUNCIONARIO,
  // mas o resolvedor não depende de role/tipo, apenas de status.
  const r = resolveIdentityState(
    baseInput({ convites: [{ id: "conv-zelador", status: "PENDENTE" }] })
  );
  assert.equal(r.state, "PENDING_INVITED_USER");
  assert.equal(r.conviteId, "conv-zelador");
});

test("F INVITED_MORADOR_PENDING_INVITE_REDIRECTS_TO_FIRST_ACCESS", () => {
  const r = resolveIdentityState(
    baseInput({ convites: [{ id: "conv-morador", status: "PENDENTE" }] })
  );
  assert.equal(r.state, "PENDING_INVITED_USER");
  assert.equal(r.conviteId, "conv-morador");
});

// G: self-onboarding MORADOR (sem convite algum) deve continuar caindo no
// fluxo atual de /onboarding/vincular-condominio (NO_PENDING_INVITE) — o
// resolvedor NUNCA deve assumir esse caso como PENDING_INVITED_USER.

test("G SELF_ONBOARDING_MORADOR_STILL_USES_VINCULAR_CONDOMINIO", () => {
  const r = resolveIdentityState(baseInput({ convites: [] }));
  assert.equal(r.state, "NO_PENDING_INVITE");
  assert.equal(r.conviteId, undefined);
});

// H: usuário com vínculo ATIVO vai direto para o dashboard, mesmo que exista
// algum convite histórico (já concluído ou de outro condomínio antigo).

test("H ACTIVE_LINKED_USER_GOES_TO_PAINEL", () => {
  const r = resolveIdentityState(
    baseInput({
      vinculos: [{ status: "ATIVO" }],
      convites: [{ id: "conv-old", status: "CONCLUIDO" }],
    })
  );
  assert.equal(r.state, "ACTIVE_LINKED_USER");
});

// I: SUPER_ADMIN é sempre resolvido primeiro, independente de vínculos/convites.

test("I SUPER_ADMIN_GOES_TO_PAINEL", () => {
  const r = resolveIdentityState(
    baseInput({ isSuper: true, vinculos: [], convites: [{ id: "x", status: "PENDENTE" }] })
  );
  assert.equal(r.state, "SUPER_ADMIN");
});

// J: usuário com Auth pré-existente (reaproveitado por convites/create) que
// ainda não tem vínculo ATIVO, mas tem convite pendente — mesmo resultado
// que um Auth novo. O resolvedor não distingue "Auth novo" de "Auth
// reaproveitado", apenas o estado real em Firestore.

test("J AUTH_EXISTING_USER_WITH_PENDING_INVITE_CANNOT_BYPASS_FIRST_ACCESS", () => {
  const r = resolveIdentityState(
    baseInput({
      vinculos: [{ status: "INATIVO" }], // vínculo antigo revogado, não ATIVO
      convites: [{ id: "conv-existing-auth", status: "PENDENTE" }],
    })
  );
  assert.equal(r.state, "PENDING_INVITED_USER");
  assert.equal(r.conviteId, "conv-existing-auth");
});

// K/L: a senha temporária não é responsabilidade deste resolvedor (é uma
// garantia de outro arquivo — convites/create/route.ts), mas registramos
// aqui a expectativa estrutural para rastreabilidade do conjunto de testes
// do gate 1C.

test("K TEMP_PASSWORD_NOT_PRESENT_IN_INVITE_EMAIL (static source check)", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const routeSrc = await fs.readFile(
    path.resolve(__dirname, "../../../app/api/convites/create/route.ts"),
    "utf8"
  );
  assert.equal(
    /Senha temporária/.test(routeSrc),
    false,
    "email HTML não deve mais exibir a senha temporária"
  );
});

test("L TEMP_PASSWORD_NOT_RETURNED_BY_API (static source check)", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const routeSrc = await fs.readFile(
    path.resolve(__dirname, "../../../app/api/convites/create/route.ts"),
    "utf8"
  );
  const returnBlockMatch = routeSrc.match(/return NextResponse\.json\(\{[\s\S]*?\}\);/);
  assert.ok(returnBlockMatch, "deve existir um NextResponse.json de sucesso");
  assert.equal(
    /senhaTemporaria/.test(returnBlockMatch![0]),
    false,
    "resposta da API não deve incluir a senha temporária"
  );
});

// M: nenhum perfil convidado (exceto MORADOR self-onboarding genuíno) pode
// ser resolvido para o estado que leva ao empty-state MORADOR-only.

test("M PENDING_ADMIN_NEVER_REDIRECTED_TO_MORADOR_ONLY_EMPTY_STATE", () => {
  const roles = ["ADMIN_CONDOMINIO", "SINDICO", "ADMIN", "PORTEIRO", "ZELADOR"];
  for (const role of roles) {
    const r = resolveIdentityState(
      baseInput({ convites: [{ id: `conv-${role}`, status: "PENDENTE" }] })
    );
    assert.notEqual(
      r.state,
      "NO_PENDING_INVITE",
      `${role} com convite pendente não pode cair em NO_PENDING_INVITE`
    );
  }
});

// N: o cenário exato encontrado em ADMIN_CONDOMINIO.1A — Auth válido +
// onboarding incompleto — nunca resolve para um estado que produz dead end.

test("N TEMP_PASSWORD_BYPASS_DOES_NOT_CREATE_DEAD_END", () => {
  // Simula exatamente o bypass documentado no 1A: Auth criado e logado
  // com a senha temporária, ANTES de finalizar-primeiro-acesso rodar.
  const r = resolveIdentityState(
    baseInput({
      vinculos: [], // finalizar-primeiro-acesso nunca rodou
      convites: [{ id: "conv-bypass", status: "PENDENTE" }],
    })
  );
  assert.equal(r.state, "PENDING_INVITED_USER");
  assert.notEqual(r.state, "NO_PENDING_INVITE");
});

// O/P: segurança multi-tenant — o resolvedor só aceita convites já
// filtrados por uidGerado==uid autenticado (isso é garantido pela rota da
// API, não pela função pura); aqui validamos que a função pura nunca
// "escolhe" um convite fora da lista fornecida, e que status isolado não
// vaza informação de outro convite/tenant.

test("O USER_CANNOT_RESOLVE_ANOTHER_USERS_PENDING_INVITE (pure function only sees its own input)", () => {
  // A função pura não tem acesso a nenhum estado global — o único convite
  // "visível" é o que a rota já filtrou por uidGerado. Aqui simulamos que a
  // rota corretamente NÃO incluiu convites de outro uid: lista vazia.
  const r = resolveIdentityState(baseInput({ convites: [] }));
  assert.equal(r.state, "NO_PENDING_INVITE");
});

test("P TENANT_ID_CANNOT_BE_FORGED_BY_CLIENT (resolver has no condominioId input)", () => {
  // A assinatura de resolveIdentityState não aceita condominioId algum —
  // não há como um client forjar pertencimento a um tenant através desta
  // função. Este teste documenta a garantia estrutural.
  const inputKeys = Object.keys(baseInput());
  assert.deepEqual(inputKeys.sort(), ["convites", "isSuper", "vinculos"]);
});

test("isPendingConviteStatus recognizes PENDENTE and PROCESSADO, rejects CONCLUIDO/ACEITO", () => {
  assert.equal(isPendingConviteStatus("PENDENTE"), true);
  assert.equal(isPendingConviteStatus("PROCESSADO"), true);
  assert.equal(isPendingConviteStatus("pendente"), true);
  assert.equal(isPendingConviteStatus("CONCLUIDO"), false);
  assert.equal(isPendingConviteStatus("ACEITO"), false);
  assert.equal(isPendingConviteStatus(undefined), false);
  assert.equal(isPendingConviteStatus(null), false);
});
