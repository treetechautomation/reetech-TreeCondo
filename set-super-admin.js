const admin = require("firebase-admin");// Usa as credenciais padrão do ambiente (Cloud Shell / Firebase Studio)
admin.initializeApp();

async function main() {
  // TODO: coloque aqui o UID do usuário treecommunity@treetechautomation.com
  const uid = "p0XWt3ed7VgiEjHoItfmNq31cT62";


  await admin.auth().setCustomUserClaims(uid, {
    super_admin: true,
  });

  console.log(`Claims { super_admin: true } gravadas para uid=${uid}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
