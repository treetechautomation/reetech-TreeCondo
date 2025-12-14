import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Inicializa o app do Firebase Admin apenas uma vez.
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/**
 * Função principal para inspecionar o banco de dados.
 */
async function inspectDatabase() {
  try {
    const condosSnap = await db.collection('condominios').get();
    console.log('CONDOMINIOS:');
    if (condosSnap.empty) {
        console.log('Nenhum condomínio encontrado.');
        return;
    }
    condosSnap.forEach(d => console.log(`- ${d.id}: ${d.data().nome}`));

    // Força a inspeção do primeiro condomínio da lista.
    // Altere aqui se quiser inspecionar um ID específico.
    const condominioId = condosSnap.docs[0]?.id;
    if (!condominioId) {
        console.log('\nNenhum condomínio para detalhar.');
        return;
    }

    const blocosSnap = await db.collection(`condominios/${condominioId}/blocos`).get();
    console.log(`\nBLOCOS do condomínio "${condosSnap.docs[0].data().nome}" (${condominioId}):`);
    if (blocosSnap.empty) {
        console.log('Nenhum bloco encontrado.');
        return;
    }
    blocosSnap.forEach(d => console.log(`- ${d.id}: ${d.data().nome}`));

    const blocoId = blocosSnap.docs[0]?.id;
    if (!blocoId) {
        console.log('\nNenhum bloco para detalhar.');
        return;
    }

    const unidadesSnap = await db.collection(`condominios/${condominioId}/blocos/${blocoId}/unidades`).get();
    console.log(`\nUNIDADES do bloco "${blocosSnap.docs[0].data().nome}" (${blocoId}):`);
    if (unidadesSnap.empty) {
        console.log('Nenhuma unidade encontrada.');
        return;
    }
    unidadesSnap.forEach(d => {
        const data = d.data();
        console.log(`- ${d.id} | Número: ${data.numero}, Ocupação: ${data.ocupacao}`);
    });

  } catch (error) {
    console.error("Erro ao inspecionar o banco de dados:", error);
    process.exit(1);
  }
}

// Executa a função.
inspectDatabase();
