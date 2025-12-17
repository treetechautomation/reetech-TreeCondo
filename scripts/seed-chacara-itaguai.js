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
  { id: "dalias", nome: "Dálias", ordem: 1 },
  { id: "rosas", nome: "Rosas", ordem: 2 },
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
  console.log(`Iniciando seed para o condomínio: ${condominioId}`);

  // 1) Doc do condomínio
  await db.doc(`condominios/${condominioId}`).set({
    nome: "Chácara Itaguaí",
    ativo: true,
    createdAt: nowISO(),
    createdBy: UID_SUPER_ADMIN,
  }, { merge: true });
  console.log("-> Documento do condomínio criado/atualizado.");

  // 2) Blocos
  for (const b of blocos) {
    await db.doc(`condominios/${condominioId}/blocos/${b.id}`).set({
      nome: b.nome,
      ordem: b.ordem,
      ativo: true,
      createdAt: nowISO(),
      createdBy: UID_SUPER_ADMIN,
    }, { merge: true });

    // 3) Subcoleção ramais (criar pelo menos 1 doc, pra coleção existir)
    await db.doc(`condominios/${condominioId}/blocos/${b.id}/ramais/guarita-${b.id}`).set({
      area: `Guarita (${b.nome})`,
      ramal: b.id === "dalias" ? "100" : "200",
      ativo: true,
      createdAt: nowISO(),
      createdBy: UID_SUPER_ADMIN,
    }, { merge: true });
    console.log(`--> Bloco '${b.nome}' e ramal inicial criados/atualizados.`);
  }

  // 4) Membros (padrão mercado + seu caso: 2 síndicos e 1 admin gerenciando os 2)
  // ADMIN_CONDOMINIO: gerencia o condomínio todo
  await db.doc(`condominios/${condominioId}/membros/${UID_ADMIN_CONDOMINIO}`).set({
    uid: UID_ADMIN_CONDOMINIO,
    role: "ADMIN_CONDOMINIO",
    ativo: true,
    scope: { type: "CONDOMINIO", condominioId: condominioId },
    createdAt: nowISO(),
    createdBy: UID_SUPER_ADMIN,
  }, { merge: true });
  console.log("-> Membro ADMIN_CONDOMINIO criado/atualizado.");

  // SINDICO de cada bloco
  await db.doc(`condominios/${condominioId}/membros/${UID_SINDICO_DALIAS}`).set({
    uid: UID_SINDICO_DALIAS,
    role: "SINDICO",
    ativo: true,
    scope: { type: "BLOCO", condominioId: condominioId, blocoId: "dalias" },
    createdAt: nowISO(),
    createdBy: UID_SUPER_ADMIN,
  }, { merge: true });
  console.log("-> Membro SINDICO (Dálias) criado/atualizado.");

  await db.doc(`condominios/${condominioId}/membros/${UID_SINDICO_ROSAS}`).set({
    uid: UID_SINDICO_ROSAS,
    role: "SINDICO",
    ativo: true,
    scope: { type: "BLOCO", condominioId: condominioId, blocoId: "rosas" },
    createdAt: nowISO(),
    createdBy: UID_SUPER_ADMIN,
  }, { merge: true });
  console.log("-> Membro SINDICO (Rosas) criado/atualizado.");

  console.log("\n✅ SEED OK: condomínio + blocos + ramais + membros criados/atualizados.");
})();
