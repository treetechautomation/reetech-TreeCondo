const { getApps, initializeApp, getApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = "studio-7559545170-41328";

if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(getApp());

(async () => {
  const snap = await db.collection("condominios").limit(10).get();
  console.log("condominios count:", snap.size);
  console.log("ids:", snap.docs.map(d => d.id));
})();
