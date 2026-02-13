"use client";

import { useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initializeFirebase } from "@/firebase";
import { signInWithCustomToken } from "firebase/auth";

type RespOk = {
  ok: true;
  uid: string;
  condominioId: string;
  conviteId: string;
  customToken: string;
  email: string;
  role: string;
};

type RespErr = { ok: false; error: string };

function normalizeCode(v: string) {
  return (v || "").trim().toUpperCase();
}

function isValidCode(v: string) {
  return /^TC-[A-Z0-9]{8}$/.test(v);
}

function PrimeiroAcessoInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const initialCode = useMemo(() => normalizeCode(sp?.get("code") ?? ""), [sp]);

  const [code, setCode] = useState(initialCode);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    const v = normalizeCode(code);
    setCode(v);
    setError(null);

    if (!isValidCode(v)) {
      setError("Código inválido. Use o formato TC-XXXXXXXX (8 caracteres).");
      return;
    }
    if (!email.trim()) {
      setError("Informe seu e-mail.");
      return;
    }
    if (senha.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== senha2) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/convites/finalizar-primeiro-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: v, email, senha }),
      });

      const data = (await r.json().catch(() => null)) as (RespOk | RespErr | null);
      if (!data) {
        setError("Resposta inválida do servidor.");
        return;
      }
      if (!("ok" in data) || data.ok !== true) {
        setError((data as any)?.error || "Não foi possível concluir o primeiro acesso.");
        return;
      }

      // login automático
      const { auth } = initializeFirebase();
      await signInWithCustomToken(auth, data.customToken);

      // opcional: guardar para debug/UX
      try {
        localStorage.setItem("tc_invite_code", v);
        localStorage.setItem("tc_invite_id", data.conviteId);
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
              onChange={(e) => setCode(normalizeCode(e.target.value))}
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
