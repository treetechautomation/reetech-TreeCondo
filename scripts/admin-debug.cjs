const path = require("path");

// tenta carregar o build JS do admin (se existir) via next transpilation
// MAS como estamos no repo TS, vamos importar pelo caminho compilado do Next se estiver rodando.
// Alternativa mais simples: usar firebase-admin direto aqui e ler env do projeto.

const { getApps, initializeApp, getApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const TARGET_PROJECT_ID = "studio-7559545170-41328";

function getAdminApp() {
  if (!getApps().length) {
    console.log(`[admin-debug] init projectId: ${TARGET_PROJECT_ID}`);
    console.log(`[admin-debug] env GCLOUD_PROJECT: ${process.env.GCLOUD_PROJECT}`);
    console.log(`[admin-debug] env GOOGLE_CLOUD_PROJECT: ${process.env.GOOGLE_CLOUD_PROJECT}`);
    console.log(`[admin-debug] env FIREBASE_CONFIG: ${process.env.FIREBASE_CONFIG ? "(set)" : "(empty)"}`);

    initializeApp({ projectId: TARGET_PROJECT_ID });
  }
  return getApp();
}

(async () => {
  const app = getAdminApp();
  const db = getFirestore(app);

  console.log("✅ admin app name:", app.name);
  console.log("✅ admin projectId (options):", app.options && app.options.projectId);
  console.log("✅ env GCLOUD_PROJECT:", process.env.GCLOUD_PROJECT);
  console.log("✅ env GOOGLE_CLOUD_PROJECT:", process.env.GOOGLE_CLOUD_PROJECT);
  console.log("✅ env FIRESTORE_EMULATOR_HOST:", process.env.FIRESTORE_EMULATOR_HOST || "(none)");

  const condominioId = "RtJ7G92QwWvJ13Qq8NtxI";
  const condoSnap = await db.collection("condominios").doc(condominioId).get();
  console.log("condominio exists?", condoSnap.exists);

  const blocosSnap = await db
    .collection("condominios")
    .doc(condominioId)
    .collection("blocos")
    .get();

  console.log("blocos count:", blocosSnap.size);
  console.log("blocos ids:", blocosSnap.docs.map(d => d.id));
  console.log("first bloco data:", blocosSnap.docs[0]?.data?.() || null);
})();
