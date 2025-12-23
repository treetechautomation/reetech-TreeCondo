const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "src/components/layout/AppLayout.tsx");
if (!fs.existsSync(file)) {
  console.error("❌ Arquivo não encontrado:", file);
  process.exit(1);
}

let s = fs.readFileSync(file, "utf8");

// 1) garantir imports necessários
if (!s.includes(`from "firebase/auth"`)) {
  // tenta inserir depois dos imports existentes
  s = s.replace(
    /(^import[\s\S]*?\n)(\n|export|function|const)/m,
    (m, imports, rest) => {
      if (imports.includes(`from "firebase/auth"`)) return m;
      return `${imports}import { signOut } from "firebase/auth";\n${rest}`;
    }
  );
}

if (!s.includes(`initializeFirebase`) && !s.includes(`from "@/firebase"`)) {
  s = s.replace(
    /(^import[\s\S]*?\n)(\n|export|function|const)/m,
    (m, imports, rest) => {
      if (imports.includes(`from "@/firebase"`)) return m;
      return `${imports}import { initializeFirebase } from "@/firebase";\n${rest}`;
    }
  );
} else if (!s.includes(`initializeFirebase`) && s.includes(`from "@/firebase"`)) {
  // se já importa "@/firebase" mas sem initializeFirebase, tenta adicionar no import existente
  s = s.replace(
    /import\s+\{([^}]+)\}\s+from\s+"@\/firebase";/m,
    (m, inside) => {
      if (inside.includes("initializeFirebase")) return m;
      return `import { ${inside.trim().replace(/\s+$/, "")}, initializeFirebase } from "@/firebase";`;
    }
  );
}

// 2) trocar handleLogout para fallback (logout opcional)
const handleLogoutRegex = /const\s+handleLogout\s*=\s*async\s*\(\)\s*=>\s*\{\s*([\s\S]*?)\s*\};/m;
if (handleLogoutRegex.test(s)) {
  s = s.replace(handleLogoutRegex, () => {
    return `const handleLogout = async () => {
  try {
    // Se existir logout no hook/context, usa. Senão, faz signOut direto.
    if (typeof (logout as any) === "function") {
      await (logout as any)();
    } else {
      const { auth } = initializeFirebase() as any;
      await signOut(auth);
    }
  } catch (e) {
    console.error("[AppLayout] erro ao deslogar:", e);
  } finally {
    router.push("/login");
  }
};`;
  });
} else {
  console.warn("⚠️ Não achei o bloco 'const handleLogout = async () => { ... };' para substituir.");
}

// 3) garantir que signOut e initializeFirebase realmente foram importados
if (!s.includes(`import { signOut } from "firebase/auth";`)) {
  // adiciona no topo se não conseguiu inserir antes
  s = `import { signOut } from "firebase/auth";\n` + s;
}
if (!s.includes(`initializeFirebase`) || !s.match(/from\s+"@\/firebase"/)) {
  // adiciona no topo se não conseguiu inserir antes
  if (!s.includes(`from "@/firebase"`)) {
    s = `import { initializeFirebase } from "@/firebase";\n` + s;
  }
}

fs.writeFileSync(file, s, "utf8");
console.log("✅ Patch aplicado em:", file);
