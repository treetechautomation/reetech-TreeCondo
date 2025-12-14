import admin from 'firebase-admin';
import fs from 'fs';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error("Erro ao ler ou inicializar com o serviceAccountKey.json:", error);
    process.exit(1);
  }
}

const db = admin.firestore();

async function inspectDatabase() {
  try {
    // 1. Listar Condomínios
    const condosSnap = await db.collection('condominios').get();
    if (condosSnap.empty) {
      console.log('Nenhum condomínio encontrado.');
      return;
    }

    console.log('CONDOMÍNIOS:');
    condosSnap.forEach(doc => {
      console.log(`- ID: ${doc.id}, Nome: ${doc.data().nome}`);
    });

    // --- Inspeção detalhada do primeiro condomínio encontrado ---
    // Se quiser forçar um condomínio específico, troque o ID aqui:
    const primeiroCondominioDoc = condosSnap.docs[0];
    const condominioId = primeiroCondominioDoc.id;
    console.log(`\n--- Inspecionando detalhes do condomínio: ${primeiroCondominioDoc.data().nome} (ID: ${condominioId}) ---`);

    // 2. Listar Blocos
    const blocosSnap = await db.collection(`condominios/${condominioId}/blocos`).get();
    if (blocosSnap.empty) {
      console.log('\nNenhum bloco encontrado para este condomínio.');
      return;
    }

    console.log('\nBLOCOS:');
    blocosSnap.forEach(doc => {
      console.log(`- ID: ${doc.id}, Nome: ${doc.data().nome}`);
    });

    // 3. Listar Unidades do primeiro bloco
    const primeiroBlocoDoc = blocosSnap.docs[0];
    const blocoId = primeiroBlocoDoc.id;

    if (!blocoId) {
        return;
    }

    const unidadesSnap = await db.collection(`condominios/${condominioId}/blocos/${blocoId}/unidades`).get();
    if (unidadesSnap.empty) {
        console.log(`\nNenhuma unidade encontrada para o bloco ${primeiroBlocoDoc.data().nome}.`);
        return;
    }

    console.log(`\nUNIDADES do bloco "${primeiroBlocoDoc.data().nome}":`);
    unidadesSnap.forEach(doc => {
      const { numero, ocupacao } = doc.data();
      console.log(`- ID: ${doc.id}, Número: ${numero}, Ocupação: ${ocupacao}`);
    });

  } catch (error) {
    console.error("\nOcorreu um erro durante a inspeção:", error);
  }
}

inspectDatabase();
