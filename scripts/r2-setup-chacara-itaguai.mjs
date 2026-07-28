#!/usr/bin/env node
/**
 * FASE R2 — Setup Chácara Itaguaí para exclusividade Campo + Churrasqueira 2.
 *
 * Uso:
 *   node scripts/r2-setup-chacara-itaguai.mjs                  # DRY RUN
 *   node scripts/r2-setup-chacara-itaguai.mjs --apply          # aplica
 *
 * Garantias:
 *   - opera exclusivamente em condominios/RtJ7G92QwWvJ13Qq8Ntx
 *   - idempotente
 *   - nunca apaga documentos
 *   - backup em .bak/r2-setup-<ts>/ antes de --apply
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const EXPECTED_PROJECT_ID = "studio-7559545170-41328";
const CONDOMINIO_ID = "RtJ7G92QwWvJ13Qq8Ntx";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

function fail(msg) { console.error(`ERRO: ${msg}`); process.exit(1); }

let sa;
try { sa = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8")); }
catch (e) { fail(`não foi possível ler ./serviceAccountKey.json (${e.message})`); }
if (sa.project_id !== EXPECTED_PROJECT_ID) fail(`project_id "${sa.project_id}" != "${EXPECTED_PROJECT_ID}"`);

if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const colRef = db.collection("condominios").doc(CONDOMINIO_ID).collection("areasReservaveis");

function serialize(v: any): any {
  if (v === null || v === undefined || typeof v !== "object") return v;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(serialize);
  const r: Record<string, any> = {};
  for (const [k, val] of Object.entries(v)) r[k] = serialize(val);
  return r;
}

async function main() {
  console.log("=".repeat(64));
  console.log("FASE R2 — Setup Chácara Itaguaí (exclusividade Campo)");
  console.log(`Modo: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Condomínio: ${CONDOMINIO_ID}`);
  console.log("=".repeat(64));

  const snap = await colRef.get();
  const current = new Map<string, any>();
  for (const d of snap.docs) current.set(d.id, d.data());

  for (const required of ["quadra", "churrasqueira_2"]) {
    if (!current.has(required)) fail(`documento esperado "${required}" não encontrado.`);
  }

  const updates: any[] = [];
  const noops: string[] = [];

  // quadra: ativar + ehUsoComum
  {
    const q = current.get("quadra");
    const changes: any[] = [];
    if (!q.ativo) changes.push({ field: "ativo", before: q.ativo, after: true });
    if (!q.ehUsoComum) changes.push({ field: "ehUsoComum", before: q.ehUsoComum ?? null, after: true });
    if (q.precoCentavos == null) changes.push({ field: "precoCentavos", before: null, after: q.preco ?? 0 });
    if (changes.length) updates.push({ id: "quadra", changes });
    else noops.push("quadra");
  }

  // churrasqueira_2: corrigir opções
  {
    const c2 = current.get("churrasqueira_2");
    const ops = Array.isArray(c2.opcoes) ? c2.opcoes : [];
    const newOps = ops.map((op: any) => {
      if (op.id === "com_campo") {
        const cleaned: any = { id: op.id, nome: op.nome, precoCentavos: op.precoCentavos ?? 28000 };
        if (op.resourceIds != null) cleaned.resourceIds = null;
        if (op.bloqueiaAreaId != null) cleaned.bloqueiaAreaId = null;
        return cleaned;
      }
      return op;
    });
    const changes: any[] = [];
    if (JSON.stringify(ops) !== JSON.stringify(newOps)) {
      changes.push({ field: "opcoes", before: ops, after: newOps });
    }
    if (changes.length) updates.push({ id: "churrasqueira_2", changes });
    else noops.push("churrasqueira_2");
  }

  // Report
  console.log("\nALTERAR:");
  if (!updates.length) console.log("  (nenhum)");
  for (const u of updates) {
    console.log(`  Documento: ${u.id}`);
    for (const c of u.changes) {
      console.log(`    campo: ${c.field}`);
      console.log(`      antes:  ${JSON.stringify(c.before)}`);
      console.log(`      depois: ${JSON.stringify(c.after)}`);
    }
  }
  console.log("\nSEM ALTERAÇÃO:");
  console.log(`  ${noops.length ? noops.join(", ") : "(nenhum)"}`);

  if (!APPLY) {
    console.log("\nDRY RUN concluído. Use --apply para aplicar.");
    return;
  }

  if (!updates.length) {
    console.log("\nNada a aplicar.");
    return;
  }

  // Backup
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const bakDir = path.join(".bak", `r2-setup-${ts}`);
  fs.mkdirSync(bakDir, { recursive: true });
  const docsOut: Record<string, any> = {};
  for (const [id, data] of current.entries()) docsOut[id] = serialize(data);
  fs.writeFileSync(path.join(bakDir, "areas-before.json"), JSON.stringify({ condominioId: CONDOMINIO_ID, exportedAt: new Date().toISOString(), docs: docsOut }, null, 2));
  console.log(`\nBackup: ${bakDir}/areas-before.json`);

  const batch = db.batch();
  for (const u of updates) {
    const payload: Record<string, any> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    for (const ch of u.changes) payload[ch.field] = ch.after;
    batch.update(colRef.doc(u.id), payload);
  }
  await batch.commit();
  console.log(`\nAPPLY: ${updates.length} documento(s) alterado(s).`);
}

main().catch(e => { console.error("FATAL:", e?.message || e); process.exit(1); });
