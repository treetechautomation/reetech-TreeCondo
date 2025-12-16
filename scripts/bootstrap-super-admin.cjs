/**
 * Uso:
 * node scripts/bootstrap-super-admin.cjs p0XWt3ed7VgiEjHoItfmNq31cT62
 *
 * Requer: serviceAccountKey.json na raiz do projeto
 */
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const uid = process.argv[2];
if (!uid) {
  console.error("Informe o UID. Ex: node scripts/bootstrap-super-admin.cjs <UID>");
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
  const user = await admin.auth().getUser(uid);
  const current = user.customClaims || {};
  const next = { ...current, super_admin: true };

  await admin.auth().setCustomUserClaims(uid, next);

  console.log("✅ Super Admin aplicado com sucesso!");
  console.log("UID:", uid);
  console.log("Email:", user.email);
  console.log("Claims:", next);
  console.log("➡️ Agora faça logout/login para renovar o token.");
})();
