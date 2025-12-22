/**
 * Uso:
 *   node scripts/link-user-to-condominio.cjs <UID> <CONDOMINIO_ID> "<CONDOMINIO_NOME>" <ROLE>
 *
 * Ex:
 *   node scripts/link-user-to-condominio.cjs p0XW... zoyMX... "Chácara Itaguaí" SUPER_ADMIN
 */
const admin = require("firebase-admin");

async function main() {
  const [uid, condominioId, condominioNome, role] = process.argv.slice(2);

  if (!uid || !condominioId || !condominioNome || !role) {
    console.error('Uso: node scripts/link-user-to-condominio.cjs <UID> <CONDOMINIO_ID> "<CONDOMINIO_NOME>" <ROLE>');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }

  const db = admin.firestore();

  const ref = db.doc(`userCondominios/${uid}/vinculos/${condominioId}`);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const payload = {
    ativo: true,
    condominioId,
    condominioNome,
    role,
    status: "ATIVO",
    scope: condominioId === "GLOBAL"
      ? { type: "GLOBAL" }
      : { type: "CONDOMINIO", condominioId },
    updatedAt: now,
    createdAt: now,
  };

  await ref.set(payload, { merge: true });
  console.log("OK vinculado:", ref.path);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
