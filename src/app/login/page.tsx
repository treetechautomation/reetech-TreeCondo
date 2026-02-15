"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, , updatePassword, onAuthStateChanged } from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";
import { initializeFirebase } from "@/firebase";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TreeCondoBrand } from "@/components/branding/TreeCondoBrand";
import { useBranding } from "@/contexts/BrandingContext";

function isStrongEnough(pw: string) {
  return pw.length >= 8;
}

export default function LoginPage() {
  const router = useRouter();
  const { auth } = initializeFirebase();

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) router.replace("/painel");
    });
    return () => unsub();
  }, [auth, router]);

  const branding = useBranding();
  const logoSrc = branding.menuLogoUrl || branding.logoUrl || "/logo-treecondo.jpeg";

  const [tab, setTab] = React.useState<"login" | "primeiro">("login");

  // Login normal
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loadingLogin, setLoadingLogin] = React.useState(false);
  const [errorLogin, setErrorLogin] = React.useState<string | null>(null);

  // Primeiro acesso (código)
  const [codigo, setCodigo] = React.useState("");
  const [loadingCodigo, setLoadingCodigo] = React.useState(false);
  const [codigoMsg, setCodigoMsg] = React.useState<string | null>(null);
  const [codigoErr, setCodigoErr] = React.useState<string | null>(null);

  // Criar senha após validar código
  const [pw1, setPw1] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [loadingSetPw, setLoadingSetPw] = React.useState(false);
  const [pwMsg, setPwMsg] = React.useState<string | null>(null);
  const [pwErr, setPwErr] = React.useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const [codigoValidado, setCodigoValidado] = React.useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorLogin(null);
    setLoadingLogin(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
      router.push("/painel");
    } catch (e: any) {
      setErrorLogin(e?.message || "Falha ao entrar.");
    } finally {
      setLoadingLogin(false);
    }
  }

  async function handleValidarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setCodigoErr(null);
    setCodigoMsg(null);
    setPwErr(null);
    setPwMsg(null);

    if (!email.trim()) {
      setCodigoErr("Informe o e-mail.");
      return;
    }
    if (!codigo.trim()) {
      setCodigoErr("Informe o código (TC-XXXXXXXX).");
      return;
    }

    setLoadingCodigo(true);
    try {
      const r = await fetch("/api/convites/finalizar-primeiro-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: codigo.trim(), senha: pw1 }),
      });

      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "Código inválido.");

      // finaliza primeiro acesso (código + senha) e loga normal
        await signInWithEmailAndPassword(auth, email.trim(), pw1);

        setCodigoValidado(true);
      setCodigoMsg("✅ Código validado. Agora crie sua senha abaixo.");
    } catch (e: any) {
      setCodigoValidado(false);
      setCodigoErr(e?.message || "Falha ao validar código.");
    } finally {
      setLoadingCodigo(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);

    if (!codigoValidado) {
      setPwErr("Valide o código acima para liberar a criação de senha.");
      return;
    }

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
      if (!auth.currentUser) throw new Error("Usuário não autenticado.");
      await updatePassword(auth.currentUser, pw1);

      setPwMsg("✅ Senha criada! Agora você já pode entrar normalmente.");
      setTimeout(() => router.push("/painel"), 800);
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
          <div
            className="hidden lg:flex flex-col justify-center rounded-3xl p-10 text-white overflow-hidden relative"
            style={{ background: "linear-gradient(135deg, rgba(13,148,136,0.95), rgba(34,197,94,0.85))" }}
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 -right-20 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
              <div className="absolute bottom-[-80px] -left-24 h-72 w-72 rounded-full bg-black/10 blur-2xl" />
            </div>

            <div className="relative">
              <TreeCondoBrand variant="login" />

              <p className="mt-6 text-white/90 leading-relaxed text-center">
                Centralize moradores, síndicos e operação com uma experiência premium.
              </p>

              <div className="mt-8 flex flex-wrap gap-2 justify-center">
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm">Código no primeiro acesso</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm">Senha criada pelo morador</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm">Acesso seguro</span>
              </div>
            </div>
          </div>

          <Card className="rounded-3xl border-black/5 bg-white/35 backdrop-blur-xl shadow-[0_20px_70px_rgba(2,6,23,0.18)]">
            <CardHeader className="items-center pb-2 text-center">
              <Image src={logoSrc} alt="TreeCondo" width={64} height={64} className="mb-4 rounded-2xl" />
              <CardTitle className="text-2xl">
                <span style={{ color: "#00D0E6" }}>Tree</span>
                <span style={{ color: "#D3EA00" }}>Condo</span>
              </CardTitle>
              <CardDescription className="text-slate-700 !mt-2">
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
                       <div className="relative">
                        <Input
                          value={senha}
                          onChange={(e) => setSenha(e.target.value)}
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="h-11 rounded-xl bg-white/60 pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute inset-y-0 right-0 h-full w-10 text-slate-600 hover:bg-transparent"
                          onClick={() => setShowPassword((prev) => !prev)}
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </Button>
                      </div>
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
                    {/* validar código */}
                    <form onSubmit={handleValidarCodigo} className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-sm text-slate-700">E-mail</label>
                        <Input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          type="email"
                          placeholder="e-mail cadastrado pelo condomínio"
                          className="h-11 rounded-xl bg-white/60"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm text-slate-700">Código de primeiro acesso</label>
                        <Input
                          value={codigo}
                          onChange={(e) => setCodigo(e.target.value)}
                          placeholder="TC-XXXXXXXX"
                          className="h-11 rounded-xl bg-white/60"
                        />
                        <div className="text-xs text-slate-600">Exemplo: <b>TC-9F3K2P1A</b></div>
                      </div>

                      {codigoMsg && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
                          {codigoMsg}
                        </div>
                      )}
                      {codigoErr && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                          {codigoErr}
                        </div>
                      )}

                      <Button
                        disabled={loadingCodigo}
                        className="w-full h-11 rounded-xl text-white shadow-lg"
                        style={{ background: "linear-gradient(135deg, #0ea5a4, #22c55e)" }}
                        type="submit"
                      >
                        {loadingCodigo ? "Validando..." : "Validar código"}
                      </Button>
                    </form>

                    {/* criar senha */}
                    <div className="rounded-2xl border border-black/5 bg-white/40 p-4">
                      <div className="mb-3">
                        <div className="text-base font-semibold text-slate-900">Criar senha</div>
                        <div className="text-sm text-slate-700">
                          Depois de validar o código, crie sua senha para os próximos logins.
                        </div>
                      </div>

                      <form onSubmit={handleSetPassword} className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-sm text-slate-700">Nova senha</label>
                           <div className="relative">
                            <Input
                              value={pw1}
                              onChange={(e) => setPw1(e.target.value)}
                              type={showNewPassword ? "text" : "password"}
                              className="h-11 rounded-xl bg-white/60 pr-10"
                              disabled={!codigoValidado}
                            />
                             <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute inset-y-0 right-0 h-full w-10 text-slate-600 hover:bg-transparent"
                              onClick={() => setShowNewPassword((prev) => !prev)}
                              disabled={!codigoValidado}
                            >
                              {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm text-slate-700">Confirmar senha</label>
                           <div className="relative">
                            <Input
                              value={pw2}
                              onChange={(e) => setPw2(e.target.value)}
                              type={showConfirmPassword ? "text" : "password"}
                              className="h-11 rounded-xl bg-white/60 pr-10"
                              disabled={!codigoValidado}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute inset-y-0 right-0 h-full w-10 text-slate-600 hover:bg-transparent"
                              onClick={() => setShowConfirmPassword((prev) => !prev)}
                              disabled={!codigoValidado}
                            >
                              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </Button>
                          </div>
                        </div>

                        {!codigoValidado && (
                          <div className="rounded-xl border border-black/5 bg-white/50 px-3 py-2 text-sm text-slate-700">
                            Valide o código acima para liberar a criação de senha.
                          </div>
                        )}

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
                          disabled={loadingSetPw || !codigoValidado}
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
