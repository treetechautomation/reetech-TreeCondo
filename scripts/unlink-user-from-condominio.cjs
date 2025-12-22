/**
 * Uso:
 *   node scripts/unlink-user-from-condominio.cjs <UID> <CONDOMINIO_ID>
 */
const admin = require("firebase-admin");

async function main() {
  const [uid, condominioId] = process.argv.slice(2);
  if (!uid || !condominioId) {
    console.error("Uso: node scripts/unlink-user-from-condominio.cjs <UID> <CONDOMINIO_ID>");
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }

  const db = admin.firestore();
  const ref = db.doc(`userCondominios/${uid}/vinculos/${condominioId}`);

  const snap = await ref.get();
  if (!snap.exists) {
    console.log("Vínculo não existe:", ref.path);
    return;
  }

  await ref.delete();
  console.log("OK removido:", ref.path);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
