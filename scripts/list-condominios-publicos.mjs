import admin from "firebase-admin";
import fs from "node:fs";

if (!admin.apps.length) {
  const keyPath = "serviceAccountKey.json";
  const sa = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();
const snap = await db.collection("condominiosPublicos").get();

console.log("condominiosPublicos (ids):");
snap.forEach((d) => {
  const data = d.data() || {};
  console.log("-", d.id, "| nome:", data.nome ?? "(sem nome)");
});
