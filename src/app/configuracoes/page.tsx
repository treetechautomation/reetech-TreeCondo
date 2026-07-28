
"use client";

import * as React from "react";
import { doc, getDoc } from "firebase/firestore";
import { Eye, EyeOff, Settings } from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore, initializeFirebase } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";

async function getIdTokenSafe() {
  const { auth } = initializeFirebase() as any;
  const u = auth?.currentUser;
  if (!u) throw new Error("Sem usuário autenticado.");
  return await u.getIdToken();
}

export default function ConfiguracoesPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const condominioAtivoId = session?.activeCondominioId || null;
  const uid = session?.user?.uid;
  const firestore = useFirestore();

  const [pin, setPin] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const [pinLast4, setPinLast4] = React.useState<string | null>(null);
  const [loadingPinStatus, setLoadingPinStatus] = React.useState(true);
  const [isEditing, setIsEditing] = React.useState(false);
  const [showPin, setShowPin] = React.useState(false);

  React.useEffect(() => {
    async function fetchPinStatus() {
      if (!firestore || !condominioAtivoId || !uid) {
        setLoadingPinStatus(false);
        setPinLast4(null);
        return;
      }
      setLoadingPinStatus(true);
      try {
        const membroRef = doc(firestore, "condominios", condominioAtivoId, "membros", uid);
        const snap = await getDoc(membroRef);
        if (snap.exists()) {
          const data = snap.data();
          setPinLast4(data.encomendaPinLast4 || null);
        } else {
          setPinLast4(null);
        }
      } catch (error) {
        console.error("Erro ao buscar status do PIN:", error);
        setPinLast4(null);
      } finally {
        setLoadingPinStatus(false);
      }
    }

    fetchPinStatus();
  }, [firestore, condominioAtivoId, uid]);


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
      
      setPinLast4(data.pinLast4);
      setPin("");
      setIsEditing(false);
      setShowPin(false);
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

  const renderPinStatus = () => {
    if (loadingPinStatus) {
      return <Skeleton className="h-10 w-full" />;
    }

    if (isEditing) {
      return (
        <div className="space-y-4">
            <div className="relative">
                <Input
                    type={showPin ? "text" : "password"}
                    maxLength={8}
                    placeholder="Defina seu PIN (4 a 8 números)"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 right-0 h-full w-11"
                    onClick={() => setShowPin(p => !p)}
                >
                    {showPin ? <EyeOff /> : <Eye />}
                </Button>
            </div>
            <div className="flex gap-2">
                <Button onClick={salvarPin} disabled={saving} className="flex-1">
                    {saving ? "Salvando..." : "Salvar PIN"}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>
                    Cancelar
                </Button>
            </div>
        </div>
      );
    }

    if (pinLast4) {
      return (
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground">
            Seu PIN está definido. Final: <span className="font-mono font-semibold">****{pinLast4}</span>
          </p>
          <Button variant="secondary" onClick={() => setIsEditing(true)}>Alterar PIN</Button>
        </div>
      );
    }

    return (
        <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Você ainda não tem um PIN de retirada.</p>
            <Button onClick={() => setIsEditing(true)}>Definir PIN</Button>
        </div>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Configurações"
          description="Gerencie suas preferências e PIN de retirada de encomendas."
          icon={<Settings className="h-6 w-6" />}
        />

        {!condominioAtivoId ? (
          <SectionCard
            title="PIN de Encomendas"
            description="Selecione um condomínio para poder definir seu PIN."
          >
            <p className="text-sm text-muted-foreground">Nenhum condomínio ativo no momento.</p>
          </SectionCard>
        ) : (
          <SectionCard
            title="PIN de Encomendas"
            description="O porteiro pode validar sua retirada usando este PIN (sem QR/celular)."
          >
            <div className="pt-2">
              {renderPinStatus()}
            </div>

            {err && <div className="text-sm text-red-600 mt-2">{err}</div>}
            {msg && <div className="text-sm text-emerald-700 mt-2">{msg}</div>}
          </SectionCard>
        )}
      </div>
    </AppLayout>
  );
}
