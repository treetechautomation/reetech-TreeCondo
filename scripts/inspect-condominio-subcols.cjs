const { getApps, initializeApp, getApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = "studio-7559545170-41328";

async function main() {
  const condId = process.argv[2];
  if (!condId) {
    console.error("Uso: node scripts/inspect-condominio-subcols.cjs <condominioId>");
    process.exit(1);
  }

  if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore(getApp());

  const ref = db.collection("condominios").doc(condId);

  const condSnap = await ref.get();
  console.log("condominio exists?", condSnap.exists);

  // lista subcoleções do doc
  const cols = await ref.listCollections();
  const names = cols.map((c) => c.id).sort();
  console.log("subcollections:", names);

  // mostra contagem (amostra) de cada subcoleção
  for (const c of cols) {
    try {
      const snap = await c.limit(5).get();
      console.log(`- ${c.id}: sampleCount=${snap.size} sampleIds=${snap.docs.map(d=>d.id).slice(0,5).join(", ")}`);
      if (snap.size) {
        console.log(`  firstDocDataKeys:`, Object.keys(snap.docs[0].data() || {}).slice(0, 30));
      }
    } catch (e) {
      console.log(`- ${c.id}: error=${e?.message || e}`);
    }
  }
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
