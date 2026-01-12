import admin from "firebase-admin";
import fs from "node:fs";

const [condId, uid] = process.argv.slice(2);

if (!condId || !uid) {
  console.log("USO: node scripts/promote-to-admin.mjs <COND_ID> <UID>");
  process.exit(1);
}

if (!admin.apps.length) {
  const sa = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

const membroRef = db.doc(`condominios/${condId}/membros/${uid}`);
const membroSnap = await membroRef.get();

if (!membroSnap.exists) {
  console.error(`❌ membro não existe: condominios/${condId}/membros/${uid}`);
  process.exit(1);
}

const membro = membroSnap.data() || {};
const email = (membro.email || "").toString();
const nome = (membro.nome || membro.displayName || "").toString();
const blocoId = membro.blocoId ?? null;
const unidadeId = membro.unidadeId ?? null;

if (!email) {
  console.error("❌ membro sem email no doc. Preencha o campo email em membros/<uid>.");
  process.exit(1);
}

// 1) Atualiza papel no doc de membro
await membroRef.set(
  {
    role: "ADMIN",
    status: "ATIVO",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  { merge: true }
);

// 2) Garante userCondominios/<uid>
const userRef = db.doc(`userCondominios/${uid}`);
await userRef.set(
  {
    uid,
    email,
    displayName: nome || null,
    source: "promote-to-admin",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  { merge: true }
);

// 3) Garante userCondominios/<uid>/vinculos/<condId>
const vincRef = db.doc(`userCondominios/${uid}/vinculos/${condId}`);
await vincRef.set(
  {
    condominioId: condId,
    role: "ADMIN",
    blocoId,
    unidadeId,
    status: "ATIVO",
    email,
    source: "promote-to-admin",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  { merge: true }
);

console.log("✅ OK: promovido para ADMIN e vínculo sincronizado");
console.log({ condominioId: condId, uid, email, blocoId, unidadeId, role: "ADMIN" });
