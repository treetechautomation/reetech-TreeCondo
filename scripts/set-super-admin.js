import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

async function main() {
  // 🔴 Ajuste o e-mail do super admin se precisar
  const superAdminEmail = "treecommunity@treetechautomation.com";

  // Inicializa o Admin usando as credenciais padrão do projeto (Cloud Shell)
  initializeApp({
    credential: applicationDefault(),
  });

  const auth = getAuth();

  console.log("Procurando usuário com e-mail:", superAdminEmail);

  const user = await auth.getUserByEmail(superAdminEmail);

  console.log("Usuário encontrado, uid:", user.uid);
  console.log("Claims atuais:", user.customClaims || {});

  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    super_admin: true,
  });

  console.log("✅ Claim super_admin: true aplicada com sucesso para:", superAdminEmail);
}

main().catch((err) => {
  console.error("Erro ao definir super_admin:", err);
  process.exit(1);
});
