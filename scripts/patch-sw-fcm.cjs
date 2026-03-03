const fs = require("fs");

const p = "public/sw.js";
if (!fs.existsSync(p)) {
  console.error("❌ Não achei", p, "- rode o build antes.");
  process.exit(1);
}

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const backup = `${p}.bak_postbuild_${ts}`;
fs.copyFileSync(p, backup);
console.log("✅ Backup:", backup);

let s = fs.readFileSync(p, "utf8");

// match das duas variantes (termina com ; ou ,)
const re = /importScripts\("\/firebase-messaging-sw\.js"\)\s*[;,]/g;
const matches = s.match(re) || [];

if (matches.length > 1) {
  // remove todas e recoloca só 1 no lugar certo
  s = s.replace(re, "");
  console.log(`🧹 Removidos duplicados: ${matches.length}x`);
}

if ((s.match(re) || []).length === 1) {
  console.log("ℹ️ Já estava aplicado (1x):", p);
  process.exit(0);
}

const marker = '"use strict";';
const idx = s.indexOf(marker);

if (idx !== -1) {
  const insertPos = idx + marker.length;
  s = s.slice(0, insertPos) + 'importScripts("/firebase-messaging-sw.js");' + s.slice(insertPos);
  fs.writeFileSync(p, s, "utf8");
  console.log("✅ Injetado após:", marker);
  console.log("✅ OK:", p);
  process.exit(0);
}

// fallback topo
s = 'importScripts("/firebase-messaging-sw.js");\n' + s;
fs.writeFileSync(p, s, "utf8");
console.log("⚠️ Marker não encontrado; injetado no topo");
console.log("✅ OK:", p);
