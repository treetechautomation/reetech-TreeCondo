import admin from "firebase-admin";
import fs from "node:fs";

const condId = process.argv[2];
if (!condId) {
  console.log("USO: node scripts/listar-membros-condominio.mjs <COND_ID>");
  process.exit(1);
}

if (!admin.apps.length) {
  const sa = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const snap = await db.collection("condominios").doc(condId).collection("membros").get();

console.log("🏢 condId:", condId);
console.log("👥 membros:", snap.size);
console.log("");

for (const d of snap.docs) {
  const data = d.data() || {};
  console.log("- docId:", d.id);
  console.log("  uid:", data.uid ?? null);
  console.log("  status:", data.status ?? null);
  console.log("  role:", data.role ?? null);
  console.log("  menu.anuncios:", data?.menuPermissions?.anuncios ?? null);
  console.log("");
}
