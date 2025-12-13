// scripts/setAdmin.cjs
const admin = require("firebase-admin");
const path = require("path");

// coloque o arquivo JSON baixado aqui na raiz do projeto com o nome abaixo
try {
  const serviceAccount = require(path.resolve(process.cwd(), "serviceAccountKey.json"));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  async function main() {
    const uid = "p0XWt3ed7VgiEjHoItfmNq31cT62"; // SEU UID (admin global)

    await admin.auth().setCustomUserClaims(uid, { super_admin: true });

    const user = await admin.auth().getUser(uid);
    console.log("✅ Claims atualizadas:", user.customClaims);
    console.log("✅ UID:", user.uid, "Email:", user.email);
  }

  main().catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  });

} catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
        console.error("❌ Erro: O arquivo 'serviceAccountKey.json' não foi encontrado na raiz do projeto.");
        console.error("Por favor, baixe o arquivo da chave de serviço do seu console do Firebase e salve-o como 'serviceAccountKey.json' na raiz do projeto.");
    } else {
        console.error("❌ Ocorreu um erro inesperado:", error);
    }
    process.exit(1);
}
