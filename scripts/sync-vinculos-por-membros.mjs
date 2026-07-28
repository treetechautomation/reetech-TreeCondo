

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

// --- Configuração ---
function initAdmin() {
  if (getApps().length) return;
  try {
    const serviceAccountPath = path.resolve(process.cwd(), "serviceAccountKey.json");
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error("Chave de serviço 'serviceAccountKey.json' não encontrada na raiz do projeto.");
    }
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    initializeApp({ credential: cert(serviceAccount) });
  } catch (e) {
    console.error("Falha ao inicializar Firebase Admin. Tentando com credenciais padrão (ADC)...", e.message);
    initializeApp();
  }
}

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");

const SYNC_FIELDS = [
  "role",
  "status",
  "blocoId",
  "blocoIdNorm",
  "unidadeId",
  "unidadeIdNorm",
  "unitDocId",
  "menuPermissions",
];

// Safety: only include fields actually present on the authoritative source.
// Never overwrite a valid vinculo value with null because the membro is missing the field.
function buildSafeVinculoData(membroData, condId, condNome) {
  const data = {
    condominioId: condId,
    condominioNome: condNome,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // role and status are guaranteed to exist (guarded by hasMinimalData)
  data.role = membroData.role;
  data.status = membroData.status;

  // For optional fields: only include if the membro explicitly has them.
  // This prevents null-overwrite of valid vinculo data.
  const optionalFields = ["blocoId", "blocoIdNorm", "unidadeId", "unidadeIdNorm", "unitDocId"];
  for (const f of optionalFields) {
    // hasOwnProperty check: the field exists on the document (even if value is null)
    if (Object.prototype.hasOwnProperty.call(membroData, f)) {
      data[f] = membroData[f] ?? null;
    }
    // else: field NOT present on membro → do NOT write to vinculo → merge preserves existing
  }

  if (Object.prototype.hasOwnProperty.call(membroData, "menuPermissions")) {
    data.menuPermissions = membroData.menuPermissions ?? null;
  }

  return data;
}

function hasMinimalData(membroData) {
  return !!(membroData.role && membroData.status);
}

function maskUid(uid) {
  return uid.slice(0, 8) + "...";
}

function fmt(v) {
  if (v === null || v === undefined) return "<nulo>";
  if (v === "") return "<vazio>";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a !== typeof b) return false;
  if (typeof a === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function diffField(field, membroVal, vinculoVal) {
  // If membro doesn't have the field at all, it should NOT be synced.
  // But for comparison we normalize.
  const m = membroVal ?? null;
  const v = vinculoVal ?? null;
  if (deepEqual(m, v)) return null; // no diff
  return { field, autoritativo: m, atual: v };
}

async function main() {
  const args = process.argv.filter(a => !a.startsWith("--"));
  const condId = args[2];
  if (!condId) {
    console.error("❌ ERRO: Forneça o ID do condomínio como argumento.");
    console.log("Exemplo: node scripts/sync-vinculos-por-membros.mjs <condominio-id> [--dry-run] [--verbose]");
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("🔍 MODO DRY-RUN: Nenhuma alteração será persistida no Firestore.");
  }
  if (VERBOSE) {
    console.log("📋 MODO VERBOSE: Exibindo todas as divergências campo a campo.");
  }
  console.log("");

  initAdmin();
  const db = getFirestore();
  const membrosRef = db.collection(`condominios/${condId}/membros`);
  
  console.log(`🔄 Auditando vínculos para condomínio: ${condId}`);

  const condDoc = await db.doc(`condominios/${condId}`).get();
  if (!condDoc.exists) {
      console.error(`❌ Condomínio ${condId} não encontrado. Abortando.`);
      process.exit(1);
  }
  const condNome = condDoc.data().nome || condId;
  
  const snapshot = await membrosRef.get();
  if (snapshot.empty) {
    console.log("Nenhum membro encontrado. Nada a sincronizar.");
    return;
  }

  const membersToProcess = [];       // { uid, membroData, vinculoData, diffs[] }
  const membersSkippedSynced = [];   // already in sync
  const membersMissingData = [];     // no role/status
  const membersNoVinculo = [];       // active but no vinculo at all

  for (const membroDoc of snapshot.docs) {
    const uid = membroDoc.id;
    const membroData = membroDoc.data();

    if (!hasMinimalData(membroData)) {
      console.warn(`⚠️  [INCOMPLETO] ${uid} — sem 'role' ou 'status'. Pulado.`);
      membersMissingData.push({ uid, membroData });
      continue;
    }

    const vinculoRef = db.doc(`userCondominios/${uid}/vinculos/${condId}`);
    const existingVinculo = await vinculoRef.get();

    if (!existingVinculo.exists) {
      console.log(`  + ${maskUid(uid)} — NENHUM VÍNCULO (criar)`);
      membersNoVinculo.push({ uid, membroData });
      continue;
    }

    const vData = existingVinculo.data();

    // Compute diffs: only for fields the membro actually owns
    const diffs = [];
    for (const field of ["role", "status"]) {
      const d = diffField(field, membroData[field], vData[field]);
      if (d) diffs.push(d);
    }
    for (const field of ["blocoId", "blocoIdNorm", "unidadeId", "unidadeIdNorm", "unitDocId", "menuPermissions"]) {
      const membroHas = Object.prototype.hasOwnProperty.call(membroData, field);
      const vinculoHas = Object.prototype.hasOwnProperty.call(vData, field);
      if (membroHas) {
        const d = diffField(field, membroData[field], vData[field]);
        if (d) diffs.push(d);
      }
      // If membro doesn't have the field but vinculo does: NO diff. We preserve the vinculo value.
    }

    if (diffs.length === 0) {
      membersSkippedSynced.push(uid);
      if (VERBOSE) console.log(`  ✓ ${maskUid(uid)} — sincronizado`);
      continue;
    }

    if (VERBOSE) {
      console.log(`\n  ┌─ ${maskUid(uid)} (${membroData.role}/${membroData.status})`);
      for (const d of diffs) {
        console.log(`  ├─ ${d.field}: "${fmt(d.atual)}" → "${fmt(d.autoritativo)}"`);
      }
      // Show fields that would NOT be touched (vinculo has, membro doesn't)
      const preservedFields = [];
      for (const field of ["blocoId", "blocoIdNorm", "unidadeId", "unidadeIdNorm", "unitDocId", "menuPermissions"]) {
        if (!Object.prototype.hasOwnProperty.call(membroData, field) && Object.prototype.hasOwnProperty.call(vData, field) && vData[field] != null) {
          preservedFields.push(`${field}="${fmt(vData[field])}"`);
        }
      }
      if (preservedFields.length) {
        console.log(`  └─ [PRESERVADO] ${preservedFields.join(", ")}`);
      } else {
        console.log(`  └─`);
      }
    } else {
      const diffNames = diffs.map(d => d.field).join(",");
      console.log(`  ↻ ${maskUid(uid)} — ${diffNames}`);
    }

    membersToProcess.push({ uid, membroData, vinculoData: vData, diffs });
  }

  // ==== SUMMARY ====
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 RESUMO DA AUDITORIA`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Total de membros na coleção: ${snapshot.docs.length}`);
  console.log(`  Criar vínculo (sem vínculo):   ${membersNoVinculo.length}`);
  console.log(`  Atualizar (divergente):        ${membersToProcess.length}`);
  console.log(`  Sincronizado (OK):             ${membersSkippedSynced.length}`);
  console.log(`  Pulados (dados incompletos):   ${membersMissingData.length}`);

  if (membersToProcess.length > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 DETALHE DAS ${membersToProcess.length} DIVERGÊNCIAS`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`  UID_MASK     | ROLE                | STATUS              | BLOCO               | UNIDADE              | CLASSIFICAÇÃO`);
    console.log(`  ${'─'.repeat(13)}+${'─'.repeat(21)}+${'─'.repeat(21)}+${'─'.repeat(21)}+${'─'.repeat(21)}+${'─'.repeat(20)}`);

    for (const m of membersToProcess) {
      const roleDiff = m.diffs.find(d => d.field === "role");
      const statusDiff = m.diffs.find(d => d.field === "status");
      const blocoDiff = m.diffs.find(d => d.field === "blocoId");
      const unidadeDiff = m.diffs.find(d => d.field === "unidadeId");
      const menuDiff = m.diffs.find(d => d.field === "menuPermissions");

      const roleStr = roleDiff ? `${fmt(roleDiff.atual)}→${fmt(roleDiff.autoritativo)}` : "OK";
      const statusStr = statusDiff ? `${fmt(statusDiff.atual)}→${fmt(statusDiff.autoritativo)}` : "OK";
      const blocoStr = blocoDiff ? `${fmt(blocoDiff.atual)}→${fmt(blocoDiff.autoritativo)}` : "OK";
      const unidadeStr = unidadeDiff ? `${fmt(unidadeDiff.atual)}→${fmt(unidadeDiff.autoritativo)}` : "OK";

      // Classification logic
      let classification = "SAFE_UPDATE";
      const role = String(m.membroData.role || "").toUpperCase();

      // Role escalation check
      if (roleDiff) {
        const fromRole = String(roleDiff.atual || "").toUpperCase();
        const toRole = String(roleDiff.autoritativo || "").toUpperCase();
        const elevatedRoles = ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO"];
        if (elevatedRoles.includes(toRole) && !elevatedRoles.includes(fromRole) && fromRole !== "") {
          classification = "SUSPICIOUS"; // Role elevation
        }
      }

      // Status activation check
      if (statusDiff) {
        const from = String(statusDiff.atual || "").toUpperCase();
        const to = String(statusDiff.autoritativo || "").toUpperCase();
        if (to === "ATIVO" && from !== "ATIVO" && from !== "") {
          classification = "SUSPICIOUS"; // Status activation
        }
      }

      // MORADOR sem unidade
      if (role === "MORADOR" && !m.membroData.unidadeId && !m.membroData.unidadeIdNorm) {
        classification = "MANUAL_REVIEW"; // Real resident without unit
      }

      // STAFF is fine without unit
      const staffRoles = ["PORTEIRO", "ZELADOR", "SEGURANCA", "SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"];
      if (staffRoles.includes(role) && classification === "MANUAL_REVIEW") {
        classification = "SAFE_UPDATE";
      }

      console.log(`  ${maskUid(m.uid).padEnd(13)}| ${roleStr.padEnd(21)}| ${statusStr.padEnd(21)}| ${blocoStr.padEnd(21)}| ${unidadeStr.padEnd(21)}| ${classification}`);

      // Update classification in the record
      m.classification = classification;
    }
  }

  // Incomplete members detail
  if (membersMissingData.length > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`⚠️  ${membersMissingData.length} REGISTROS INCOMPLETOS (sem role/status)`);
    console.log(`${'─'.repeat(60)}`);
    for (const m of membersMissingData) {
      console.log(`  ${m.uid} — campos presentes: ${Object.keys(m.membroData).filter(k => m.membroData[k] != null).join(", ") || "nenhum"}`);
    }
  }

  // No-vinculo members
  if (membersNoVinculo.length > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`➕ ${membersNoVinculo.length} MEMBROS SEM VÍNCULO`);
    console.log(`${'─'.repeat(60)}`);
    for (const m of membersNoVinculo) {
      console.log(`  ${maskUid(m.uid)} — role=${m.membroData.role} status=${m.membroData.status}`);
    }
  }

  // Classification breakdown
  if (membersToProcess.length > 0) {
    const counts = {};
    for (const m of membersToProcess) {
      const c = m.classification || "SAFE_UPDATE";
      counts[c] = (counts[c] || 0) + 1;
    }
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🏷️  CLASSIFICAÇÃO`);
    console.log(`${'─'.repeat(60)}`);
    for (const [cls, count] of Object.entries(counts)) {
      console.log(`  ${cls}: ${count}`);
    }
  }

  if (DRY_RUN) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log("🔍 DRY-RUN CONCLUÍDO. Nenhuma alteração foi feita.");
    console.log(`${'═'.repeat(60)}`);

    const safeCount = membersToProcess.filter(m => (m.classification || "SAFE_UPDATE") === "SAFE_UPDATE").length;
    const notSafeCount = membersToProcess.length - safeCount;

    if (notSafeCount > 0) {
      console.log(`\n⚠️  ${notSafeCount} registro(s) classificados como NÃO SEGUROS para sync automático.`);
      console.log("   Sync real BLOQUEADO para estes casos. Revisão manual necessária.");
    }

    if (safeCount > 0) {
      console.log(`\n✅ ${safeCount} registro(s) SAFE_UPDATE — prontos para sync.`);
    }
    return;
  }

  // ==== WRITE MODE ====
  if (membersToProcess.length === 0) {
    console.log("\nNenhum vínculo para sincronizar.");
    return;
  }

  const batch = db.batch();
  for (const { uid, membroData } of membersToProcess) {
    const vinculoRef = db.doc(`userCondominios/${uid}/vinculos/${condId}`);
    const vinculoData = buildSafeVinculoData(membroData, condId, condNome);
    batch.set(vinculoRef, vinculoData, { merge: true });
  }

  try {
    await batch.commit();
    console.log(`\n✅ Sucesso! ${membersToProcess.length} vínculos foram escritos/atualizados.`);
  } catch(e) {
    console.error("\n❌ ERRO FATAL ao executar o batch de sincronização:", e);
  }

  console.log("\n--- Sincronização Concluída ---");
}

main().catch((error) => {
  console.error("Ocorreu um erro inesperado:", error);
  process.exit(1);
});
