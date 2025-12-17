/**
 * Uso:
 * node scripts/bootstrap-super-admin-full.cjs <UID> <EMAIL>
 *
 * Requer: serviceAccountKey.json na raiz do projeto
 */
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const uid = process.argv[2];
const emailArg = process.argv[3];

if (!uid) {
  console.error("Informe o UID. Ex: node scripts/bootstrap-super-admin-full.cjs <UID> <EMAIL>");
  process.exit(1);
}

const saPath = path.resolve(process.cwd(), "serviceAccountKey.json");
if (!fs.existsSync(saPath)) {
  console.error("Não encontrei serviceAccountKey.json na raiz do projeto.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(saPath)),
});

(async () => {
  // 1) Custom claim
  const user = await admin.auth().getUser(uid);
  const current = user.customClaims || {};
  const next = { ...current, super_admin: true };

  await admin.auth().setCustomUserClaims(uid, next);

  // 2) Firestore registro
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const email = user.email || emailArg || null;

  // Registro do usuário (opcional, mas útil)
  await db.doc(`users/${uid}`).set(
    {
      uid,
      email,
      roles: { super_admin: true },
      updatedAt: now,
    },
    { merge: true }
  );

  // Registro de "vínculo" GLOBAL como SUPER_ADMIN (pra ficar documentado)
  await db.doc(`userCondominios/${uid}/vinculos/GLOBAL`).set(
    {
      condominioId: "GLOBAL",
      condominioNome: "GLOBAL",
      role: "SUPER_ADMIN",
      scope: { type: "GLOBAL" },
      ativo: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  console.log("✅ SUPER_ADMIN aplicado e registrado no Firestore!");
  console.log("UID:", uid);
  console.log("Email:", email);
  console.log("Claims:", next);
  console.log("Firestore:");
  console.log(" - users/" + uid);
  console.log(" - userCondominios/" + uid + "/vinculos/GLOBAL");
  console.log("➡️ Agora faça logout/login para renovar o token no app.");
})().catch((e) => {
  console.error("❌ Erro:", e);
  process.exit(1);
});
