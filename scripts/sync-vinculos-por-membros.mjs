
import { initializeApp, cert } from "firebase-admin/app";
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

async function main() {
  const condId = process.argv[2];
  if (!condId) {
    console.error("❌ ERRO: Forneça o ID do condomínio como argumento.");
    console.log("Exemplo: node scripts/sync-vinculos-por-membros.mjs meu-condominio-id");
    process.exit(1);
  }

  initAdmin();
  const db = getFirestore();
  const membrosRef = db.collection(`condominios/${condId}/membros`);
  
  console.log(`\n🔄 Iniciando sincronização de vínculos para condomínio: ${condId}`);

  // Pega o nome do condomínio para espelhar no vínculo
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

  const batch = db.batch();
  let updatedCount = 0;

  for (const membroDoc of snapshot.docs) {
    const uid = membroDoc.id; // Assumindo que a migração já foi feita (docId === uid)
    const membroData = membroDoc.data();

    // Validações mínimas
    if (!membroData.role || !membroData.status) {
        console.warn(`- ⚠️ [Pulando] Membro ${uid} sem 'role' ou 'status'.`);
        continue;
    }
    
    console.log(`- Preparando vínculo para ${uid} | Role: ${membroData.role}`);
    
    const vinculoRef = db.doc(`userCondominios/${uid}/vinculos/${condId}`);
    
    const vinculoData = {
      condominioId: condId,
      condominioNome: condNome, // Espelha o nome para a UI
      role: membroData.role,
      blocoId: membroData.blocoId || null,
      unidadeId: membroData.unidadeId || null,
      status: membroData.status, // Espelha o status (ATIVO/INATIVO)
      updatedAt: FieldValue.serverTimestamp(),
    };
    
    // Usamos `merge: true` para não sobrescrever `createdAt` se já existir.
    batch.set(vinculoRef, vinculoData, { merge: true });
    updatedCount++;
  }

  try {
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`\n✅ Sucesso! ${updatedCount} vínculos foram escritos/atualizados.`);
    } else {
      console.log("\nNenhum vínculo para sincronizar.");
    }
  } catch(e) {
    console.error("\n❌ ERRO FATAL ao executar o batch de sincronização:", e);
  }

  console.log("\n--- Sincronização Concluída ---");
}

main().catch((error) => {
  console.error("Ocorreu um erro inesperado:", error);
  process.exit(1);
});
