// Use CommonJS 'require' para compatibilidade com execução direta via node.
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- CONFIGURAÇÃO ---
// Pegue o email a partir do argumento da linha de comando
const userEmail = process.argv[2];

if (!userEmail) {
  console.error('❌ Erro: Forneça um email como argumento.');
  console.log('   Exemplo: node scripts/setAdmin.cjs seu_email@exemplo.com');
  process.exit(1);
}

// Verifique se o serviceAccountKey.json existe
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ ERRO CRÍTICO: O arquivo "serviceAccountKey.json" não foi encontrado na raiz do projeto.');
  console.error('   Por favor, baixe a chave de serviço do seu projeto Firebase e coloque-a na raiz.');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// --- INICIALIZAÇÃO DO FIREBASE ADMIN ---
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (e) {
  console.error('❌ Erro ao inicializar o Firebase Admin. Verifique se o serviceAccountKey.json está correto.', e);
  process.exit(1);
}

// --- LÓGICA PRINCIPAL ---
(async () => {
  try {
    console.log(`Procurando usuário com o email: ${userEmail}...`);
    const user = await admin.auth().getUserByEmail(userEmail);
    
    // Define a custom claim 'super_admin' como true
    await admin.auth().setCustomUserClaims(user.uid, { super_admin: true });

    console.log('✅ Sucesso!');
    console.log(`   O usuário ${userEmail} (UID: ${user.uid}) agora é um Super Admin.`);
    console.log('\n   IMPORTANTE: Faça logout e login novamente na aplicação para que as novas permissões tenham efeito.');

    process.exit(0);

  } catch (error) {
    console.error('❌ Falha ao definir permissão de Super Admin.');
    if (error.code === 'auth/user-not-found') {
      console.error(`   Nenhum usuário encontrado com o email: ${userEmail}`);
    } else {
      console.error('   Erro:', error.message);
    }
    process.exit(1);
  }
})();
