const admin = require("firebase-admin");

// Inicializa o Admin com as credenciais padrão do projeto (Cloud / Firebase Studio)
if (!admin.apps.length) {
  admin.initializeApp();
}

// UID do super admin (treecommunity@treetechautomation.com)
const SUPER_ADMIN_UID = "p0XWt3ed7VgiEjHoItfmNq31cT62";

async function main() {
  try {
    const auth = admin.auth();

    // Busca o usuário atual para preservar claims que já existirem
    const user = await auth.getUser(SUPER_ADMIN_UID);
    const currentClaims = user.customClaims || {};

    const newClaims = {
      ...currentClaims,
      super_admin: true,
    };

    await auth.setCustomUserClaims(SUPER_ADMIN_UID, newClaims);

    console.log("✅ Custom claims atualizadas com sucesso!");
    console.log("UID:", SUPER_ADMIN_UID);
    console.log("Claims:", newClaims);
  } catch (err) {
    console.error("❌ Erro ao atualizar custom claims:");
    console.error(err);
    process.exit(1);
  }
}

main();
