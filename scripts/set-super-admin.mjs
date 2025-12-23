import admin from "firebase-admin";
import fs from "node:fs";

function initAdmin() {
  // 1) Se você tiver GOOGLE_APPLICATION_CREDENTIALS apontando pra um JSON, usa isso
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    const json = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
    admin.initializeApp({ credential: admin.credential.cert(json) });
    return;
  }

  // 2) Se você tiver um serviceAccount.json em ./serviceAccount.json
  if (fs.existsSync("./serviceAccount.json")) {
    const json = JSON.parse(fs.readFileSync("./serviceAccount.json", "utf8"));
    admin.initializeApp({ credential: admin.credential.cert(json) });
    return;
  }

  throw new Error(
    "Sem credencial do Admin SDK. Defina GOOGLE_APPLICATION_CREDENTIALS ou coloque ./serviceAccount.json"
  );
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.log("Uso: node scripts/set-super-admin.mjs EMAIL");
    process.exit(1);
  }

  initAdmin();

  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { super_admin: true });

  console.log("OK ✅ super_admin=true setado para:");
  console.log("email:", user.email);
  console.log("uid:", user.uid);
}

main().catch((e) => {
  console.error("ERRO:", e?.message || e);
  process.exit(1);
});
