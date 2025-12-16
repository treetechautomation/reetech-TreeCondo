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

// ✅ IDs fixos e “padrão mercado”
// condomínio
const condominioId = "chacara-itaguai";

// blocos
const blocos = [
  { id: "dalias", nome: "Dálias" },
  { id: "rosas", nome: "Rosas" },
];

// ✅ UIDs (troque se quiser depois)
// Você já tem este super admin:
const UID_SUPER_ADMIN = "p0XWt3ed7VgiEjHoItfmNq31cT62";

// Por enquanto vamos usar placeholders pro script passar.
// Se você já tiver os UIDs reais do admin e dos síndicos, substitua aqui.
const UID_ADMIN_CONDOMINIO = "UID_ADMIN";
const UID_SINDICO_DALIAS = "UID_SINDICO_DALIAS";
const UID_SINDICO_ROSAS = "UID_SINDICO_ROSAS";

function nowISO() { return new Date().toISOString(); }

(async () => {
  // 1) Doc do condomínio
  await db.doc(`condominios/${condominioId}`).set({
    nome: "Chácara Itaguaí",
    slug: "chacara-itaguai",
    status: "ATIVO",
    createdAt: nowISO(),
    createdBy: UID_SUPER_ADMIN,
  }, { merge: true });

  // 2) Blocos
  for (const b of blocos) {
    await db.doc(`condominios/${condominioId}/blocos/${b.id}`).set({
      nome: b.nome,
      blocoId: b.id,
      status: "ATIVO",
      createdAt: nowISO(),
      createdBy: UID_SUPER_ADMIN,
    }, { merge: true });

    // 3) Subcoleção ramais (criar pelo menos 1 doc, pra coleção existir)
    await db.doc(`condominios/${condominioId}/blocos/${b.id}/ramais/guarita-${b.id}`).set({
      nome: `Guarita (${b.nome})`,
      numero: b.id === "dalias" ? "100" : "200",
      tipo: "GUARITA",
      createdAt: nowISO(),
      createdBy: UID_SUPER_ADMIN,
    }, { merge: true });
  }

  // 4) Membros (padrão mercado + seu caso: 2 síndicos e 1 admin gerenciando os 2)
  // ADMIN_CONDOMINIO: gerencia o condomínio todo
  await db.doc(`condominios/${condominioId}/membros/${UID_ADMIN_CONDOMINIO}`).set({
    role: "ADMIN_CONDOMINIO",
    status: "ATIVO",
    blocoId: null,
    createdAt: nowISO(),
    createdBy: UID_SUPER_ADMIN,
  }, { merge: true });

  // SINDICO de cada bloco
  await db.doc(`condominios/${condominioId}/membros/${UID_SINDICO_DALIAS}`).set({
    role: "SINDICO",
    status: "ATIVO",
    blocoId: "dalias",
    createdAt: nowISO(),
    createdBy: UID_SUPER_ADMIN,
  }, { merge: true });

  await db.doc(`condominios/${condominioId}/membros/${UID_SINDICO_ROSAS}`).set({
    role: "SINDICO",
    status: "ATIVO",
    blocoId: "rosas",
    createdAt: nowISO(),
    createdBy: UID_SUPER_ADMIN,
  }, { merge: true });

  console.log("✅ SEED OK: condomínio + blocos + ramais + membros criados/atualizados.");
})();
