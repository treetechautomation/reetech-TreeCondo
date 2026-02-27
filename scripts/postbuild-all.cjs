/* Orquestra: gera firebase-messaging-sw e depois patch do sw.js do next-pwa */
const { spawnSync } = require("child_process");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("node", ["scripts/gen-firebase-messaging-sw.js"]);
run("node", ["scripts/patch-sw-fcm.cjs"]);
