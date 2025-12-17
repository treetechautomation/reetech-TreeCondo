const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error("ERRO: serviceAccountKey.json não encontrado na raiz do projeto.");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
}
const db = admin.firestore();

const condominioId = "chacara-itaguai";
const UID_SUPER_ADMIN = "p0XWt3ed7VgiEjHoItfmNq31cT62";
const UID_ADMIN_CONDOMINIO = "UID_ADMIN";
const UID_SINDICO_DALIAS = "UID_SINDICO_DALIAS";
const UID_SINDICO_ROSAS = "UID_SINDICO_ROSAS";

function nowISO() { return new Date().toISOString(); }

async function upsertMembro(uid, role, scope) {
  await db.doc(`condominios/${condominioId}/membros/${uid}`).set({
    uid,
    role,
    ativo: true,
    scope,
    createdAt: nowISO(),
    createdBy: UID_SUPER_ADMIN,
  }, { merge: true });
}

async function upsertRamal(blocoId, docId, data) {
  await db.doc(`condominios/${condominioId}/blocos/${blocoId}/ramais/${docId}`).set({
    ...data,
    ativo: true,
    createdAt: nowISO(),
    createdBy: UID_ADMIN_CONDOMINIO,
  }, { merge: true });
}

(async () => {
  const batch = db.batch();

  // 1) Corrigir membros no formato que o verify espera
  const adminCondoRef = db.doc(`condominios/${condominioId}/membros/${UID_ADMIN_CONDOMINIO}`);
  batch.set(adminCondoRef, {
    uid: UID_ADMIN_CONDOMINIO,
    role: "ADMIN_CONDOMINIO",
    ativo: true,
    scope: { type: "CONDOMINIO", condominioId },
    createdAt: nowISO(),
    createdBy: UID_SUPER_ADMIN,
  }, { merge: true });

  const sindicoDaliasRef = db.doc(`condominios/${condominioId}/membros/${UID_SINDICO_DALIAS}`);
  batch.set(sindicoDaliasRef, {
    uid: UID_SINDICO_DALIAS,
    role: "SINDICO",
    ativo: true,
    scope: { type: "BLOCO", condominioId, blocoId: "dalias" },
    createdAt: nowISO(),
    createdBy: UID_ADMIN_CONDOMINIO,
  }, { merge: true });

  const sindicoRosasRef = db.doc(`condominios/${condominioId}/membros/${UID_SINDICO_ROSAS}`);
  batch.set(sindicoRosasRef, {
    uid: UID_SINDICO_ROSAS,
    role: "SINDICO",
    ativo: true,
scope: { type: "BLOCO", condominioId, blocoId: "rosas" },
    createdAt: nowISO(),
    createdBy: UID_ADMIN_CONDOMINIO,
  }, { merge: true });
  
  console.log("-> Membros preparados para correção.");

  // 2) Criar 3+ ramais válidos por bloco
  const ramaisDalias = [
    { id: "guarita-dalias", data: { area: "Guarita", ramal: "101" } },
    { id: "clube-dalias",   data: { area: "Clube",   ramal: "102" } },
    { id: "zelador-dalias", data: { area: "Zelador", ramal: "103" } },
  ];
  ramaisDalias.forEach(r => {
    const ref = db.doc(`condominios/${condominioId}/blocos/dalias/ramais/${r.id}`);
    batch.set(ref, { ...r.data, ativo: true, createdAt: nowISO(), createdBy: UID_ADMIN_CONDOMINIO }, { merge: true });
  });

  const ramaisRosas = [
    { id: "guarita-rosas", data: { area: "Guarita", ramal: "201" } },
    { id: "clube-rosas",   data: { area: "Clube",   ramal: "202" } },
    { id: "zelador-rosas", data: { area: "Zelador", ramal: "203" } },
  ];
  ramaisRosas.forEach(r => {
    const ref = db.doc(`condominios/${condominioId}/blocos/rosas/ramais/${r.id}`);
    batch.set(ref, { ...r.data, ativo: true, createdAt: nowISO(), createdBy: UID_ADMIN_CONDOMINIO }, { merge: true });
  });

  console.log("-> Ramais preparados para correção.");

  await batch.commit();

  console.log("\n✅ FIX OK: membros e ramais ajustados no padrão do verify.");
  console.log("👉 Próximo passo: rode `npm run sync` e depois `npm run verify` novamente.");
})();
