const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

(async () => {
  admin.initializeApp(); // ADC via gcloud auth
  const db = admin.firestore();

  const uid = "jwKN3922JKdy7r07ttm5cYEAO8i1";
  const condId = "RtJ7G92QwWvJ13Qq8Ntx";

  const userRef = db.collection("users").doc(uid);
  const membroRef = db.collection("condominios").doc(condId).collection("membros").doc(uid);

  const [userSnap, membroSnap] = await Promise.all([userRef.get(), membroRef.get()]);
  if (!membroSnap.exists) {
    console.error("❌ membro não existe em condominios/{condId}/membros/{uid}");
    process.exit(1);
  }

  const m = membroSnap.data() || {};
  const role = String(m.role || m.tipo || "MORADOR").toUpperCase();

  // tenta capturar ids comuns (ajusta conforme seu schema)
  const blocoId =
    m.blocoIdNorm ?? m.blocoId ?? m.bloco ?? null;

  const unidadeId =
    m.unidadeIdNorm ?? m.unidadeId ?? m.apartamento ?? null;

  const email = String(m.email || (userSnap.exists ? (userSnap.data() || {}).email : "") || "").toLowerCase();
  const displayName = String(m.nome || (userSnap.exists ? (userSnap.data() || {}).displayName : "") || "");

  const atuais = userSnap.exists ? (userSnap.data() || {}).vinculos : null;
  const vinculos = Array.isArray(atuais) ? atuais.filter(v => v?.condominioId !== condId) : [];

  const novoVinculo = {
    condominioId: condId,
    role,
    blocoId,
    unidadeId,
    status: "ATIVO",
  };

  await userRef.set(
    {
      email,
      displayName,
      // deixe os 2 nomes para garantir compatibilidade caso seu session use um ou outro:
      activeCondominioId: condId,
      condominioAtivoId: condId,
      vinculos: [...vinculos, novoVinculo],
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log("✅ users/{uid} atualizado com vinculo + condominio ativo");
  process.exit(0);
})().catch((e) => {
  console.error("❌ erro:", e);
  process.exit(1);
});
