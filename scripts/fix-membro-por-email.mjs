import admin from "firebase-admin";
import fs from "node:fs";

const [condId, email] = process.argv.slice(2);

if (!condId || !email) {
  console.log("USO: node scripts/fix-membro-por-email.mjs <COND_ID> <EMAIL>");
  process.exit(1);
}

if (!admin.apps.length) {
  const sa = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function main() {
  // 1) pegar UID no Auth
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (e) {
    console.error("❌ Não achei esse email no Firebase Auth:", email);
    throw e;
  }

  const uid = user.uid;
  console.log("✅ Auth user:", { email: user.email, uid });

  const membrosCol = db.collection("condominios").doc(condId).collection("membros");

  // 2) tentar reaproveitar dados do doc órfão (uid == null) se existir
  let orphanData = null;
  let orphanIds = [];

  // Primeiro: procura por uid == null
  const orphanSnap = await membrosCol.where("uid", "==", null).get();
  orphanIds = orphanSnap.docs.map(d => d.id);

  // Se tiver campo email dentro do doc, tenta achar o doc certo por email
  let matchByEmail = null;
  for (const d of orphanSnap.docs) {
    const data = d.data() || {};
    const docEmail = (data.email || data.userEmail || data.mail || "").toString().toLowerCase().trim();
    if (docEmail && docEmail === email.toLowerCase().trim()) {
      matchByEmail = d;
      break;
    }
  }

  if (matchByEmail) {
    orphanData = matchByEmail.data() || null;
    console.log("🔎 Achei doc órfão por email:", matchByEmail.id);
  } else if (orphanSnap.docs[0]) {
    // fallback: pega o primeiro órfão só pra aproveitar role/status/menuPermissions se fizer sentido
    orphanData = orphanSnap.docs[0].data() || null;
    console.log("⚠️ Achei doc(s) órfão(s), mas não consegui bater por email. Vou usar o primeiro para referência:", orphanSnap.docs[0].id);
  } else {
    console.log("ℹ️ Não achei doc órfão (uid == null) neste condomínio.");
  }

  const baseRole =
    orphanData?.role ||
    (email === "treecommunity@treetechautomation.com" ? "SUPER_ADMIN" : "SINDICO");

  const baseStatus = orphanData?.status || "ATIVO";

  const baseMenu = orphanData?.menuPermissions || {};
  const menuPermissions = {
    ...baseMenu,
    anuncios: baseMenu?.anuncios ?? true,
  };

  // 3) escreve o doc correto: docId = uid
  const memberRef = membrosCol.doc(uid);
  await memberRef.set(
    {
      uid,
      email,
      status: baseStatus,
      role: baseRole,
      menuPermissions,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      fixedByScript: "fix-membro-por-email",
      fixedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log("✅ membro corrigido em:", `condominios/${condId}/membros/${uid}`);

  // 4) marca órfãos para limpeza manual posterior (sem apagar nada)
  if (orphanIds.length) {
    console.log("🧹 Marcando docs órfãos (uid == null) como orphaned:true (NÃO apaga):", orphanIds);
    const batch = db.batch();
    for (const id of orphanIds) {
      batch.set(membrosCol.doc(id), { orphaned: true, orphanedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  }

  // 5) mostrar o doc final
  const finalDoc = await memberRef.get();
  console.log("=== DOC FINAL ===");
  console.log(finalDoc.id, finalDoc.data());
}

main().catch((e) => {
  console.error("❌ erro:", e?.message || e);
  process.exit(1);
});
