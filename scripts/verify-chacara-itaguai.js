const path = require("path");
const admin = require("firebase-admin");
const fs = require("fs");

const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error("ERRO: serviceAccountKey.json não encontrado na raiz do projeto.");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const condominioId = "chacara-itaguai";
const blocos = ["dalias", "rosas"];

function ok(msg) { console.log("✅", msg); }
function fail(msg) { console.log("❌", msg); }

(async () => {
  let hasError = false;

  // 1) Condomínio doc
  const condDoc = await db.doc(`condominios/${condominioId}`).get();
  if (!condDoc.exists) { fail(`Faltando doc condominios/${condominioId}`); hasError = true; }
  else ok(`Existe doc condominios/${condominioId}`);

  // 2) Blocos docs
  for (const blocoId of blocos) {
    const blocoDoc = await db.doc(`condominios/${condominioId}/blocos/${blocoId}`).get();
    if (!blocoDoc.exists) { fail(`Faltando bloco: blocos/${blocoId}`); hasError = true; }
    else ok(`Existe bloco: ${blocoId}`);
  }

  // 3) Membros essenciais
  const membrosBase = `condominios/${condominioId}/membros`;
  const expectedMembros = [
    {
      id: "UID_ADMIN",
      role: "ADMIN_CONDOMINIO",
      scope: { type: "CONDOMINIO", condominioId }
    },
    {
      id: "UID_SINDICO_DALIAS",
      role: "SINDICO",
      scope: { type: "BLOCO", condominioId, blocoId: "dalias" }
    },
    {
      id: "UID_SINDICO_ROSAS",
      role: "SINDICO",
      scope: { type: "BLOCO", condominioId, blocoId: "rosas" }
    }
  ];

  for (const m of expectedMembros) {
    const ref = db.doc(`${membrosBase}/${m.id}`);
    const snap = await ref.get();
    if (!snap.exists) { fail(`Faltando membro: ${ref.path}`); hasError = true; continue; }

    const d = snap.data() || {};
    const problems = [];

    if (d.uid !== m.id) problems.push(`uid esperado "${m.id}", veio "${d.uid}"`);
    if (d.role !== m.role) problems.push(`role esperado "${m.role}", veio "${d.role}"`);
    if (!d.scope || d.scope.type !== m.scope.type) problems.push(`scope.type esperado "${m.scope.type}"`);
    if (!d.scope || d.scope.condominioId !== condominioId) problems.push(`scope.condominioId esperado "${condominioId}"`);
    if (m.scope.type === "BLOCO") {
      if (!d.scope || d.scope.blocoId !== m.scope.blocoId) problems.push(`scope.blocoId esperado "${m.scope.blocoId}"`);
    }
    if (d.ativo !== true) problems.push(`ativo deve ser true`);
    if (!d.createdAt || typeof d.createdAt !== "string") problems.push(`createdAt deve ser string ISO`);

    if (problems.length) {
      fail(`Membro ${m.id} com problemas:\n   - ${problems.join("\n   - ")}`);
      hasError = true;
    } else {
      ok(`Membro ${m.id} OK (${m.role})`);
    }
  }

  // 4) Ramais (mínimo 3 por bloco)
  for (const blocoId of blocos) {
    const ramaisRef = db.collection(`condominios/${condominioId}/blocos/${blocoId}/ramais`);
    const ramaisSnap = await ramaisRef.limit(50).get();

    if (ramaisSnap.empty) {
      fail(`Bloco ${blocoId}: sem ramais em ${ramaisRef.path}`);
      hasError = true;
      continue;
    }

    const count = ramaisSnap.size;
    if (count < 3) {
      fail(`Bloco ${blocoId}: poucos ramais (${count}). Esperado >= 3`);
      hasError = true;
    } else {
      ok(`Bloco ${blocoId}: ${count} ramais encontrados`);
    }

    // valida campos básicos
    for (const doc of ramaisSnap.docs.slice(0, 10)) {
      const r = doc.data() || {};
      const rp = [];
      if (!r.area) rp.push("area faltando");
      if (!r.ramal) rp.push("ramal faltando");
      if (typeof r.ativo !== "boolean") rp.push("ativo deve ser boolean");
      if (!r.createdAt || typeof r.createdAt !== "string") rp.push("createdAt deve ser string ISO");
      if (rp.length) {
        fail(`Ramal inválido (${doc.ref.path}): ${rp.join(", ")}`);
        hasError = true;
      }
    }
  }

  // 5) Vínculos essenciais
  for (const m of expectedMembros) {
      const ref = db.doc(`userCondominios/${m.id}/vinculos/${condominioId}`);
      const snap = await ref.get();
      if (!snap.exists) { fail(`Faltando vínculo: ${ref.path}`); hasError = true; continue; }

      const d = snap.data() || {};
      const problems = [];
      if (d.uid !== m.id) problems.push(`uid esperado "${m.id}", veio "${d.uid}"`);
      if (d.role !== m.role) problems.push(`role esperado "${m.role}", veio "${d.role}"`);
      if (d.condominioId !== condominioId) problems.push(`condominioId esperado "${condominioId}"`);
      if (!d.scope || d.scope.type !== m.scope.type) problems.push(`scope.type esperado "${m.scope.type}"`);
      if (m.scope.type === "BLOCO") {
          if (!d.scope || d.scope.blocoId !== m.scope.blocoId) problems.push(`scope.blocoId esperado "${m.scope.blocoId}"`);
      }
      if (d.ativo !== true) problems.push(`ativo deve ser true`);

      if (problems.length) {
        fail(`Vínculo ${m.id} com problemas:\n   - ${problems.join("\n   - ")}`);
        hasError = true;
      } else {
        ok(`Vínculo ${m.id} OK (${m.role})`);
      }
  }

  console.log("----");
  if (hasError) {
    console.log("❌ VERIFICAÇÃO FALHOU. Ajuste os itens acima.");
    process.exit(2);
  }
  console.log("✅ VERIFICAÇÃO OK. Estrutura do condomínio está no padrão.");
  process.exit(0);
})();
