import admin from "firebase-admin";
import fs from "node:fs";

const [condId, uid] = process.argv.slice(2);
if (!condId || !uid) {
  console.log("USO: node scripts/check-membro.mjs <COND_ID> <UID>");
  process.exit(1);
}

if (!admin.apps.length) {
  const sa = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function main() {
  const ref = db.collection("condominios").doc(condId).collection("membros").doc(uid);
  const snap = await ref.get();

  console.log("exists:", snap.exists);
  if (!snap.exists) return;

  const d = snap.data() || {};
  console.log({
    uid: snap.id,
    email: d.email,
    role: d.role,
    status: d.status,
    menuPermissions: d.menuPermissions || null,
  });
}

main().catch((e) => {
  console.error("❌ erro:", e?.message || e);
  process.exit(1);
});
