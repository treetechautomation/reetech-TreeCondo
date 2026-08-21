import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // ✅ IGNORE (substitui .eslintignore)
  {
    ignores: [
      "**/backup_*/**",
      "workspace/**",
      "tools/**",
      "scripts/**",
      "functions/lib/**",
      "public/sw.js",
      "public/workbox-*.js",
    ],
  },

  // ✅ Next.js + TS
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // ✅ Correções de regras antigas
  {
    rules: {
      "require-jsdoc": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];
