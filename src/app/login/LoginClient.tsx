"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";
import { initializeFirebase } from "@/firebase";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/contexts/BrandingContext";

function isStrongEnough(pw: string) {
  return pw.length >= 8;
}

export default function LoginClient() {
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
      await signInWithEmailAndPassword(auth, email.trim(), senha.trim());
      router.push("/painel");
    } catch (error: any) {
      setErrorLogin("E-mail ou senha inválidos. Verifique suas credenciais e tente novamente.");
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

    setCodigoValidado(true);
    setCodigoMsg("✅ Código pronto. Agora crie sua senha abaixo para finalizar o primeiro acesso.");
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);

    if (!email.trim()) {
      setPwErr("Informe o e-mail acima.");
      return;
    }
    if (!codigo.trim()) {
      setPwErr("Informe o código (TC-XXXXXXXX) acima.");
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
      const res = await fetch("/api/convites/finalizar-primeiro-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: codigo.trim(),
          senha: pw1,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Falha ao finalizar primeiro acesso.");
      }

      await signInWithEmailAndPassword(auth, email.trim(), pw1);

      setPwMsg("✅ Primeiro acesso concluído! Entrando...");
      router.push("/painel");
    } catch (e: any) {
      setPwErr(e?.message || "Falha ao finalizar primeiro acesso.");
    } finally {
      setLoadingSetPw(false);
    }
  }

  return (
    <div className="tc-login-bg tc-bg relative min-h-screen overflow-hidden tc-grain">
      <div className="absolute inset-0 bg-transparent" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-[560px] grid grid-cols-1 gap-6">
          <Card className="rounded-3xl border-black/5 bg-white/35 backdrop-blur-xl shadow-[0_20px_70px_rgba(2,6,23,0.18)] tc-card-depth">
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
                        className="h-11 rounded-xl bg-white/30"
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
                          className="h-11 rounded-xl bg-white/30 pr-10"
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
                      className="w-full h-11 rounded-xl text-foreground shadow-lg tc-btn-neon"
                      style={{ background: "linear-gradient(135deg, hsl(var(--tc-cyan)), hsl(var(--tc-lime)))" }}
                      type="submit"
                    >
                      {loadingLogin ? "Entrando..." : "Entrar"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="primeiro" className="mt-5">
                  <div className="space-y-5">
                    <form onSubmit={handleValidarCodigo} className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-sm text-slate-700">E-mail</label>
                        <Input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          type="email"
                          placeholder="e-mail cadastrado pelo condomínio"
                          className="h-11 rounded-xl bg-white/30"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm text-slate-700">Código de primeiro acesso</label>
                        <Input
                          value={codigo}
                          onChange={(e) => setCodigo(e.target.value)}
                          placeholder="TC-XXXXXXXX"
                          className="h-11 rounded-xl bg-white/30"
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
                        className="w-full h-11 rounded-xl text-foreground shadow-lg tc-btn-neon"
                        style={{ background: "linear-gradient(135deg, hsl(var(--tc-cyan)), hsl(var(--tc-lime)))" }}
                        type="submit"
                      >
                        {loadingCodigo ? "Validando..." : "Validar código"}
                      </Button>
                    </form>

                    {codigoValidado && (
                      <form onSubmit={handleSetPassword} className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-sm text-slate-700">Nova senha</label>
                          <div className="relative">
                            <Input
                              value={pw1}
                              onChange={(e) => setPw1(e.target.value)}
                              type={showNewPassword ? "text" : "password"}
                              placeholder="mínimo 8 caracteres"
                              className="h-11 rounded-xl bg-white/30 pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute inset-y-0 right-0 h-full w-10 text-slate-600 hover:bg-transparent"
                              onClick={() => setShowNewPassword((p) => !p)}
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
                              placeholder="repita a senha"
                              className="h-11 rounded-xl bg-white/30 pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute inset-y-0 right-0 h-full w-10 text-slate-600 hover:bg-transparent"
                              onClick={() => setShowConfirmPassword((p) => !p)}
                            >
                              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </Button>
                          </div>
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
                          className="w-full h-11 rounded-xl text-foreground shadow-lg tc-btn-neon"
                          style={{ background: "linear-gradient(135deg, hsl(var(--tc-cyan)), hsl(var(--tc-lime)))" }}
                          type="submit"
                        >
                          {loadingSetPw ? "Salvando..." : "Salvar senha e entrar"}
                        </Button>
                      </form>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
