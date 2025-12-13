// scripts/setAdmin.cjs
const admin = require('firebase-admin');

// Verifica se o serviceAccountKey.json existe antes de tentar carregar
let serviceAccount;
try {
  serviceAccount = require('../serviceAccountKey.json');
} catch (error) {
  console.error(
    'Erro: O arquivo "serviceAccountKey.json" não foi encontrado na raiz do projeto.'
  );
  console.error(
    'Por favor, baixe-o do seu projeto Firebase e coloque-o na raiz do diretório.'
  );
  process.exit(1); // Encerra o script se a chave não for encontrada
}

// Inicializa o app do Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const firestore = admin.firestore();
const superAdminUid = 'p0XWt3ed7VgiEjHoItfmNq31cT62';

async function setupInitialData() {
  try {
    // 1. Setar a custom claim de super_admin
    await auth.setCustomUserClaims(superAdminUid, { super_admin: true });
    console.log(
      `[ETAPA 1/5] Sucesso: Custom claim { super_admin: true } definida para o usuário ${superAdminUid}`
    );

    // 2. Criar o condomínio inicial
    const condominioData = {
      nome: 'Condomínio Inicial',
      cnpj: '00.000.000/0001-00',
      cep: '00000-000',
      ativo: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: superAdminUid,
    };
    const condominioRef = await firestore
      .collection('condominios')
      .add(condominioData);
    const condominioId = condominioRef.id;
    console.log(
      `[ETAPA 2/5] Sucesso: Condomínio inicial criado com ID: ${condominioId}`
    );

    // 3. Criar o vínculo na subcoleção de membros do condomínio
    const membroData = {
      role: 'SINDICO',
      status: 'ATIVO',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: superAdminUid,
    };
    await firestore
      .collection('condominios')
      .doc(condominioId)
      .collection('membros')
      .doc(superAdminUid)
      .set(membroData);
    console.log(
      `[ETAPA 3/5] Sucesso: Usuário ${superAdminUid} definido como SINDICO ATIVO no condomínio ${condominioId}`
    );

    // 4. Criar o índice de consulta rápida na coleção userCondominios
    const vinculoData = {
      condominioId: condominioId,
      condominioNome: condominioData.nome,
      role: membroData.role,
      status: membroData.status,
    };
    await firestore
      .collection('userCondominios')
      .doc(superAdminUid)
      .collection('vinculos')
      .doc(condominioId)
      .set(vinculoData);
    console.log(
      `[ETAPA 4/5] Sucesso: Índice de vínculo criado para o usuário ${superAdminUid} e condomínio ${condominioId}`
    );

    console.log(
      '\n[ETAPA 5/5] ✅ Configuração inicial concluída com sucesso!'
    );
    console.log(
      `\n➡️  O usuário ${superAdminUid} agora é um SUPER ADMIN e SÍNDICO do 'Condomínio Inicial'.`
    );
  } catch (error) {
    console.error('❌ Erro durante a execução do script de setup:', error);
    process.exit(1);
  }
}

setupInitialData();
