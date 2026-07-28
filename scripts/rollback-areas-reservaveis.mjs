#!/usr/bin/env node
/**
 * FASE C.1 — Rollback da migração das áreas reserváveis (Chácara Itaguaí)
 *
 * Uso:
 *   node scripts/rollback-areas-reservaveis.mjs [--backup <arquivo.json>]           # DRY RUN
 *   node scripts/rollback-areas-reservaveis.mjs [--backup <arquivo.json>] --apply   # executa rollback
 *
 * Comportamento:
 *   - restaura integralmente os documentos presentes no backup (set completo);
 *   - documentos criados após o backup (ex.: salao_festas_rosas/dalias) são
 *     DESATIVADOS (ativo:false, rollbackDesativadoEm) — nunca apagados fisicamente;
 *   - não toca em reservas nem em outros condomínios;
 *   - aborta se project_id da credencial != studio-7559545170-41328.
 *
 * Backup padrão: o mais recente em .bak/areas-migration-<ts>/areasReservaveis-before.json
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const EXPECTED_PROJECT_ID = "studio-7559545170-41328";
const CONDOMINIO_ID = "RtJ7G92QwWvJ13Qq8Ntx";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const bakFlagIdx = args.indexOf("--backup");
const backupArg = bakFlagIdx >= 0 ? args[bakFlagIdx + 1] : null;

function fail(msg) {
  console.error(`ERRO: ${msg}`);
  process.exit(1);
}

function findLatestBackup() {
  const bakRoot = ".bak";
  if (!fs.existsSync(bakRoot)) return null;
  const dirs = fs
    .readdirSync(bakRoot)
    .filter((d) => d.startsWith("areas-migration-"))
    .sort()
    .reverse();
  for (const d of dirs) {
    const f = path.join(bakRoot, d, "areasReservaveis-before.json");
    if (fs.existsSync(f)) return f;
  }
  return null;
}

const backupPath = backupArg || findLatestBackup();
if (!backupPath || !fs.existsSync(backupPath)) fail("backup não encontrado. Use --backup <arquivo.json>.");

let backup;
try {
  backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
} catch (e) {
  fail(`não foi possível ler o backup (${e.message})`);
}
if (backup.condominioId !== CONDOMINIO_ID) fail(`backup pertence a outro condomínio ("${backup.condominioId}"). Abortando.`);
if (backup.projectId !== EXPECTED_PROJECT_ID) fail(`backup pertence a outro projeto ("${backup.projectId}"). Abortando.`);

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

function revive(v) {
  if (v === null || v === undefined || typeof v !== "object") return v;
  if (v.__type === "timestamp" && typeof v.iso === "string") {
    return admin.firestore.Timestamp.fromDate(new Date(v.iso));
  }
  if (Array.isArray(v)) return v.map(revive);
  const r = {};
  for (const [k, val] of Object.entries(v)) r[k] = revive(val);
  return r;
}

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

async function main() {
  console.log("=".repeat(64));
  console.log("FASE C.1 — ROLLBACK de áreas reserváveis");
  console.log(`Modo: ${APPLY ? "APPLY (escrita habilitada)" : "DRY RUN (nenhuma escrita)"}`);
  console.log(`Backup: ${backupPath} (exportedAt: ${backup.exportedAt})`);
  console.log(`Condomínio: ${CONDOMINIO_ID}`);
  console.log("=".repeat(64));

  const snap = await colRef.get();
  const current = new Map();
  for (const d of snap.docs) current.set(d.id, d.data());

  const restores = [];
  const deactivates = [];
  const noops = [];

  for (const [id, savedRaw] of Object.entries(backup.docs)) {
    const cur = current.get(id);
    if (cur && stable(serialize(cur)) === stable(savedRaw)) {
      noops.push(id);
    } else {
      restores.push({ id, data: revive(savedRaw), existedBefore: !!cur });
    }
  }

  for (const id of current.keys()) {
    if (!(id in backup.docs)) {
      const cur = current.get(id);
      if (cur.ativo === false && cur.rollbackDesativadoEm) noops.push(id);
      else deactivates.push({ id, before: cur });
    }
  }

  console.log("");
  console.log("RESTAURAR (set completo para o estado do backup):");
  if (!restores.length) console.log("  (nenhum)");
  for (const r of restores) {
    console.log(`  Documento: ${r.id}${r.existedBefore ? "" : " (não existe atualmente — será recriado)"}`);
    console.log(`    depois: ${JSON.stringify(backup.docs[r.id])}`);
  }

  console.log("");
  console.log("DESATIVAR (criados após o backup — sem delete físico):");
  if (!deactivates.length) console.log("  (nenhum)");
  for (const d of deactivates) {
    console.log(`  Documento: ${d.id}`);
    console.log(`    ativo: ${JSON.stringify(d.before.ativo ?? null)} -> false`);
    console.log(`    rollbackDesativadoEm: serverTimestamp`);
  }

  console.log("");
  console.log("SEM ALTERAÇÃO (no-op):");
  console.log(`  ${noops.length ? noops.join(", ") : "(nenhum)"}`);

  if (!APPLY) {
    console.log("");
    console.log("DRY RUN concluído. Nenhuma escrita foi realizada.");
    console.log("Para aplicar: node scripts/rollback-areas-reservaveis.mjs --apply");
    return;
  }

  if (!restores.length && !deactivates.length) {
    console.log("");
    console.log("Nada a fazer. Nenhuma escrita realizada.");
    return;
  }

  const ST = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  for (const r of restores) batch.set(colRef.doc(r.id), r.data);
  for (const d of deactivates) {
    batch.update(colRef.doc(d.id), { ativo: false, rollbackDesativadoEm: ST });
  }
  await batch.commit();

  console.log("");
  console.log(`ROLLBACK concluído: ${restores.length} restaurado(s), ${deactivates.length} desativado(s).`);
  console.log("Nenhum documento foi apagado.");
}

main().catch((e) => {
  console.error("ERRO FATAL:", e?.message || e);
  process.exit(1);
});
