const admin = require("firebase-admin");

try {
  admin.app();
} catch (e) {
  admin.initializeApp();
}

const db = admin.firestore();

async function main() {
  // pega o 1º condomínio (ordem por nome)
  const snap = await db.collection("condominios").orderBy("nome").limit(1).get();
  if (snap.empty) {
    console.log("❌ Nenhum documento em 'condominios'. Crie um condomínio primeiro.");
    process.exit(1);
  }

  const cond = snap.docs[0];
  const condominioId = cond.id;
  const nome = cond.get("nome") || cond.id;

  // libera todos os módulos pra todos os perfis
  const modules = {
    painel: { sindico: true, morador: true, porteiro: true },
    anuncios: { sindico: true, morador: true, porteiro: true },
    reservas: { sindico: true, morador: true, porteiro: true },
    reunioes: { sindico: true, morador: true, porteiro: true },
    incidentes: { sindico: true, morador: true, porteiro: true },
    encomendas: { sindico: true, morador: true, porteiro: true },
    documentos: { sindico: true, morador: true, porteiro: true },
    enquetes: { sindico: true, morador: true, porteiro: true },
    acesso: { sindico: true, morador: true, porteiro: true },
    cadastros: { sindico: true, morador: true, porteiro: true },
    condominios: { sindico: true, morador: true, porteiro: true },
    configuracoes: { sindico: true, morador: true, porteiro: true },

    // IMPORTANTE: esse é o menu do Super Admin
    "administrador-global": { sindico: true, morador: true, porteiro: true },
  };

  const ref = db.doc(`condominios/${condominioId}/config/menuPermissions`);
  await ref.set(
    {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: "seed-menu-permissions",
      modules,
    },
    { merge: true }
  );

  console.log("✅ menuPermissions salvo com sucesso!");
  console.log("Condomínio:", nome);
  console.log("condominioId:", condominioId);
}

main().catch((e) => {
  console.error("❌ ERRO:", e);
  process.exit(1);
});
