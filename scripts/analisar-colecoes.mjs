import admin from "firebase-admin";
import fs from "node:fs";

if (!admin.apps.length) {
  const sa = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function countCol(colPath, limit = 2000) {
  // Firestore Admin não tem count() simples em todas configs; então fazemos amostragem por pages
  const col = db.collection(colPath);
  let last = null;
  let total = 0;
  while (true) {
    let q = col.orderBy(admin.firestore.FieldPath.documentId()).limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    total += snap.size;
    if (snap.size < 500) break;
    last = snap.docs[snap.docs.length - 1].id;
    if (total >= limit) break;
  }
  return total;
}

async function main() {
  const root = ["condominios", "condominiosPublicos", "convites", "userCondominios", "users"];

  console.log("=== COLEÇÕES RAIZ ===");
  for (const c of root) {
    const n = await countCol(c, 999999);
    console.log(`- ${c}: ~${n}`);
  }

  // pega 1 condominio exemplo
  const condSnap = await db.collection("condominios").limit(1).get();
  if (condSnap.empty) {
    console.log("\nNenhum condomínio encontrado em /condominios");
    return;
  }

  const condId = condSnap.docs[0].id;
  const condData = condSnap.docs[0].data();
  console.log("\n=== EXEMPLO DE CONDOMÍNIO ===");
  console.log("condId:", condId);
  console.log("nome:", condData?.nome ?? "(sem nome)");

  const subs = ["anuncios", "blocos", "config", "membros"];
  console.log("\n=== SUBCOLEÇÕES DESSE CONDOMÍNIO ===");
  for (const s of subs) {
    const path = `condominios/${condId}/${s}`;
    const n = await countCol(path, 999999);
    console.log(`- ${path}: ~${n}`);
  }

  console.log("\n✅ Dica: rode o próximo script com um UID real para achar onde o membro está.");
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
