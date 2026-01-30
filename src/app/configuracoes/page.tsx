
"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionCtx } from "@/contexts/SessionContext";

async function getIdTokenSafe() {
  const { initializeFirebase } = await import("@/firebase");
  const { auth } = initializeFirebase() as any;
  const u = auth?.currentUser;
  if (!u) throw new Error("Sem usuário autenticado.");
  return await u.getIdToken();
}

export default function ConfiguracoesPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const condominioAtivoId = session?.activeCondominioId || null;

  const [pin, setPin] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  async function salvarPin() {
    setMsg(null);
    setErr(null);
    if (!condominioAtivoId) {
      setErr("Você não está vinculado a um condomínio ativo.");
      return;
    }
    const pinDigits = pin.replace(/\D/g, "");
    if (pinDigits.length < 4 || pinDigits.length > 8) {
      setErr("PIN deve ter de 4 a 8 números.");
      return;
    }
    setSaving(true);
    try {
      const token = await getIdTokenSafe();
      const res = await fetch("/api/configuracoes/encomendas/pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          condominioId: condominioAtivoId,
          pin: pinDigits,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Erro ao salvar PIN.");

      setPin("");
      setMsg(`✅ PIN de encomendas salvo com sucesso. Final: ****${data.pinLast4}`);
    } catch (e: any) {
      setErr(e?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (isSessionLoading) {
    return <AppLayout>Carregando...</AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aqui você pode configurar seu PIN pessoal para retirar encomendas quando esquecer o celular.
          </p>
        </div>
        
        {!condominioAtivoId ? (
           <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-6 shadow-sm space-y-4">
            <div className="font-medium">PIN de Encomendas</div>
             <p className="text-sm text-muted-foreground">Selecione um condomínio para poder definir seu PIN.</p>
           </div>
        ) : (
           <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-6 shadow-sm space-y-4">
            <div>
              <div className="font-medium">PIN de Encomendas</div>
              <div className="text-sm text-muted-foreground">
                O porteiro pode validar sua retirada usando este PIN (sem QR/celular).
              </div>
            </div>

            <div className="grid gap-3">
              <Input
                type="password"
                maxLength={8}
                placeholder="Defina seu PIN (4 a 8 números)"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
              <Button onClick={salvarPin} disabled={saving}>
                {saving ? "Salvando..." : "Salvar PIN"}
              </Button>
            </div>

            {msg && <div className="text-sm text-emerald-700">{msg}</div>}
            {err && <div className="text-sm text-red-600">{err}</div>}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
