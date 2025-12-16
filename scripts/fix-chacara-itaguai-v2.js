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
    createdBy: UID_SUPER_ADMIN,
  }, { merge: true });
}

(async () => {
  // ✅ 1) Corrigir membros no formato que o verify espera
  await upsertMembro(UID_ADMIN_CONDOMINIO, "ADMIN_CONDOMINIO", {
    type: "CONDOMINIO",
    condominioId,
  });

  await upsertMembro(UID_SINDICO_DALIAS, "SINDICO", {
    type: "BLOCO",
    condominioId,
    blocoId: "dalias",
  });

  await upsertMembro(UID_SINDICO_ROSAS, "SINDICO", {
    type: "BLOCO",
    condominioId,
    blocoId: "rosas",
  });

  // ✅ 2) Criar 3+ ramais válidos por bloco (com area/ramal/ativo)
  // DÁLIAS
  await upsertRamal("dalias", "guarita-dalias", { area: "GUARITA", ramal: "101", nome: "Guarita Dálias" });
  await upsertRamal("dalias", "clube-dalias",   { area: "CLUBE",   ramal: "102", nome: "Clube (Dálias)" });
  await upsertRamal("dalias", "zelador-dalias", { area: "ZELADOR", ramal: "103", nome: "Zelador (Dálias)" });

  // ROSAS
  await upsertRamal("rosas", "guarita-rosas", { area: "GUARITA", ramal: "201", nome: "Guarita Rosas" });
  await upsertRamal("rosas", "clube-rosas",   { area: "CLUBE",   ramal: "202", nome: "Clube (Rosas)" });
  await upsertRamal("rosas", "zelador-rosas", { area: "ZELADOR", ramal: "203", nome: "Zelador (Rosas)" });

  console.log("✅ FIX OK: membros e ramais ajustados no padrão do verify.");
})();
