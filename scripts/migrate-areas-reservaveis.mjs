#!/usr/bin/env node
/**
 * FASE C.1 — Migração das áreas reserváveis (Chácara Itaguaí)
 *
 * Uso:
 *   node scripts/migrate-areas-reservaveis.mjs                  # DRY RUN (padrão, nenhuma escrita)
 *   node scripts/migrate-areas-reservaveis.mjs --apply          # aplica a migração (exceto desativação do salão legado)
 *   node scripts/migrate-areas-reservaveis.mjs --apply --desativar-salao-legado
 *                                                               # aplica também ativo:false em salao_festas
 *
 * Garantias:
 *   - opera exclusivamente em condominios/RtJ7G92QwWvJ13Qq8Ntx/areasReservaveis
 *   - aborta se project_id da credencial != studio-7559545170-41328
 *   - idempotente (re-execução não gera novas alterações)
 *   - nunca apaga documentos fisicamente
 *   - escrita via batch único
 *   - em --apply, cria backup em .bak/areas-migration-<ts>/ antes de escrever
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const EXPECTED_PROJECT_ID = "studio-7559545170-41328";
const CONDOMINIO_ID = "RtJ7G92QwWvJ13Qq8Ntx";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DESATIVAR_SALAO_LEGADO = args.includes("--desativar-salao-legado");

function fail(msg) {
  console.error(`ERRO: ${msg}`);
  process.exit(1);
}

let sa;
try {
  sa = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"));
} catch (e) {
  fail(`não foi possível ler ./serviceAccountKey.json (${e.message})`);
}
if (sa.project_id !== EXPECTED_PROJECT_ID) {
  fail(`project_id da credencial ("${sa.project_id}") difere do esperado ("${EXPECTED_PROJECT_ID}"). Abortando.`);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();
const colRef = db.collection("condominios").doc(CONDOMINIO_ID).collection("areasReservaveis");

function serialize(v) {
  if (v === null || v === undefined || typeof v !== "object") return v;
  if (typeof v.toDate === "function") return { __type: "timestamp", iso: v.toDate().toISOString() };
  if (Array.isArray(v)) return v.map(serialize);
  const r = {};
  for (const [k, val] of Object.entries(v)) r[k] = serialize(val);
  return r;
}

function stable(v) {
  if (v === null || v === undefined || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
}
function eq(a, b) {
  return stable(serialize(a)) === stable(serialize(b));
}

function printDiff(docId, changes) {
  console.log(`  Documento: ${docId}`);
  for (const c of changes) {
    console.log(`    campo: ${c.field}`);
    console.log(`      antes:  ${JSON.stringify(serialize(c.before))}`);
    console.log(`      depois: ${JSON.stringify(serialize(c.after))}`);
  }
}

async function main() {
  console.log("=".repeat(64));
  console.log("FASE C.1 — Migração de áreas reserváveis");
  console.log(`Modo: ${APPLY ? "APPLY (escrita habilitada)" : "DRY RUN (nenhuma escrita)"}`);
  console.log(`Condomínio: ${CONDOMINIO_ID}`);
  console.log(`Projeto: ${EXPECTED_PROJECT_ID}`);
  console.log("=".repeat(64));

  const snap = await colRef.get();
  const current = new Map();
  for (const d of snap.docs) current.set(d.id, d.data());

  for (const required of ["salao_festas", "churrasqueira_2", "quadra"]) {
    if (!current.has(required)) fail(`documento esperado "${required}" não encontrado. Abortando.`);
  }

  const salaoLegado = current.get("salao_festas");
  const fotoSalao = salaoLegado.fotoUrl || null;
  const ST = admin.firestore.FieldValue.serverTimestamp();

  const creates = [];
  const updates = [];
  const noops = [];

  // ---- CRIAR: salões por bloco ----
  const novosSaloes = [
    { id: "salao_festas_rosas", nome: "Salão de Festas — Bloco Rosas", blocos: ["rosas"] },
    { id: "salao_festas_dalias", nome: "Salão de Festas — Bloco Dalias", blocos: ["dalias"] },
  ];

  for (const s of novosSaloes) {
    const target = {
      nome: s.nome,
      tipo: "SALAO",
      ativo: true,
      diaInteiro: true,
      horaInicio: 0,
      horaFim: 24,
      moeda: "BRL",
      preco: 25000,
      precoCentavos: 25000,
      escopoReserva: "BLOCO",
      blocosPermitidos: s.blocos,
      ...(fotoSalao ? { fotoUrl: fotoSalao } : {}),
    };
    const existing = current.get(s.id);
    if (!existing) {
      creates.push({ id: s.id, data: target });
    } else {
      const changes = [];
      for (const [k, v] of Object.entries(target)) {
        if (!eq(existing[k], v)) changes.push({ field: k, before: existing[k] ?? null, after: v });
      }
      if (changes.length) updates.push({ id: s.id, changes });
      else noops.push(s.id);
    }
  }

  // ---- ALTERAR: quadra ----
  {
    const q = current.get("quadra");
    const targetFields = {
      ativo: true,
      nome: "Campo / Quadra",
      tipo: "QUADRA",
      diaInteiro: true,
      horaInicio: 0,
      horaFim: 24,
      moeda: "BRL",
      preco: 0,
      precoCentavos: 0,
      escopoReserva: "CONDOMINIO",
    };
    const changes = [];
    for (const [k, v] of Object.entries(targetFields)) {
      if (!eq(q[k], v)) changes.push({ field: k, before: q[k] ?? null, after: v });
    }
    if (changes.length) updates.push({ id: "quadra", changes });
    else noops.push("quadra");
  }

  // ---- ALTERAR: churrasqueira_2 (opções) ----
  {
    const c2 = current.get("churrasqueira_2");
    const targetOpcoes = [
      { id: "padrao", nome: "Churrasqueira 2", precoCentavos: 8000 },
      {
        id: "com_campo",
        nome: "Churrasqueira 2 + Campo",
        precoCentavos: 28000,
        resourceIds: ["churrasqueira_2"],
        bloqueiaAreaId: null,
      },
    ];
    for (const op of targetOpcoes) {
      if (Array.isArray(op.resourceIds)) {
        const uniq = new Set(op.resourceIds);
        if (uniq.size !== op.resourceIds.length) fail(`resourceIds duplicados na opção ${op.id}`);
      }
    }
    if (!eq(c2.opcoes, targetOpcoes)) {
      updates.push({
        id: "churrasqueira_2",
        changes: [{ field: "opcoes", before: c2.opcoes ?? null, after: targetOpcoes }],
      });
    } else {
      noops.push("churrasqueira_2");
    }
  }

  // ---- ALTERAR: salao_festas (legado) ----
  {
    const changes = [];
    if (!eq(salaoLegado.legado, true)) changes.push({ field: "legado", before: salaoLegado.legado ?? null, after: true });
    const substituidoPor = ["salao_festas_rosas", "salao_festas_dalias"];
    if (!eq(salaoLegado.substituidoPor, substituidoPor)) {
      changes.push({ field: "substituidoPor", before: salaoLegado.substituidoPor ?? null, after: substituidoPor });
    }
    if (DESATIVAR_SALAO_LEGADO) {
      if (!eq(salaoLegado.ativo, false)) changes.push({ field: "ativo", before: salaoLegado.ativo ?? null, after: false });
    } else if (salaoLegado.ativo !== false) {
      console.log("");
      console.log("AVISO: salao_festas NÃO será desativado nesta execução.");
      console.log("  Motivo: bloqueador registrado — src/hooks/useReservas.ts:295-305 usa lista fixa");
      console.log("  ['salao_festas','churrasqueira_1','churrasqueira_2']; desativar agora removeria");
      console.log("  o único salão visível no frontend. Use --desativar-salao-legado após liberar o frontend.");
    }
    if (changes.length) updates.push({ id: "salao_festas", changes });
    else noops.push("salao_festas");
  }

  // ---- RELATÓRIO ----
  console.log("");
  console.log("CRIAR:");
  if (!creates.length) console.log("  (nenhum)");
  for (const c of creates) {
    console.log(`  Documento: ${c.id}`);
    console.log(`    depois: ${JSON.stringify(serialize(c.data), null, 6).replace(/\n/g, "\n    ")}`);
    console.log("    (+ createdAt/updatedAt = serverTimestamp)");
  }

  console.log("");
  console.log("ALTERAR:");
  if (!updates.length) console.log("  (nenhum)");
  for (const u of updates) {
    printDiff(u.id, u.changes);
    console.log("    (+ updatedAt = serverTimestamp)");
  }

  console.log("");
  console.log("SEM ALTERAÇÃO (no-op):");
  const untouched = [...noops, ...[...current.keys()].filter(
    (id) => !creates.some((c) => c.id === id) && !updates.some((u) => u.id === id) && !noops.includes(id)
  )];
  console.log(`  ${untouched.length ? untouched.join(", ") : "(nenhum)"}`);

  if (!APPLY) {
    console.log("");
    console.log("DRY RUN concluído. Nenhuma escrita foi realizada.");
    console.log("Para aplicar: node scripts/migrate-areas-reservaveis.mjs --apply");
    return;
  }

  if (!creates.length && !updates.length) {
    console.log("");
    console.log("Nada a aplicar (estado já migrado). Nenhuma escrita realizada.");
    return;
  }

  // ---- BACKUP pré-apply ----
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 8) + "-" + new Date().toTimeString().slice(0, 8).replace(/:/g, "");
  const bakDir = path.join(".bak", `areas-migration-${ts}`);
  fs.mkdirSync(bakDir, { recursive: true });
  const docsOut = {};
  for (const [id, data] of current.entries()) docsOut[id] = serialize(data);
  fs.writeFileSync(
    path.join(bakDir, "areasReservaveis-before.json"),
    JSON.stringify(
      {
        condominioId: CONDOMINIO_ID,
        projectId: EXPECTED_PROJECT_ID,
        exportedAt: new Date().toISOString(),
        collectionPath: `condominios/${CONDOMINIO_ID}/areasReservaveis`,
        docCount: current.size,
        docs: docsOut,
      },
      null,
      2
    )
  );
  console.log("");
  console.log(`Backup pré-apply gravado em: ${bakDir}/areasReservaveis-before.json`);

  // ---- ESCRITA (batch único) ----
  const batch = db.batch();
  for (const c of creates) {
    batch.set(colRef.doc(c.id), { ...c.data, createdAt: ST, updatedAt: ST });
  }
  for (const u of updates) {
    const payload = { updatedAt: ST };
    for (const ch of u.changes) payload[ch.field] = ch.after;
    batch.update(colRef.doc(u.id), payload);
  }
  await batch.commit();

  console.log("");
  console.log(`APPLY concluído: ${creates.length} criado(s), ${updates.length} alterado(s).`);
  console.log("Nenhum documento foi apagado.");
}

main().catch((e) => {
  console.error("ERRO FATAL:", e?.message || e);
  process.exit(1);
});
