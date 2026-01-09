import admin from "firebase-admin";
import fs from "node:fs";

const condId = process.argv[2];
if (!condId) {
  console.log("USO: node scripts/listar-anuncios-condominio.mjs <COND_ID>");
  process.exit(1);
}

if (!admin.apps.length) {
  const sa = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const snap = await db.collection("condominios").doc(condId).collection("anuncios")
  .orderBy("createdAt", "desc").limit(10).get();

console.log("📢 anuncios:", snap.size);
snap.forEach((d) => {
  const a = d.data() || {};
  console.log("-", d.id, "| titulo:", a.titulo ?? "(sem titulo)", "| createdAt:", a.createdAt?.toDate?.()?.toISOString?.() ?? null);
});
