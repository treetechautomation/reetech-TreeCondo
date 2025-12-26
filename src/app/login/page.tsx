"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { initializeFirebase } from "@/firebase";
import {
  completeMagicLinkIfPresent,
  sendMagicLink,
  setPasswordAfterMagicLink,
} from "@/lib/magicLink";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function isStrongEnough(pw: string) {
  return pw.length >= 8;
}

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [tab, setTab] = React.useState<"login" | "primeiro">("login");

  // Login normal
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [loadingLogin, setLoadingLogin] = React.useState(false);
  const [errorLogin, setErrorLogin] = React.useState<string | null>(null);

  // Primeiro acesso (link mágico)
  const [primeiroEmail, setPrimeiroEmail] = React.useState("");
  const [loadingMagic, setLoadingMagic] = React.useState(false);
  const [magicMsg, setMagicMsg] = React.useState<string | null>(null);
  const [magicErr, setMagicErr] = React.useState<string | null>(null);

  // Completar link mágico
  const [needEmailToComplete, setNeedEmailToComplete] = React.useState(false);

  // Criar senha após link mágico
  const [pw1, setPw1] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [loadingSetPw, setLoadingSetPw] = React.useState(false);
  const [pwMsg, setPwMsg] = React.useState<string | null>(null);
  const [pwErr, setPwErr] = React.useState<string | null>(null);

  // Se vier com link mágico na URL, tenta completar
  React.useEffect(() => {
    (async () => {
      try {
        const res = await completeMagicLinkIfPresent();
        if (res.needEmail) {
          setTab("primeiro");
          setNeedEmailToComplete(true);
          setMagicMsg("Confirme seu e-mail para finalizar o primeiro acesso.");
        }
        if (res.completed) {
          setTab("primeiro");
          setNeedEmailToComplete(false);
          setMagicMsg("✅ Primeiro acesso autenticado. Agora crie sua senha.");
        }
      } catch (e: any) {
        setTab("primeiro");
        setMagicErr(e?.message || "Falha ao completar o link mágico.");
      }
    })();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorLogin(null);
    setLoadingLogin(true);
    try {
      const { auth } = initializeFirebase();
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      router.push("/");
    } catch (e: any) {
      setErrorLogin(e?.message || "Falha ao entrar.");
    } finally {
      setLoadingLogin(false);
    }
  }

  async function handleSendMagic(e: React.FormEvent) {
    e.preventDefault();
    setMagicErr(null);
    setMagicMsg(null);
    setLoadingMagic(true);
    try {
      await sendMagicLink(primeiroEmail.trim());
      setMagicMsg("✅ Link enviado! Verifique seu e-mail e clique para autenticar.");
      setNeedEmailToComplete(false);
    } catch (e: any) {
      setMagicErr(e?.message || "Falha ao enviar link mágico.");
    } finally {
      setLoadingMagic(false);
    }
  }

  async function handleCompleteMagicWithEmail() {
    setMagicErr(null);
    setMagicMsg(null);
    setLoadingMagic(true);
    try {
      const res = await completeMagicLinkIfPresent(primeiroEmail.trim());
      if (res.completed) {
        setNeedEmailToComplete(false);
        setMagicMsg("✅ Primeiro acesso autenticado. Agora crie sua senha.");
      } else {
        setMagicErr("Não encontrei link válido na URL.");
      }
    } catch (e: any) {
      setMagicErr(e?.message || "Falha ao completar o link mágico.");
    } finally {
      setLoadingMagic(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);

    if (!isStrongEnough(pw1)) {
      setPwErr("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (pw1 !== pw2) {
      setPwErr("As senhas não conferem.");
      return;
    }

    setLoadingSetPw(true);
    try {
      await setPasswordAfterMagicLink(pw1);
      setPwMsg("✅ Senha criada! Agora entre com e-mail e senha.");
      setTab("login");
      setSenha("");
    } catch (e: any) {
      setPwErr(e?.message || "Falha ao criar senha.");
    } finally {
      setLoadingSetPw(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* FUNDO PREMIUM */}
      <div className="absolute inset-0 bg-[#f7f2eb]" />
      <div className="pointer-events-none absolute inset-0">
        {/* gradiente principal */}
        <div className="absolute -top-48 -left-48 h-[520px] w-[520px] rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="absolute top-20 -right-40 h-[560px] w-[560px] rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-[-220px] left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-lime-300/20 blur-3xl" />

        {/* brilho suave */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.55] via-white/[0.25] to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.16),transparent_55%)]" />
      </div>

      {/* CARD GLASS */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-[980px] grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LADO BRAND */}
          <div className="hidden lg:flex flex-col justify-center rounded-3xl p-10 text-white overflow-hidden relative"
               style={{ background: "linear-gradient(135deg, rgba(13,148,136,0.95), rgba(34,197,94,0.85))" }}>
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 -right-20 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
              <div className="absolute bottom-[-80px] -left-24 h-72 w-72 rounded-full bg-black/10 blur-2xl" />
            </div>

            <div className="relative">
              <div className="flex flex-col items-center gap-4 mb-4">
                <Image
                  src="/logo-treecondo.jpeg"
                  alt="TreeCondo Logo"
                  width={192}
                  height={192}
                  className="rounded-2xl border-2 border-white/20"
                />
                <div className="text-center">
                  <div className="text-base tracking-[0.2em] text-white/80">TREETECH AUTOMATION</div>
                </div>
              </div>
              <p className="mt-4 text-white/90 leading-relaxed">
                Gestão inteligente para condomínios. Centralize moradores, síndicos e operação
                com uma experiência premium.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm">Link mágico no primeiro acesso</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm">Senha criada pelo morador</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm">Acesso seguro</span>
              </div>
            </div>
          </div>

          <Card className="rounded-3xl border-black/5 bg-white/35 backdrop-blur-xl shadow-[0_20px_70px_rgba(2,6,23,0.18)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">
                <span style={{ color: '#00D0E6' }}>Tree</span>
                <span style={{ color: '#D3EA00' }}>Condo</span>
              </CardTitle>
              <CardDescription className="text-slate-700">
                Acesse sua conta ou finalize o primeiro acesso.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList className="grid grid-cols-2 w-full rounded-2xl bg-white/40 border border-black/5 p-1">
                  <TabsTrigger className="rounded-xl" value="login">Entrar</TabsTrigger>
                  <TabsTrigger className="rounded-xl" value="primeiro">Primeiro acesso</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-5">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm text-slate-700">E-mail</label>
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        placeholder="seu@email.com"
                        className="h-11 rounded-xl bg-white/60"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm text-slate-700">Senha</label>
                      <Input
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        type="password"
                        placeholder="••••••••"
                        className="h-11 rounded-xl bg-white/60"
                      />
                    </div>

                    {errorLogin && (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                        {errorLogin}
                      </div>
                    )}

                    <Button
                      disabled={loadingLogin}
                      className="w-full h-11 rounded-xl text-white shadow-lg"
                      style={{ background: "linear-gradient(135deg, #0ea5a4, #22c55e)" }}
                      type="submit"
                    >
                      {loadingLogin ? "Entrando..." : "Entrar"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="primeiro" className="mt-5">
                  <div className="space-y-5">
                    {/* enviar link */}
                    <form onSubmit={handleSendMagic} className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-sm text-slate-700">E-mail</label>
                        <Input
                          value={primeiroEmail}
                          onChange={(e) => setPrimeiroEmail(e.target.value)}
                          type="email"
                          placeholder="e-mail cadastrado pelo condomínio"
                          className="h-11 rounded-xl bg-white/60"
                        />
                      </div>

                      {magicMsg && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
                          {magicMsg}
                        </div>
                      )}
                      {magicErr && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                          {magicErr}
                        </div>
                      )}

                      <Button
                        disabled={loadingMagic}
                        className="w-full h-11 rounded-xl text-white shadow-lg"
                        style={{ background: "linear-gradient(135deg, #0ea5a4, #22c55e)" }}
                        type="submit"
                      >
                        {loadingMagic ? "Enviando..." : "Enviar link de primeiro acesso"}
                      </Button>

                      {needEmailToComplete && (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={loadingMagic || !primeiroEmail.trim()}
                          className="w-full h-11 rounded-xl bg-white/40"
                          onClick={handleCompleteMagicWithEmail}
                        >
                          {loadingMagic ? "Finalizando..." : "Finalizar com este e-mail"}
                        </Button>
                      )}
                    </form>

                    {/* criar senha */}
                    <div className="rounded-2xl border border-black/5 bg-white/40 p-4">
                      <div className="mb-3">
                        <div className="text-base font-semibold text-slate-900">
                          Criar senha (após autenticar no link)
                        </div>
                        <div className="text-sm text-slate-700">
                          Clique no link do e-mail e depois defina sua senha aqui.
                        </div>
                      </div>

                      <form onSubmit={handleSetPassword} className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-sm text-slate-700">Nova senha</label>
                          <Input
                            value={pw1}
                            onChange={(e) => setPw1(e.target.value)}
                            type="password"
                            className="h-11 rounded-xl bg-white/60"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm text-slate-700">Confirmar senha</label>
                          <Input
                            value={pw2}
                            onChange={(e) => setPw2(e.target.value)}
                            type="password"
                            className="h-11 rounded-xl bg-white/60"
                          />
                        </div>

                        {pwMsg && (
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
                            {pwMsg}
                          </div>
                        )}
                        {pwErr && (
                          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                            {pwErr}
                          </div>
                        )}

                        <Button
                          disabled={loadingSetPw}
                          className="w-full h-11 rounded-xl text-white shadow-lg"
                          style={{ background: "linear-gradient(135deg, #0ea5a4, #22c55e)" }}
                          type="submit"
                        >
                          {loadingSetPw ? "Salvando..." : "Criar senha"}
                        </Button>
                      </form>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-6 text-center text-xs text-slate-600">
                TreeCondo • Uma solução Treetech Automation
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
