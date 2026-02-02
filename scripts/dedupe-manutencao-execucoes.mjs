import admin from "firebase-admin";

function env(name, def = null) {
  const v = process.env[name];
  return (v === undefined || v === "") ? def : v;
}

const CONDO_ID = env("CONDO_ID");
if (!CONDO_ID) throw new Error("Faltou CONDO_ID");

const ROTINA_ID = env("ROTINA_ID"); // opcional
const MONTH = env("MONTH");         // opcional: "YYYY-MM" (recomendado)
const DAY = env("DAY");             // opcional: "YYYY-MM-DD" (mais específico)

const DRY_RUN = env("DRY_RUN", "1") !== "0";
const CONFIRM = env("CONFIRM", "0") === "1";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

// Ajuste do “dia local” para -03:00 (Brasil) pra agrupar corretamente por dia.
const TZ_OFFSET_MIN = Number(env("TZ_OFFSET_MIN", "-180")); // -180 = UTC-3

function isoDayFromDate(d) {
  // Converte para "data local" no offset desejado usando UTC components
  const shifted = new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function startEndFromMonth(yyyyMm) {
  const [y, m] = yyyyMm.split("-").map(Number);
  if (!y || !m) throw new Error("MONTH inválido. Use YYYY-MM");
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  // Reverte do “UTC” para o horário local do TZ_OFFSET no filtro (Timestamp compara em UTC)
  const startAdj = new Date(start.getTime() - TZ_OFFSET_MIN * 60_000);
  const endAdj = new Date(end.getTime() - TZ_OFFSET_MIN * 60_000);
  return { startAdj, endAdj };
}

function startEndFromDay(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  if (!y || !m || !d) throw new Error("DAY inválido. Use YYYY-MM-DD");
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  const startAdj = new Date(start.getTime() - TZ_OFFSET_MIN * 60_000);
  const endAdj = new Date(end.getTime() - TZ_OFFSET_MIN * 60_000);
  return { startAdj, endAdj };
}

async function main() {
  const col = db.collection("condominios").doc(CONDO_ID).collection("manutencaoExecucoes");

  let q = col;

  // Filtrar por rotina (opcional)
  if (ROTINA_ID) q = q.where("rotinaId", "==", ROTINA_ID);

  // Filtrar por período (recomendado)
  if (DAY) {
    const { startAdj, endAdj } = startEndFromDay(DAY);
    q = q.where("dataProgramada", ">=", startAdj).where("dataProgramada", "<", endAdj);
  } else if (MONTH) {
    const { startAdj, endAdj } = startEndFromMonth(MONTH);
    q = q.where("dataProgramada", ">=", startAdj).where("dataProgramada", "<", endAdj);
  }

  const snap = await q.get();

  const docs = snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));

  // Monta grupos por rotinaId + dia + status
  const groups = new Map();

  for (const it of docs) {
    const rotinaId = String(it.rotinaId ?? "");
    const status = String(it.status ?? "").toUpperCase();
    const ts = it.dataProgramada;
    const date = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    if (!rotinaId || !date) continue;

    const isoDay = isoDayFromDate(date);
    const key = `${rotinaId}__${isoDay}__${status}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }

  // Decide o que apagar: em cada grupo, mantém 1 (mais recente por updatedAt/createdAt)
  const toDelete = [];
  const keep = [];

  function tsToMs(v) {
    if (!v) return 0;
    if (typeof v?.toMillis === "function") return v.toMillis();
    if (v instanceof Date) return v.getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    return 0;
  }

  for (const [key, arr] of groups.entries()) {
    if (arr.length <= 1) continue;

    arr.sort((a, b) => {
      const aScore = Math.max(tsToMs(a.updatedAt), tsToMs(a.createdAt));
      const bScore = Math.max(tsToMs(b.updatedAt), tsToMs(b.createdAt));
      return bScore - aScore; // desc
    });

    keep.push({ key, keepId: arr[0].id, total: arr.length });
    for (let i = 1; i < arr.length; i++) toDelete.push(arr[i]);
  }

  console.log("=== RESUMO ===");
  console.log("CONDO_ID:", CONDO_ID);
  console.log("ROTINA_ID:", ROTINA_ID || "(todas)");
  console.log("MONTH:", MONTH || "(sem filtro)");
  console.log("DAY:", DAY || "(sem filtro)");
  console.log("Docs lidos:", docs.length);
  console.log("Grupos duplicados:", keep.length);
  console.log("Docs para apagar:", toDelete.length);

  if (keep.length) {
    console.log("\n=== GRUPOS (mantendo 1 por grupo) ===");
    for (const k of keep.slice(0, 30)) {
      console.log(`- ${k.key} -> manter ${k.keepId} (total ${k.total})`);
    }
    if (keep.length > 30) console.log(`... +${keep.length - 30} grupos`);
  }

  if (toDelete.length) {
    console.log("\n=== EXEMPLOS A APAGAR (até 30) ===");
    for (const d of toDelete.slice(0, 30)) {
      const rotinaId = String(d.rotinaId ?? "");
      const status = String(d.status ?? "");
      const date = d.dataProgramada?.toDate ? d.dataProgramada.toDate() : null;
      const day = date ? isoDayFromDate(date) : "?";
      console.log(`- ${d.id} | rotinaId=${rotinaId} | day=${day} | status=${status}`);
    }
    if (toDelete.length > 30) console.log(`... +${toDelete.length - 30} docs`);
  }

  if (DRY_RUN) {
    console.log("\nDRY_RUN=1 -> nada foi apagado.");
    console.log("Para apagar de verdade, rode com: DRY_RUN=0 CONFIRM=1");
    return;
  }

  if (!CONFIRM) {
    console.log("\nCONFIRM!=1 -> abortando por segurança.");
    console.log("Para apagar de verdade, rode com: DRY_RUN=0 CONFIRM=1");
    return;
  }

  // Apagar em batches de 450 (limite 500 por batch)
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 450) {
    const batch = db.batch();
    const slice = toDelete.slice(i, i + 450);
    for (const d of slice) batch.delete(d.ref);
    await batch.commit();
    deleted += slice.length;
    console.log(`Batch ok: apagados ${deleted}/${toDelete.length}`);
  }

  console.log("\n✅ Concluído! Apagados:", deleted);
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
