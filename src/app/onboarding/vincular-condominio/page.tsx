"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { initializeFirebase } from "@/firebase";
import { getIdToken } from "firebase/auth";
import { LogIn, ArrowLeft, Loader2, Search, CheckCircle2, Home, Building2 } from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSessionCtx } from "@/contexts/SessionContext";

type EligibleLink = {
  linkId: string;
  condominioId: string;
  condominioNome: string;
  blocoNome: string;
  unidadeNumero: string;
  tipoVinculo: string;
};

export default function VincularCondominioPage() {
  const router = useRouter();
  const { session, isSessionLoading } = useSessionCtx();
  const { auth } = initializeFirebase();

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [links, setLinks] = React.useState<EligibleLink[]>([]);
  const [searched, setSearched] = React.useState(false);
  const [claiming, setClaiming] = React.useState<string | null>(null);
  const [claimed, setClaimed] = React.useState(false);

  async function handleSearch() {
    setError(null);
    setLoading(true);
    setSearched(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        setError("Você precisa estar logado.");
        return;
      }
      const token = await getIdToken(user);
      const res = await fetch("/api/onboarding/eligible-links", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "EMAIL_NOT_VERIFIED") {
          setError("Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada e clique no link de confirmação.");
        } else {
          setError(data.error || "Erro ao buscar vínculos.");
        }
        return;
      }
      setLinks(data.links || []);
    } catch (e: any) {
      setError("Erro ao buscar vínculos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClaim(linkId: string, condominioId: string) {
    setClaiming(linkId);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await getIdToken(user);
      const res = await fetch("/api/onboarding/claim-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ linkId, condominioId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Erro ao vincular conta.");
        return;
      }
      if (data.alreadyLinked) {
        setClaimed(true);
        setTimeout(() => router.push("/painel"), 1500);
        return;
      }
      setClaimed(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e: any) {
      setError("Erro ao vincular conta. Tente novamente.");
    } finally {
      setClaiming(null);
    }
  }

  if (isSessionLoading) {
    return (
      <AppLayout pageTitle="Vincular condomínio">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </AppLayout>
    );
  }

  const hasActiveVinculo = (session?.vinculos ?? []).some((v) => v.status === "ATIVO");

  return (
    <AppLayout pageTitle="Vincular condomínio">
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="w-full max-w-[520px] space-y-6">
          <Card className="rounded-3xl border border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-gradient-to-br from-[#00D0E6]/20 to-[#D3EA00]/20 flex items-center justify-center border border-black/5">
                <Building2 className="h-7 w-7 text-slate-700" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-900">
                Vincular meu condomínio
              </CardTitle>
              <CardDescription className="text-slate-500">
                {hasActiveVinculo
                  ? "Você já possui um vínculo ativo. Caso precise acessar outro condomínio, utilize o seletor acima."
                  : "Se a administração do seu condomínio já cadastrou seus dados, encontraremos os vínculos disponíveis usando o e-mail verificado da sua conta."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {!searched && !hasActiveVinculo && (
                <Button
                  onClick={handleSearch}
                  disabled={loading}
                  className="w-full h-12 rounded-xl text-slate-900 font-bold shadow-lg bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] border-none disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" /> Buscar vínculos
                    </>
                  )}
                </Button>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                  {error.includes("e-mail ainda não foi verificado") && (
                    <button
                      type="button"
                      className="mt-2 block text-[#00D0E6] underline font-semibold"
                      onClick={async () => {
                        const user = auth.currentUser;
                        if (user) {
                          try {
                            await (await import("firebase/auth")).sendEmailVerification(user);
                            setError("Novo link de verificação enviado. Verifique seu e-mail.");
                          } catch {
                            setError("Erro ao reenviar link. Tente novamente mais tarde.");
                          }
                        }
                      }}
                    >
                      Reenviar link de verificação
                    </button>
                  )}
                  {!error.includes("e-mail ainda não foi verificado") && (
                    <button
                      type="button"
                      className="mt-2 block text-[#00D0E6] underline font-semibold"
                      onClick={handleSearch}
                    >
                      Tentar novamente
                    </button>
                  )}
                </div>
              )}

              {links.length === 0 && searched && !loading && !error && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 text-center">
                  <p className="font-semibold mb-1">Nenhum cadastro disponível</p>
                  <p className="text-amber-700">
                    Não encontramos nenhum cadastro disponível para o e-mail desta conta.
                    Verifique se você utilizou o mesmo e-mail informado à administração do condomínio.
                    Caso necessário, solicite ao síndico ou à administradora a atualização do seu cadastro.
                  </p>
                </div>
              )}

              {claimed && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800 text-center">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
                  <p className="font-semibold">Conta vinculada com sucesso!</p>
                  <p className="text-emerald-700">Redirecionando para o painel...</p>
                </div>
              )}

              {links.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-700">
                    {links.length} vínculo(s) encontrado(s):
                  </p>
                  {links.map((link) => (
                    <div
                      key={link.linkId}
                      className="rounded-xl border border-black/5 bg-white/80 p-4 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{link.condominioNome}</div>
                        <div className="text-sm text-slate-500">
                          Bloco: {link.blocoNome || "—"} • Unidade: {link.unidadeNumero || "—"}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{link.tipoVinculo}</div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleClaim(link.linkId, link.condominioId)}
                        disabled={claiming === link.linkId}
                        className="rounded-xl text-slate-900 font-bold bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] border-none disabled:opacity-50 h-10"
                      >
                        {claiming === link.linkId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Vincular"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
