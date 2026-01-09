
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

// --- Configuração ---
// Carrega a chave de serviço da raiz do projeto.
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
    initializeApp(); // Fallback para Application Default Credentials (usado em ambientes de nuvem)
  }
}

async function main() {
  const condId = process.argv[2];
  if (!condId) {
    console.error("❌ ERRO: Forneça o ID do condomínio como argumento.");
    console.log("Exemplo: node scripts/migrar-membros-docid-para-uid.mjs meu-condominio-id");
    process.exit(1);
  }

  initAdmin();
  const db = getFirestore();
  const membrosRef = db.collection(`condominios/${condId}/membros`);
  
  console.log(`\n🔎 Iniciando migração para condomínio: ${condId}`);

  const snapshot = await membrosRef.get();
  if (snapshot.empty) {
    console.log("Nenhum membro encontrado. Nada a fazer.");
    return;
  }

  const report = {
    total: snapshot.size,
    correct: 0,
    migrated: 0,
    missingUid: 0,
    errors: 0,
  };

  const batch = db.batch();
  const migrationPromises = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const docId = doc.id;
    const uidField = data.uid;

    if (!uidField || typeof uidField !== 'string' || uidField.trim() === "") {
      console.warn(`- ⚠️ [UID Ausente] Documento ${docId} não possui campo 'uid' válido.`);
      report.missingUid++;
      continue;
    }

    if (docId === uidField) {
      report.correct++;
    } else {
      console.log(`- ➡️ [Migrar] Documento ${docId} será migrado para ${uidField}.`);
      const newData = {
        ...data,
        uid: uidField, // Garante que o campo uid está correto
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      const newDocRef = membrosRef.doc(uidField);
      batch.set(newDocRef, newData, { merge: true });
      report.migrated++;
    }
  }

  try {
    if (report.migrated > 0) {
      await batch.commit();
      console.log(`\n✨ Batch de ${report.migrated} migrações concluído com sucesso.`);
    } else {
      console.log("\nNenhuma migração necessária.");
    }
  } catch(e) {
    console.error("\n❌ ERRO FATAL ao executar o batch de migração:", e);
    report.errors = report.migrated;
    report.migrated = 0;
  }

  // --- Relatório Final ---
  console.log("\n--- Relatório Final da Migração ---");
  console.log(`Total de documentos processados: ${report.total}`);
  console.log(`✅ Documentos já corretos (docId === uid): ${report.correct}`);
  console.log(`➡️ Documentos migrados com sucesso: ${report.migrated}`);
  console.log(`⚠️ Documentos com UID ausente (pulados): ${report.missingUid}`);
  if(report.errors > 0) {
    console.log(`❌ Documentos que falharam na migração: ${report.errors}`);
  }
  console.log("------------------------------------\n");
  console.log("👉 IMPORTANTE: Rode `npm run sync-vinculos` para atualizar os acessos dos usuários.");
}

main().catch((error) => {
  console.error("Ocorreu um erro inesperado:", error);
  process.exit(1);
});
