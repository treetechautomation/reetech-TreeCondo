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

const needle = 'importScripts("/firebase-messaging-sw.js");\n';
if (s.includes('importScripts("/firebase-messaging-sw.js")')) {
  console.log("ℹ️ Já estava aplicado:", p);
  process.exit(0);
}

s = needle + s;
fs.writeFileSync(p, s, "utf8");
console.log("✅ Injetado no topo:", needle.trim());
console.log("✅ OK:", p);
