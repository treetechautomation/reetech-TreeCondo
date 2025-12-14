// Use CommonJS syntax
const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid"); // To generate unique IDs if needed

// Path to your service account key file
const serviceAccount = require("../serviceAccountKey.json");

// The UID of the user to make a super admin
const SUPER_ADMIN_UID = "p0XWt3ed7VgiEjHoItfmNq31cT62";

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function setupInitialData() {
  console.log(`Iniciando o setup para o UID: ${SUPER_ADMIN_UID}...`);

  try {
    // 1. Set custom claim for super admin
    await admin.auth().setCustomUserClaims(SUPER_ADMIN_UID, { super_admin: true });
    console.log(`[OK] Custom claim 'super_admin: true' setada para o usuário ${SUPER_ADMIN_UID}.`);

    // 2. Create the initial condominium
    const condominioData = {
      nome: "Condomínio Inicial de Testes",
      ativo: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: SUPER_ADMIN_UID,
    };
    const condominioRef = await db.collection("condominios").add(condominioData);
    const condominioId = condominioRef.id;
    console.log(`[OK] Condomínio criado com sucesso. ID: ${condominioId}`);

    // 3. Create Blocks
    const blocosParaCriar = [
      { nome: "Bloco A", ordem: 1 },
      { nome: "Bloco B", ordem: 2 },
    ];
    const blocosIds = [];
    
    for (const bloco of blocosParaCriar) {
        const blocoRef = await db.collection(`condominios/${condominioId}/blocos`).add({
            ...bloco,
            ativo: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        blocosIds.push({ nome: bloco.nome, id: blocoRef.id });
    }
    console.log("[OK] Blocos criados:", blocosIds.map(b => `${b.nome} (ID: ${b.id})`).join(", "));

    // 4. Create Units in Bloco A
    const blocoA = blocosIds.find(b => b.nome === "Bloco A");
    const unidadesParaCriar = [
        { numero: "101", andar: 1 },
        { numero: "102", andar: 1 },
        { numero: "201", andar: 2 },
        { numero: "202", andar: 2 },
    ];
    const unidadesIds = [];

    if (blocoA) {
        for (const unidade of unidadesParaCriar) {
            const unidadeRef = await db.collection(`condominios/${condominioId}/blocos/${blocoA.id}/unidades`).add({
                ...unidade,
                tipo: "APARTAMENTO",
                ativo: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            unidadesIds.push({ numero: unidade.numero, id: unidadeRef.id });
        }
        console.log("[OK] Unidades criadas no Bloco A:", unidadesIds.map(u => `Unidade ${u.numero} (ID: ${u.id})`).join(", "));
    }


    // 5. Create the super admin as a member (Síndico)
    const membroData = {
      role: "SINDICO",
      status: "ATIVO",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: SUPER_ADMIN_UID, // The super admin created their own membership
    };
    await db.doc(`condominios/${condominioId}/membros/${SUPER_ADMIN_UID}`).set(membroData);
    console.log(`[OK] Super admin adicionado como SINDICO no condomínio ${condominioId}.`);

    // 6. Create the user's quick access link (vinculo)
    const vinculoData = {
      condominioId: condominioId,
      condominioNome: condominioData.nome,
      role: "SINDICO",
      status: "ATIVO",
      // blocoId and unidadeId are null because SINDICO is not tied to a specific unit
    };
    await db.doc(`userCondominios/${SUPER_ADMIN_UID}/vinculos/${condominioId}`).set(vinculoData);
    console.log(`[OK] Vínculo de acesso rápido criado para o super admin.`);
    
    console.log("\n--- Resumo ---");
    console.log("Condominio ID:", condominioId);
    console.log("Blocos IDs:", blocosIds);
    console.log("Unidades IDs (Bloco A):", unidadesIds);
    console.log("\nSetup concluído com sucesso!");

  } catch (error) {
    console.error("Ocorreu um erro durante o setup:", error);
    process.exit(1);
  }
}

setupInitialData();
