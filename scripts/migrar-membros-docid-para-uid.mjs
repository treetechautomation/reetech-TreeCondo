import admin from "firebase-admin";
import fs from "node:fs";

const condId = process.argv[2];

if (!condId) {
  console.log("USO:");
  console.log("  node scripts/migrar-membros-docid-para-uid.mjs <COND_ID>");
  process.exit(1);
}

if (!admin.apps.length) {
  const sa = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(sa),
  });
}

const db = admin.firestore();

const membrosCol = db
  .collection("condominios")
  .doc(condId)
  .collection("membros");

const snap = await membrosCol.get();

console.log("🏢 Condomínio:", condId);
console.log("👥 Membros encontrados:", snap.size);

let migrated = 0;
let alreadyOk = 0;

let batch = db.batch();
let ops = 0;
const BATCH_LIMIT = 450;

for (const doc of snap.docs) {
  const data = doc.data() || {};
  const uid = data.uid;

  if (!uid) continue;

  // já está correto
  if (doc.id === uid) {
    alreadyOk++;
    continue;
  }

  const targetRef = membrosCol.doc(uid);

  batch.set(
    targetRef,
    {
      ...data,
      legacyDocId: doc.id,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  migrated++;
  ops++;

  if (ops >= BATCH_LIMIT) {
    await batch.commit();
    batch = db.batch();
    ops = 0;
  }
}

if (ops > 0) await batch.commit();

console.log("✅ Já estavam corretos (docId = uid):", alreadyOk);
console.log("🚀 Migrados / criados membros/{uid}:", migrated);

console.log("\nℹ️ Observações:");
console.log("- Os docs antigos NÃO foram apagados.");
console.log("- Agora a rule memberDoc(condId) vai funcionar.");
