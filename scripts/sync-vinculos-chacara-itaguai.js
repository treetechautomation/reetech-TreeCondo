const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error("ERRO: serviceAccountKey.json não encontrado na raiz do projeto.");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
}
const db = admin.firestore();

const condominioId = "chacara-itaguai";

(async () => {
  try {
    console.log(`Iniciando sincronização de vínculos para o condomínio: ${condominioId}`);
    
    const condominioDoc = await db.doc(`condominios/${condominioId}`).get();
    if (!condominioDoc.exists) {
        console.error(`❌ Erro: Condomínio com ID '${condominioId}' não encontrado. Rode 'npm run seed' primeiro.`);
        return;
    }
    const condominioNome = condominioDoc.data().nome;

    const membrosRef = db.collection(`condominios/${condominioId}/membros`);
    const membrosSnap = await membrosRef.where('ativo', '==', true).get();

    if (membrosSnap.empty) {
      console.log("⚠️ Nenhum membro ativo encontrado para sincronizar.");
      return;
    }

    const batch = db.batch();
    let count = 0;

    for (const membroDoc of membrosSnap.docs) {
      const membro = membroDoc.data();
      if (!membro.uid) {
        console.warn(`- Pulando membro com ID ${membroDoc.id} (sem campo 'uid').`);
        continue;
      }

      const vinculoRef = db.doc(`userCondominios/${membro.uid}/vinculos/${condominioId}`);
      
      const vinculoData = {
        uid: membro.uid,
        condominioId: condominioId,
        condominioNome: condominioNome,
        role: membro.role,
        scope: membro.scope,
        ativo: membro.ativo,
        updatedAt: new Date().toISOString(),
      };

      batch.set(vinculoRef, vinculoData, { merge: true });
      count++;
      console.log(`- Preparando vínculo para UID: ${membro.uid} | Role: ${membro.role}`);
    }

    await batch.commit();
    console.log(`\n✅ Sucesso! ${count} vínculos foram sincronizados.`);
    console.log("👉 Próximo passo: rode `npm run verify` para checar a consistência dos dados.");

  } catch (error) {
    console.error("❌ Erro ao sincronizar vínculos:", error);
    process.exit(1);
  }
})();
