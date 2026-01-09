import admin from "firebase-admin";
import fs from "node:fs";

const [condId, uid] = process.argv.slice(2);

if (!condId || !uid) {
  console.log("USO: node scripts/debug-morador-anuncios.mjs <condId> <uid>");
  process.exit(1);
}

if (!admin.apps.length) {
  const keyPath = "serviceAccountKey.json";
  if (!fs.existsSync(keyPath)) {
    console.error("ERRO: serviceAccountKey.json nao encontrado no root do projeto.");
    process.exit(1);
  }
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function main() {
  const memberRef = db.doc(`condominios/${condId}/membros/${uid}`);
  const memberSnap = await memberRef.get();

  console.log("=== MEMBER DOC ===");
  console.log("path:", memberRef.path);
  console.log("exists:", memberSnap.exists);

  if (memberSnap.exists) {
    const data = memberSnap.data() || {};
    console.log("role:", data.role);
    console.log("status:", data.status);
    console.log("menuPermissions.anuncios:", data?.menuPermissions?.anuncios);
    console.log("raw:", JSON.stringify(data, null, 2));
  }

  console.log("\n=== ANUNCIOS (top 5) ===");
  const anunciosRef = db.collection(`condominios/${condId}/anuncios`);
  const snap = await anunciosRef.orderBy("createdAt", "desc").limit(5).get();

  console.log("count(top5):", snap.size);
  snap.docs.forEach((d, i) => {
    const a = d.data() || {};
    const createdAt =
      a.createdAt?.toDate?.()?.toISOString?.() ||
      (a.createdAt ? String(a.createdAt) : null);
    console.log(`- [${i}] id=${d.id} titulo=${a.titulo} createdAt=${createdAt}`);
  });

  console.log("\n=== RULE EXPECTATION ===");
  console.log('Para morador ler: doc membros/{uid} precisa existir e status == "ATIVO".');
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
