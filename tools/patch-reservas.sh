#!/usr/bin/env bash
set -euo pipefail

echo "== Patch Reservas =="

# 1) Página /reservas/solicitacoes
mkdir -p src/app/reservas/solicitacoes
cat > src/app/reservas/solicitacoes/page.tsx <<'EOF'
"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useSessionCtx } from "@/contexts/SessionContext";

export default function ReservasSolicitacoesPage() {
  const { session, isSessionLoading } = useSessionCtx();

  if (isSessionLoading) {
    return <AppLayout pageTitle="Solicitações de Reservas">Carregando...</AppLayout>;
  }

  if (!session) {
    return <AppLayout pageTitle="Solicitações de Reservas">Sem sessão.</AppLayout>;
  }

  const role = session.role;
  const canApprove = session.superAdmin || role === "SINDICO" || role === "ADMIN";

  if (!canApprove) {
    return <AppLayout pageTitle="Solicitações de Reservas">Acesso negado.</AppLayout>;
  }

  return (
    <AppLayout pageTitle="Solicitações de Reservas">
      <div className="rounded-2xl border border-black/10 bg-white p-4">
        Aqui vai a tela de aprovar/bloquear (pendentes).
      </div>
    </AppLayout>
  );
}
EOF

echo "✅ /reservas/solicitacoes criada"

# 2) Remover botão Aprovar/Bloquear de /reservas e trocar por link
cp -f src/app/reservas/page.tsx src/app/reservas/page.tsx.bak_$(date +%Y%m%d_%H%M%S)
node -e '
const fs = require("fs");
const file = "src/app/reservas/page.tsx";
let s = fs.readFileSync(file,"utf8");

if (!s.includes("Aprovar / Bloquear")) {
  console.log("ℹ️ Não achei Aprovar/Bloquear. OK.");
} else {
  s = s.replace(/<Button[^>]*>\s*Aprovar\s*\/\s*Bloquear\s*<\/Button>/g,
`{(session?.superAdmin || session?.role === "SINDICO" || session?.role === "ADMIN") ? (
  <a href="/reservas/solicitacoes" className="text-sm underline text-muted-foreground hover:text-slate-900">
    Ver solicitações
  </a>
) : null}`);
  s = s.replace(/Aprovar\s*\/\s*Bloquear/g, "Ver solicitações");
  fs.writeFileSync(file,s);
  console.log("✅ /reservas agora é só reservar (com link p/ solicitações).");
}
'

# 3) menuPermissions: adicionar reservas_solicitacoes
cp -f src/lib/menuPermissions.ts src/lib/menuPermissions.ts.bak_$(date +%Y%m%d_%H%M%S)
node -e '
const fs = require("fs");
const file = "src/lib/menuPermissions.ts";
let s = fs.readFileSync(file,"utf8");

if (!s.includes(`"reservas_solicitacoes"`)) {
  s = s.replace(/(\|\s*"reservas_checkin"\s*\n)/, `$1    | "reservas_solicitacoes"\n`);
  s = s.replace(/(reservas_checkin:\s*"Check-in de Reserva",\s*\n)/, `$1    reservas_solicitacoes: "Solicitações de Reservas",\n`);
  s = s.replace(/(SINDICO:\s*\{[\s\S]*?reservas_checkin:\s*true,\s*\n)/, `$1      reservas_solicitacoes: true,\n`);
  s = s.replace(/(ADMIN:\s*\{[\s\S]*?reservas_checkin:\s*true,\s*\n)/, `$1      reservas_solicitacoes: true,\n`);
  fs.writeFileSync(file,s);
  console.log("✅ menuPermissions: reservas_solicitacoes adicionada.");
} else {
  console.log("ℹ️ menuPermissions já tinha reservas_solicitacoes.");
}
'

# 4) AppLayout: adicionar item do menu
cp -f src/components/layout/AppLayout.tsx src/components/layout/AppLayout.tsx.bak_$(date +%Y%m%d_%H%M%S)
node -e '
const fs = require("fs");
const file = "src/components/layout/AppLayout.tsx";
let s = fs.readFileSync(file,"utf8");

if (s.includes(`href: "/reservas/solicitacoes"`)) {
  console.log("ℹ️ AppLayout já tem /reservas/solicitacoes.");
} else {
  s = s.replace(/(\{\s*href:\s*"\/reservas\/agenda"[\s\S]*?\},\s*\n)/,
`$1    { href: "/reservas/solicitacoes", label: "Solicitações de Reservas", key: "reservas_solicitacoes" },\n`);
  fs.writeFileSync(file,s);
  console.log("✅ AppLayout: inserido /reservas/solicitacoes.");
}
'

echo "== Fim =="
