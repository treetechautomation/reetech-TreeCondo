/**
 * Uso:
 *   node scripts/cleanup-orphan-vinculos.cjs <UID>
 *
 * Remove userCondominios/{uid}/vinculos/{condominioId} quando o doc condominios/{condominioId} não existe.
 * Mantém o vínculo "GLOBAL".
 */
const admin = require("firebase-admin");

async function main() {
  const [uid] = process.argv.slice(2);
  if (!uid) {
    console.error("Uso: node scripts/cleanup-orphan-vinculos.cjs <UID>");
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }

  const db = admin.firestore();

  const vinculosRef = db.collection(`userCondominios/${uid}/vinculos`);
  const snap = await vinculosRef.get();

  if (snap.empty) {
    console.log("Nenhum vínculo encontrado para:", uid);
    return;
  }

  let removed = 0;
  for (const d of snap.docs) {
    const id = d.id;

    if (id === "GLOBAL") continue;

    const condoRef = db.doc(`condominios/${id}`);
    const condoSnap = await condoRef.get();

    if (!condoSnap.exists) {
      await d.ref.delete();
      removed++;
      console.log("REMOVIDO vínculo órfão:", d.ref.path);
    }
  }

  console.log("Fim. Removidos:", removed);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
