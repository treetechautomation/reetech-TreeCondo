/* Orquestra: gera firebase-messaging-sw (não patcha sw.js; next-pwa injeta importScripts) */
const { spawnSync } = require("child_process");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("node", ["scripts/gen-firebase-messaging-sw.js"]);


