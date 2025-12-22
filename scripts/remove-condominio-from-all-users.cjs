/**
 * Uso:
 *   node scripts/remove-condominio-from-all-users.cjs <CONDOMINIO_ID>
 *
 * Remove userCondominios/{uid}/vinculos/{condominioId} de todos usuários.
 */
const admin = require("firebase-admin");

async function main() {
  const [condominioId] = process.argv.slice(2);
  if (!condominioId) {
    console.error("Uso: node scripts/remove-condominio-from-all-users.cjs <CONDOMINIO_ID>");
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }

  const db = admin.firestore();

  // collectionGroup em "vinculos" e filtra por condominioId
  const snap = await db.collectionGroup("vinculos").where("condominioId", "==", condominioId).get();

  if (snap.empty) {
    console.log("Nenhum vínculo encontrado para:", condominioId);
    return;
  }

  let i = 0;
  for (const d of snap.docs) {
    await d.ref.delete();
    i++;
    if (i % 50 === 0) console.log("Removidos:", i);
  }

  console.log("OK. Total removido:", i);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
