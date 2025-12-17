const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

/**
 * Uso:
 * node scripts/link-user-to-condominio.cjs <UID> <CONDOMINIO_ID> "<CONDOMINIO_NOME>" <ROLE>
 */

const uid = process.argv[2];
const condominioId = process.argv[3];
const condominioNome = process.argv[4];
const role = process.argv[5] || "SINDICO";

if (!uid || !condominioId || !condominioNome) {
  console.error('Uso correto: node scripts/link-user-to-condominio.cjs <UID> <CONDOMINIO_ID> "<CONDOMINIO_NOME>" <ROLE>');
  process.exit(1);
}

const serviceAccountPath = path.resolve(process.cwd(), "serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Arquivo serviceAccountKey.json NÃO encontrado na raiz do projeto.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
});

(async () => {
  try {
    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const vinculoRef = db.doc(`userCondominios/${uid}/vinculos/${condominioId}`);

    await vinculoRef.set(
      {
        ativo: true,
        condominioId,
        condominioNome,
        role,
        status: "ATIVO",
        scope: {
          type: role === "SUPER_ADMIN" ? "GLOBAL" : "CONDOMINIO",
          condominioId,
        },
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    console.log("✅ VÍNCULO CRIADO / ATUALIZADO COM SUCESSO");
    console.log("👤 UID:", uid);
    console.log("🏢 Condomínio:", condominioNome);
    console.log("🔐 Role:", role);
  } catch (err) {
    console.error("❌ Erro ao criar vínculo:", err);
    process.exit(1);
  }
})();
