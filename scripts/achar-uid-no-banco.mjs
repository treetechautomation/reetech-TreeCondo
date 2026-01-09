import admin from "firebase-admin";
import fs from "node:fs";

const UID = process.argv[2];
const COND_ID = process.argv[3]; // opcional

if (!UID) {
  console.log("USO:");
  console.log("  node scripts/achar-uid-no-banco.mjs <UID> [COND_ID]");
  process.exit(1);
}

if (!admin.apps.length) {
  const sa = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  console.log("=== BUSCA DE UID ===");
  console.log("UID:", UID);

  // users/<uid>
  const u = await db.doc(`users/${UID}`).get();
  console.log("\n1) users/<uid> exists:", u.exists);

  // userCondominios/<uid>
  const uc = await db.doc(`userCondominios/${UID}`).get();
  console.log("2) userCondominios/<uid> exists:", uc.exists);

  // membros/<uid> (caso exista coleção raiz)
  const mRoot = await db.doc(`membros/${UID}`).get();
  console.log("3) membros/<uid> (raiz) exists:", mRoot.exists);

  if (COND_ID) {
    const m = await db.doc(`condominios/${COND_ID}/membros/${UID}`).get();
    console.log(`\n4) condominios/${COND_ID}/membros/${UID} exists:`, m.exists);
    if (m.exists) {
      const d = m.data();
      console.log("   role:", d?.role);
      console.log("   status:", d?.status);
      console.log("   menuPermissions.anuncios:", d?.menuPermissions?.anuncios);
    } else {
      // procurar membro com docId diferente mas campo uid igual
      const q = await db.collection(`condominios/${COND_ID}/membros`).where("uid","==",UID).limit(5).get();
      console.log(`5) query membros where uid==UID count:`, q.size);
      q.forEach(doc => console.log("   - docId:", doc.id));
    }
  }

  console.log("\n=== PRÓXIMO PASSO ===");
  console.log("Se 4) for false e 5) tiver docId diferente, o problema é docId != UID.");
  console.log("Aí a rule não encontra e o morador não lê anúncios.");
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
