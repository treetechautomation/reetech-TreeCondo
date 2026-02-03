const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

function initializeAdmin() {
  if (admin.apps.length) return;

  // Primeiro, tenta com a chave de serviço local (ambiente de dev/studio)
  const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
      console.log("✅ Admin SDK inicializado com serviceAccountKey.json.");
      return;
    } catch (e) {
      console.warn("⚠️ Falha ao ler serviceAccountKey.json, tentando Application Default Credentials...");
    }
  }

  // Se falhar, usa as credenciais padrão do ambiente (produção/GCP)
  try {
    admin.initializeApp({
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    console.log("✅ Admin SDK inicializado com Application Default Credentials.");
  } catch (e) {
    console.error("❌ Falha crítica ao inicializar Admin SDK. Verifique suas credenciais.");
    throw e;
  }
}

async function main() {
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split("=");
    acc[key.replace("--", "")] = value === undefined ? true : value;
    return acc;
  }, {});

  const { cond: condominioId, list, fix } = args;

  if (!condominioId) {
    console.error("❌ Erro: ID do condomínio é obrigatório. Use --cond=SEU_ID_AQUI");
    process.exit(1);
  }

  if (!list && !fix) {
    console.error("❌ Erro: Especifique uma ação: --list ou --fix");
    process.exit(1);
  }

  initializeAdmin();

  const db = admin.firestore();
  const storage = admin.storage();
  const bucket = storage.bucket();

  console.log(`\n🔍 Verificando documentos órfãos no condomínio: ${condominioId}`);
  console.log(`- Modo: ${fix ? "CORREÇÃO (irá apagar)" : "LISTAGEM (apenas leitura)"}`);
  console.log(`- Bucket: ${bucket.name}\n`);

  const docsRef = db.collection(`condominios/${condominioId}/documentos`);
  const snapshot = await docsRef.get();

  if (snapshot.empty) {
    console.log("ℹ️ Nenhum documento encontrado. Nada a fazer.");
    return;
  }

  const orphans = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const storagePath = data.storagePath;

    if (!storagePath) {
      console.warn(`- ⚠️ Documento ${doc.id} não tem storagePath. Considerado órfão.`);
      orphans.push({ id: doc.id, path: "(sem path)" });
      continue;
    }

    const file = bucket.file(storagePath);
    const [exists] = await file.exists();

    if (!exists) {
      orphans.push({ id: doc.id, path: storagePath });
    }
  }

  if (orphans.length === 0) {
    console.log("✅ Nenhum documento órfão encontrado!");
    return;
  }

  console.log(`\n🚨 Encontrados ${orphans.length} documento(s) órfão(s):`);
  orphans.forEach(o => console.log(`  - ID: ${o.id}, Path: ${o.path}`));

  if (fix) {
    console.log("\n⚡ Iniciando remoção...");
    let removedCount = 0;
    for (const orphan of orphans) {
      try {
        await docsRef.doc(orphan.id).delete();
        console.log(`  - Removido: ${orphan.id}`);
        removedCount++;
      } catch (e) {
        console.error(`  - ❌ Falha ao remover ${orphan.id}:`, e.message);
      }
    }
    console.log(`\n✅ Operação concluída. ${removedCount} de ${orphans.length} órfãos foram removidos.`);
  } else {
    console.log("\n👉 Rode com a flag --fix para remover os documentos listados do Firestore.");
  }
}

main().catch((e) => {
  console.error("\n--- ERRO INESPERADO ---");
  console.error(e);
  process.exit(1);
});
