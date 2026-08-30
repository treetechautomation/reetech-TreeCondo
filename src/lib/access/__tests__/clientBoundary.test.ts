/**
 * ACCESS.5 §45/§46 — guarda estático: nenhum arquivo client-facing deste
 * gate pode importar módulos server-only, nem logar credenciais brutas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Só considera linhas de import/require reais — nunca menções em comentários/docstrings.
const IMPORT_LINE_RE = /^\s*import[^\n]*from\s+["'][^"']+["']|^\s*const[^\n]*require\(["'][^"']+["']\)/gm;
const FORBIDDEN_MODULE_RE = /node:crypto|^crypto$|firebase-admin|firebaseAdmin|authorizationService|hmacKey|pinIssuance|unitResolution/;
const FORBIDDEN_RAW_SECRET_LOG = /console\.(log|error|warn|info|debug)\([^)]*(qrToken|\bpin\b|credential)/i;
const STORAGE_USAGE_RE = /\b(window\.)?(localStorage|sessionStorage)\.(setItem|getItem|removeItem)|indexedDB\.open/;

const CLIENT_FILES = [
  "src/lib/access/uiClient.ts",
  "src/lib/access/uiLabels.ts",
  "src/lib/access/uiFormat.ts",
  "src/lib/access/uiErrors.ts",
  "src/app/acessos/page.tsx",
];

for (const relPath of CLIENT_FILES) {
  test(`${relPath}: no server-only imports`, () => {
    const src = fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
    const importLines = src.match(IMPORT_LINE_RE) || [];
    for (const line of importLines) {
      assert.doesNotMatch(line, FORBIDDEN_MODULE_RE);
    }
  });

  test(`${relPath}: no raw credential logging`, () => {
    const src = fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
    assert.doesNotMatch(src, FORBIDDEN_RAW_SECRET_LOG);
  });

  test(`${relPath}: no localStorage/sessionStorage/IndexedDB usage (credential must stay in-memory only)`, () => {
    const src = fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
    assert.doesNotMatch(src, STORAGE_USAGE_RE);
  });
}

test("page.tsx: QR payload passed to QRCode.toDataURL is the raw token alone, not a JSON/object payload", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "src/app/acessos/page.tsx"), "utf8");
  // A geração do QR deve chamar QRCode.toDataURL(result.credential.qrToken, ...) — nunca com um objeto/JSON.stringify.
  assert.match(src, /QRCode\.toDataURL\(result\.credential\.qrToken/);
  assert.doesNotMatch(src, /QRCode\.toDataURL\(JSON\.stringify/);
});
