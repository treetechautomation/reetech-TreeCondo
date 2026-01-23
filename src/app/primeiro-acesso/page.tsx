"use client";

import { useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ValidarRespOk = {
  ok: true;
  conviteId: string;
  condominioId: string | null;
  nome: string;
  email: string;
  role: string;
  blocoId: string | null;
  unidadeId: string | null;
  uidGerado: string | null;
  status: string;
  expiresAt: string | null;
};

type ValidarRespErr = { ok: false; error: string };

function normalizeCode(v: string) {
  return (v || "").trim().toUpperCase();
}

function isValidCode(v: string) {
  return /^TC-[A-Z0-9]{8}$/.test(v);
}

function PrimeiroAcessoInner() {
  const router = useRouter();
  const sp = useSearchParams();

  // Se você quiser permitir preencher por URL futuramente (ex: ?code=TC-XXXX)
  const initialCode = useMemo(() => normalizeCode((sp?.get("code") ?? "")), [sp]);

  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidarRespOk | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleValidate() {
    const v = normalizeCode(code);
    setCode(v);
    setError(null);
    setResult(null);

    if (!isValidCode(v)) {
      setError("Código inválido. Use o formato TC-XXXXXXXX (8 caracteres).");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/convites/validar-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: v }),
      });

      const data = (await r.json().catch(() => null)) as (ValidarRespOk | ValidarRespErr | null);

      if (!data) {
        setError("Resposta inválida do servidor.");
        return;
      }

      if (!("ok" in data) || data.ok !== true) {
        setError((data as any)?.error || "Não foi possível validar o código.");
        return;
      }

      setResult(data);

      // Guarda pra UX (opcional)
      try {
        localStorage.setItem("tc_invite_code", v);
        localStorage.setItem("tc_invite_id", data.conviteId);
      } catch {}

      // Próximo passo: definir senha
      router.push(`/definir-senha?conviteId=${encodeURIComponent(data.conviteId)}`);
    } catch (e: any) {
      setError(e?.message || "Erro ao validar o código.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout pageTitle="Primeiro acesso" headerActions={null}>
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Validar código</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Digite o código que chegou no e-mail para continuar e definir sua senha.
          </p>

          <div className="mt-6 space-y-3">
            <Input
              placeholder="TC-9F3K2P1A"
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              maxLength={11}
            />

            {error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleValidate}
              disabled={loading || !normalizeCode(code)}
            >
              {loading ? "Validando..." : "Validar e continuar"}
            </Button>

            {result && (
              <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                <div className="font-medium">Convite validado ✅</div>
                <div className="mt-2 text-muted-foreground">
                  {result.nome} • {result.email}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-card/50 p-5 text-xs text-muted-foreground">
          Dica: se você colar o código com espaços, eu normalizo automaticamente.
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
