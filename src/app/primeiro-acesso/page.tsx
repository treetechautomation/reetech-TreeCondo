"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initializeFirebase } from "@/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { normalizeInviteCode, isValidInviteCode } from "@/lib/normalization/code";

type RespOk = {
  ok: true;
  email: string;
  condominioId: string;
  uid: string;
  role: string;
  alreadyDone?: boolean;
};

type RespErr = { ok: false; error: string };

function PrimeiroAcessoInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const initialCode = useMemo(() => normalizeInviteCode(sp?.get("code") ?? ""), [sp]);

  const [code, setCode] = useState(initialCode);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    const v = normalizeInviteCode(code);
    setCode(v);
    setError(null);

    if (!isValidInviteCode(v)) return setError("Código inválido. Use o formato TC-XXXXXXXX (8 caracteres).");
    if (!email.trim()) return setError("Informe seu e-mail.");
    if (senha.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");
    if (senha !== senha2) return setError("As senhas não conferem.");

    setLoading(true);
    try {
      const r = await fetch("/api/convites/finalizar-primeiro-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: v, email: email.trim(), senha }),
      });

      const data = (await r.json().catch(() => null)) as RespOk | RespErr | null;

      if (!data) return setError("Resposta inválida do servidor.");
      if (!("ok" in data) || data.ok !== true) return setError((data as any)?.error || "Não foi possível concluir o primeiro acesso.");

      // login normal (sem customToken)
      const { auth } = initializeFirebase();
      await signInWithEmailAndPassword(auth, email.trim(), senha);

      // opcional: guardar para debug/UX
      try {
        localStorage.setItem("tc_invite_code", v);
        localStorage.setItem("tc_invite_email", email.trim());
      } catch {}

      router.replace("/painel");
    } catch (e: any) {
      setError(e?.message || "Erro ao concluir o primeiro acesso.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout pageTitle="Primeiro acesso" headerActions={null}>
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Ativar primeiro acesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Digite o código do convite, confirme seu e-mail e crie sua senha. Você já entra automaticamente.
          </p>

          <div className="mt-6 space-y-3">
            <Input
              placeholder="TC-9F3K2P1A"
              value={code}
              onChange={(e) => setCode(normalizeInviteCode(e.target.value))}
              maxLength={11}
            />

            <Input
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />

            <Input
              placeholder="Nova senha (mín. 6 caracteres)"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              type="password"
            />

            <Input
              placeholder="Confirmar senha"
              value={senha2}
              onChange={(e) => setSenha2(e.target.value)}
              type="password"
            />

            {error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button className="w-full" onClick={handleFinish} disabled={loading}>
              {loading ? "Ativando..." : "Ativar acesso"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card/50 p-5 text-xs text-muted-foreground">
          Dica: cole o código com espaços que eu normalizo automaticamente.
        </div>
      </div>
    </AppLayout>
  );
}

export default function PrimeiroAcessoPage() {
  return (
    <Suspense fallback={null}>
      <PrimeiroAcessoInner />
    </Suspense>
  );
}
