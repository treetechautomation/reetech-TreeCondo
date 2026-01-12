import admin from "firebase-admin";
import fs from "node:fs";

const uid = process.argv[2];
if (!uid) {
  console.log("USO: node scripts/debug-userCondominios.mjs <UID>");
  process.exit(1);
}

if (!admin.apps.length) {
  const sa = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function main() {
  const userRef = db.collection("userCondominios").doc(uid);
  const userSnap = await userRef.get();

  console.log("userCondominios/<uid> exists:", userSnap.exists);
  if (userSnap.exists) console.log("userCondominios/<uid> data:", userSnap.data());

  const vincSnap = await userRef.collection("vinculos").get();
  console.log("vinculos count:", vincSnap.size);

  vincSnap.forEach((d) => {
    console.log("-", d.id, d.data());
  });
}

main().catch((e) => {
  console.error("❌ erro:", e?.message || e);
  process.exit(1);
});
