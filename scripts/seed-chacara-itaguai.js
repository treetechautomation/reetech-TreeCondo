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
const condominioId = "chacara-itaguai";

const blocos = [
  { id: "dalias", nome: "Dálias", ordem: 1 },
  { id: "rosas", nome: "Rosas", ordem: 2 },
];

const UID_SUPER_ADMIN = "p0XWt3ed7VgiEjHoItfmNq31cT62";

// IDs que serão usados para os membros administrativos
const UID_ADMIN_CONDOMINIO = "UID_ADMIN";
const UID_SINDICO_DALIAS = "UID_SINDICO_DALIAS";
const UID_SINDICO_ROSAS = "UID_SINDICO_ROSAS";

function nowISO() { return new Date().toISOString(); }

(async () => {
  console.log(`Iniciando seed para o condomínio: ${condominioId}`);
  const batch = db.batch();

  // 1) Doc do condomínio
  const condominioRef = db.doc(`condominios/${condominioId}`);
  batch.set(condominioRef, {
    nome: "Chácara Itaguaí",
    ativo: true,
    createdAt: nowISO(),
    createdBy: UID_SUPER_ADMIN,
  }, { merge: true });
  console.log("-> Documento do condomínio preparado.");

  // 2) Blocos e ramais iniciais
  for (const b of blocos) {
    const blocoRef = db.doc(`condominios/${condominioId}/blocos/${b.id}`);
    batch.set(blocoRef, {
      nome: b.nome,
      ordem: b.ordem,
      ativo: true,
      createdAt: nowISO(),
      createdBy: UID_SUPER_ADMIN,
    }, { merge: true });

    const ramalRef = db.doc(`condominios/${condominioId}/blocos/${b.id}/ramais/guarita-${b.id}`);
    batch.set(ramalRef, {
      area: `Guarita (${b.nome})`,
      ramal: b.id === "dalias" ? "100" : "200",
      ativo: true,
      createdAt: nowISO(),
      createdBy: UID_SUPER_ADMIN,
    }, { merge: true });
    console.log(`--> Bloco '${b.nome}' e ramal inicial preparados.`);
  }

  // 3) Membros (Admin do Condomínio e Síndicos por bloco)
  const adminCondoRef = db.doc(`condominios/${condominioId}/membros/${UID_ADMIN_CONDOMINIO}`);
  batch.set(adminCondoRef, {
    uid: UID_ADMIN_CONDOMINIO,
    role: "ADMIN_CONDOMINIO",
    ativo: true,
    scope: { type: "CONDOMINIO", condominioId: condominioId },
    createdAt: nowISO(),
    createdBy: UID_SUPER_ADMIN,
  }, { merge: true });
  console.log("-> Membro ADMIN_CONDOMINIO preparado.");

  const sindicoDaliasRef = db.doc(`condominios/${condominioId}/membros/${UID_SINDICO_DALIAS}`);
  batch.set(sindicoDaliasRef, {
    uid: UID_SINDICO_DALIAS,
    role: "SINDICO",
    ativo: true,
    scope: { type: "BLOCO", condominioId: condominioId, blocoId: "dalias" },
    createdAt: nowISO(),
    createdBy: UID_ADMIN_CONDOMINIO,
  }, { merge: true });
  console.log("-> Membro SINDICO (Dálias) preparado.");

  const sindicoRosasRef = db.doc(`condominios/${condominioId}/membros/${UID_SINDICO_ROSAS}`);
  batch.set(sindicoRosasRef, {
    uid: UID_SINDICO_ROSAS,
    role: "SINDICO",
    ativo: true,
    scope: { type: "BLOCO", condominioId: condominioId, blocoId: "rosas" },
    createdAt: nowISO(),
    createdBy: UID_ADMIN_CONDOMINIO,
  }, { merge: true });
  console.log("-> Membro SINDICO (Rosas) preparado.");

  // Executa todas as operações em um único batch
  await batch.commit();

  console.log("\n✅ SEED OK: Operações concluídas com sucesso.");
  console.log("👉 Próximo passo: rode `npm run sync` para criar os vínculos de acesso.");
})();
