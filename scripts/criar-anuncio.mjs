import admin from "firebase-admin";
import fs from "node:fs";

const condId = process.argv[2];
const titulo = process.argv[3];
const mensagem = process.argv.slice(4).join(" ");

if (!condId || !titulo || !mensagem) {
  console.log('USO: node scripts/criar-anuncio.mjs <COND_ID> "<TITULO>" "<MENSAGEM>"');
  process.exit(1);
}

if (!admin.apps.length) {
  const sa = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

const ref = await db
  .collection("condominios")
  .doc(condId)
  .collection("anuncios")
  .add({
    titulo,
    mensagem,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdByUid: "SCRIPT_ADMIN",
  });

console.log("✅ Anúncio criado!");
console.log("condId:", condId);
console.log("anuncioId:", ref.id);
