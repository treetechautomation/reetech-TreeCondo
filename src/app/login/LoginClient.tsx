"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { Eye, EyeOff, ArrowLeft, FileText, UserPlus, KeyRound } from "lucide-react";
import { initializeFirebase } from "@/firebase";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/contexts/BrandingContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function isStrongEnough(pw: string) {
  return pw.length >= 8;
}

export default function LoginClient() {
  const router = useRouter();
  const { auth } = initializeFirebase();

  const [tab, setTab] = React.useState<"login" | "primeiro">("login");
  const [aceitoTermos, setAceitoTermos] = React.useState(false);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) router.replace("/painel");
    });
    return () => unsub();
  }, [auth, router]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      if (t === "primeiro" || t === "login") {
        setTab(t);
      }
    }
  }, []);

  const logoSrc = "/logo.png?v=2";

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

  // Recuperação de senha
  const [resetOpen, setResetOpen] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState("");
  const [resetLoading, setResetLoading] = React.useState(false);
  const [resetMsg, setResetMsg] = React.useState<string | null>(null);
  const [resetErr, setResetErr] = React.useState<string | null>(null);

  function openReset() {
    setResetEmail(email.trim());
    setResetMsg(null);
    setResetErr(null);
    setResetOpen(true);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetMsg(null);
    setResetErr(null);

    const em = resetEmail.trim();
    if (!em) {
      setResetErr("Informe seu e-mail.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setResetErr("Informe um e-mail válido.");
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, em);
      setResetMsg("Se houver uma conta associada a este e-mail, você receberá as instruções para redefinir sua senha.");
    } catch (e: any) {
      const code = String(e?.code || "");
      if (code === "auth/too-many-requests") {
        setResetErr("Muitas tentativas. Aguarde alguns instantes e tente novamente.");
      } else {
        // Mensagem neutra para não revelar se a conta existe
        setResetMsg("Se houver uma conta associada a este e-mail, você receberá as instruções para redefinir sua senha.");
      }
    } finally {
      setResetLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!aceitoTermos) {
      setErrorLogin("Você deve aceitar os Termos de Uso para continuar.");
      return;
    }
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
    if (!aceitoTermos) {
      setCodigoErr("Você deve aceitar os Termos de Uso para continuar.");
      return;
    }
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
    if (!aceitoTermos) {
      setPwErr("Você deve aceitar os Termos de Uso para continuar.");
      return;
    }
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
    <div className="tc-login-bg relative min-h-screen overflow-hidden tc-grain tc-typography">
      {/* Botões de Voltar e Guias de Uso */}
      <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" className="text-sm font-semibold hover:bg-white/10 text-white/80 hover:text-white flex items-center gap-2 px-4 py-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>
        <Link href="/guias">
          <Button variant="ghost" className="text-sm font-semibold hover:bg-white/10 text-white/60 hover:text-white flex items-center gap-2 px-4 py-2 rounded-xl">
            <FileText className="h-4 w-4" /> Guias de Uso
          </Button>
        </Link>
      </div>

      {/* CARD GLASS */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 pt-24 sm:pt-4">
        <div className="w-full max-w-[480px]">
          <Card className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-[0_22px_70px_rgba(2,6,23,0.55)] tc-card-depth text-white">
            <CardHeader className="items-center pb-2 text-center">
              <div className="relative h-16 w-16 mb-3 rounded-2xl bg-white/[0.08] backdrop-blur flex items-center justify-center border border-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)] overflow-hidden">
                <Image src={logoSrc} alt="TreeCondo" width={56} height={56} priority className="object-contain" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                <span className="text-[#00D0E6]">Tree</span>
                <span className="text-[#D3EA00]">Condo</span>
              </CardTitle>
              <CardDescription className="text-white/60 !mt-1">
                Acesse sua conta ou finalize o primeiro acesso.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList className="grid grid-cols-2 w-full rounded-2xl bg-white/5 border border-white/10 p-1">
                  <TabsTrigger className="rounded-xl text-white/80 data-[state=active]:bg-white/10 data-[state=active]:text-white font-medium" value="login">
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger className="rounded-xl text-white/80 data-[state=active]:bg-white/10 data-[state=active]:text-white font-medium" value="primeiro">
                    Primeiro acesso
                  </TabsTrigger>
                </TabsList>

                {/* ABA ENTRAR */}
                <TabsContent value="login" className="mt-5">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm text-white/80">E-mail</label>
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        placeholder="seu@email.com"
                        className="h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#00D0E6] focus:ring-1 focus:ring-[#00D0E6]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm text-white/80">Senha</label>
                      <div className="relative">
                        <Input
                          value={senha}
                          onChange={(e) => setSenha(e.target.value)}
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#00D0E6] focus:ring-1 focus:ring-[#00D0E6] pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute inset-y-0 right-0 h-full w-10 text-white/60 hover:text-white hover:bg-transparent"
                          onClick={() => setShowPassword((prev) => !prev)}
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </Button>
                      </div>
                    </div>

                    <div className="text-right">
                      <button
                        type="button"
                        onClick={openReset}
                        className="text-xs text-white/60 hover:text-[#00D0E6] transition-colors focus:outline-none focus:underline"
                      >
                        Esqueceu sua senha?
                      </button>
                    </div>

                    {/* Checkbox Termos de Uso */}
                    <div className="flex items-start space-x-2.5 pt-2">
                      <input
                        id="termos-login-client"
                        type="checkbox"
                        checked={aceitoTermos}
                        onChange={(e) => setAceitoTermos(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10 text-[#00D0E6] focus:ring-[#00D0E6] transition cursor-pointer"
                      />
                      <label htmlFor="termos-login-client" className="text-xs text-white/60 leading-normal select-none cursor-pointer">
                        Li e concordo com os{" "}
                        <Dialog>
                          <DialogTrigger asChild>
                            <button type="button" className="text-[#00D0E6] hover:underline font-semibold">
                              Termos de Uso
                            </button>
                          </DialogTrigger>
                          <DialogContent 
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            onCloseAutoFocus={(e) => e.preventDefault()}
                            className="max-w-2xl bg-slate-950 border-white/15 text-white overflow-auto max-h-[80vh] tc-card-depth"
                          >
                            <DialogHeader>
                              <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                                <FileText className="text-[#00D0E6]" /> Termos de Uso do TreeCondo
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 text-xs text-white/80 leading-relaxed pt-4">
                              <p>
                                Bem-vindo ao <strong>TreeCondo</strong>, uma plataforma desenvolvida pela <strong>Treetech Automation</strong> para facilitar a gestão e a convivência em condomínios.
                              </p>
                              <h4 className="text-white font-semibold mt-2">1. Aceitação dos Termos</h4>
                              <p>
                                Ao acessar ou usar nossa plataforma, você concorda em cumprir e estar vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
                              </p>
                              <h4 className="text-white font-semibold mt-2">2. Descrição do Serviço</h4>
                              <p>
                                O TreeCondo fornece ferramentas para agendamento de áreas comuns, controle de acesso na portaria, comunicação interna de comunicados e avisos com suporte a enquetes, registro de incidentes e visualização de documentos condominiais.
                              </p>
                              <h4 className="text-white font-semibold mt-2">3. Privacidade e Proteção de Dados (LGPD)</h4>
                              <p>
                                Tratamos todas as informações cadastrais em estrita conformidade com a Lei Geral de Proteção de Dados (LGPD). Os dados são guardados de forma segura e utilizados apenas para fins internos de segurança do condomínio.
                              </p>
                              <h4 className="text-white font-semibold mt-2">4. Obrigações do Usuário</h4>
                              <p>
                                Cada usuário é responsável por manter a confidencialidade de sua senha de acesso. As informações inseridas no sistema (especialmente relativas a convidados autorizados na portaria e reservas) são de inteira responsabilidade do morador titular.
                              </p>
                              <h4 className="text-white font-semibold mt-2">5. Propriedade Intelectual</h4>
                              <p>
                                Todo o design, código-fonte e marcas do aplicativo pertencem exclusivamente à Treetech Automation.
                              </p>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </label>
                    </div>

                    {errorLogin && (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                        {errorLogin}
                      </div>
                    )}

                     <Button
                       disabled={loadingLogin || !aceitoTermos}
                       className="w-full h-11 rounded-xl text-slate-900 font-bold shadow-lg tc-btn-neon bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] border-none disabled:opacity-50 disabled:cursor-not-allowed"
                       type="submit"
                     >
                       {loadingLogin ? "Entrando..." : "Entrar"}
                     </Button>

                      <div className="text-center pt-1">
                        <Link href="/signup" className="text-sm text-[#00D0E6] hover:underline font-semibold inline-flex items-center gap-1.5">
                          <UserPlus className="h-4 w-4" /> Criar minha conta
                        </Link>
                      </div>
                  </form>
                </TabsContent>

                {/* ABA PRIMEIRO ACESSO */}
                <TabsContent value="primeiro" className="mt-5">
                  <div className="space-y-5">
                    <form onSubmit={handleValidarCodigo} className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-sm text-white/80">E-mail</label>
                        <Input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          type="email"
                          placeholder="e-mail cadastrado pelo condomínio"
                          className="h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#00D0E6] focus:ring-1 focus:ring-[#00D0E6]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm text-white/80">Código de primeiro acesso</label>
                        <Input
                          value={codigo}
                          onChange={(e) => setCodigo(e.target.value)}
                          placeholder="TC-XXXXXXXX"
                          className="h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#00D0E6] focus:ring-1 focus:ring-[#00D0E6]"
                        />
                        <div className="text-[10px] text-white/50">Exemplo: <b>TC-9F3K2P1A</b></div>
                      </div>

                      {/* Checkbox Termos de Uso (Primeiro Acesso) */}
                      <div className="flex items-start space-x-2.5 pt-1">
                        <input
                          id="termos-primeiro-client"
                          type="checkbox"
                          checked={aceitoTermos}
                          onChange={(e) => setAceitoTermos(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10 text-[#00D0E6] focus:ring-[#00D0E6] transition cursor-pointer"
                        />
                        <label htmlFor="termos-primeiro-client" className="text-xs text-white/60 leading-normal select-none cursor-pointer">
                          Li e concordo com os{" "}
                          <Dialog>
                            <DialogTrigger asChild>
                              <button type="button" className="text-[#00D0E6] hover:underline font-semibold">
                                Termos de Uso
                              </button>
                            </DialogTrigger>
                            <DialogContent 
                              onOpenAutoFocus={(e) => e.preventDefault()}
                              onCloseAutoFocus={(e) => e.preventDefault()}
                              className="max-w-2xl bg-slate-950 border-white/15 text-white overflow-auto max-h-[80vh] tc-card-depth"
                            >
                              <DialogHeader>
                                <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                                  <FileText className="text-[#00D0E6]" /> Termos de Uso
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 text-xs text-white/80 leading-relaxed pt-4">
                                <p>Tratamos todas as informações cadastrais em estrita conformidade com a LGPD...</p>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </label>
                      </div>

                      {codigoMsg && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                          {codigoMsg}
                        </div>
                      )}
                      {codigoErr && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                          {codigoErr}
                        </div>
                      )}

                      <Button
                        disabled={loadingCodigo || !aceitoTermos}
                        className="w-full h-11 rounded-xl text-slate-900 font-bold shadow-lg tc-btn-neon bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] border-none disabled:opacity-50 disabled:cursor-not-allowed"
                        type="submit"
                      >
                        {loadingCodigo ? "Validando..." : "Validar código"}
                      </Button>
                    </form>

                    {codigoValidado && (
                      <form onSubmit={handleSetPassword} className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-sm text-white/80">Nova senha</label>
                          <div className="relative">
                            <Input
                              value={pw1}
                              onChange={(e) => setPw1(e.target.value)}
                              type={showNewPassword ? "text" : "password"}
                              placeholder="mínimo 8 caracteres"
                              className="h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#00D0E6] focus:ring-1 focus:ring-[#00D0E6] pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute inset-y-0 right-0 h-full w-10 text-white/60 hover:text-white hover:bg-transparent"
                              onClick={() => setShowNewPassword((p) => !p)}
                            >
                              {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm text-white/80">Confirmar senha</label>
                          <div className="relative">
                            <Input
                              value={pw2}
                              onChange={(e) => setPw2(e.target.value)}
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="repita a senha"
                              className="h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#00D0E6] focus:ring-1 focus:ring-[#00D0E6] pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute inset-y-0 right-0 h-full w-10 text-white/60 hover:text-white hover:bg-transparent"
                              onClick={() => setShowConfirmPassword((p) => !p)}
                            >
                              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </Button>
                          </div>
                        </div>

                        {pwMsg && (
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                            {pwMsg}
                          </div>
                        )}
                        {pwErr && (
                          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                            {pwErr}
                          </div>
                        )}

                        <Button
                          disabled={loadingSetPw || !aceitoTermos}
                          className="w-full h-11 rounded-xl text-slate-900 font-bold shadow-lg tc-btn-neon bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] border-none disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Dialog: Recuperação de senha */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="max-w-md bg-slate-950 border-white/15 text-white tc-card-depth"
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#00D0E6]" />
              Recuperar senha
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Informe o e-mail utilizado no TreeCondo. Enviaremos as instruções para redefinir sua senha.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="text-sm text-white/80">E-mail</label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="seu@email.com"
                autoFocus
                disabled={resetLoading}
                className="h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#00D0E6] focus:ring-1 focus:ring-[#00D0E6]"
              />
            </div>

            {resetMsg && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {resetMsg}
              </div>
            )}
            {resetErr && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {resetErr}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setResetOpen(false)}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                Voltar ao login
              </Button>
              <Button
                type="submit"
                disabled={resetLoading}
                className="flex-1 h-11 rounded-xl text-slate-900 font-bold bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] border-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? "Enviando..." : "Enviar instruções"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
