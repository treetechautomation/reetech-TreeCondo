import admin from "firebase-admin";
import fs from "node:fs";

const email = process.argv[2];
if (!email) {
  console.log("USO: node scripts/get-uid-por-email.mjs <EMAIL>");
  process.exit(1);
}

if (!admin.apps.length) {
  const sa = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

try {
  const u = await admin.auth().getUserByEmail(email);
  console.log("✅ uid:", u.uid);
  console.log("email:", u.email);
} catch (e) {
  console.error("❌ erro:", e?.message ?? e);
  process.exit(1);
}
