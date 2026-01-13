import admin from "firebase-admin";
import fs from "fs";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    fs.readFileSync("./serviceAccount.json", "utf8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// coloque seu UID aqui
const UID = "COLE_SEU_UID_AQUI";

async function main() {
  const snap = await db
    .collection("userCondominios")
    .doc(UID)
    .collection("vinculos")
    .get();

  console.log("VÍNCULOS:");
  snap.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}

main().then(() => process.exit());
