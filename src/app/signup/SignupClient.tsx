"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";
import { initializeFirebase } from "@/firebase";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function isStrongEnough(pw: string) {
  return pw.length >= 8;
}

export default function SignupClient() {
  const router = useRouter();
  const { auth } = initializeFirebase();

  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [confirmarSenha, setConfirmarSenha] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nome.trim()) {
      setError("Informe seu nome.");
      return;
    }
    if (!email.trim()) {
      setError("Informe seu e-mail.");
      return;
    }
    if (!isStrongEnough(senha)) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);
      await sendEmailVerification(cred.user);
      setSuccess(true);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        setError("Este e-mail já está em uso. Faça login ou recupere sua senha.");
      } else if (code === "auth/weak-password") {
        setError("A senha é muito fraca. Use pelo menos 8 caracteres com letras e números.");
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-[480px]">
        <Card className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-[0_22px_70px_rgba(2,6,23,0.55)] tc-card-depth text-white">
          <CardHeader className="items-center pb-2 text-center">
            <div className="relative h-16 w-16 mb-3 rounded-2xl bg-white/[0.08] backdrop-blur flex items-center justify-center border border-white/15 overflow-hidden">
              <Image src="/logo.png?v=2" alt="TreeCondo" width={56} height={56} priority className="object-contain" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              <span className="text-[#00D0E6]">Tree</span>
              <span className="text-[#D3EA00]">Condo</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-center">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200">
              <p className="font-semibold mb-1">Conta criada!</p>
              <p>
                Enviamos um link de verificação para <strong>{email}</strong>.
                Verifique sua caixa de entrada e clique no link antes de fazer login.
              </p>
            </div>
            <Link href="/login">
              <Button className="w-full h-11 rounded-xl text-slate-900 font-bold shadow-lg tc-btn-neon bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] border-none">
                Ir para o login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[480px]">
      <Card className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-[0_22px_70px_rgba(2,6,23,0.55)] tc-card-depth text-white">
        <CardHeader className="items-center pb-2 text-center">
          <div className="relative h-16 w-16 mb-3 rounded-2xl bg-white/[0.08] backdrop-blur flex items-center justify-center border border-white/15 overflow-hidden">
            <Image src="/logo.png?v=2" alt="TreeCondo" width={56} height={56} priority className="object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            <span className="text-[#00D0E6]">Tree</span>
            <span className="text-[#D3EA00]">Condo</span>
          </CardTitle>
          <CardDescription className="text-white/60 !mt-1">
            Crie sua conta gratuitamente.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm text-white/80">Nome completo</label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                type="text"
                placeholder="Seu nome completo"
                className="h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#00D0E6] focus:ring-1 focus:ring-[#00D0E6]"
              />
            </div>

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
                  placeholder="mínimo 8 caracteres"
                  className="h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#00D0E6] focus:ring-1 focus:ring-[#00D0E6] pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute inset-y-0 right-0 h-full w-10 text-white/60 hover:text-white hover:bg-transparent"
                  onClick={() => setShowPassword((p) => !p)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-white/80">Confirmar senha</label>
              <div className="relative">
                <Input
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  type={showConfirm ? "text" : "password"}
                  placeholder="repita a senha"
                  className="h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#00D0E6] focus:ring-1 focus:ring-[#00D0E6] pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute inset-y-0 right-0 h-full w-10 text-white/60 hover:text-white hover:bg-transparent"
                  onClick={() => setShowConfirm((p) => !p)}
                >
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <Button
              disabled={loading}
              className="w-full h-11 rounded-xl text-slate-900 font-bold shadow-lg tc-btn-neon bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] border-none disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
            >
              {loading ? "Criando conta..." : "Criar minha conta"}
            </Button>

            <div className="text-center pt-2">
              <span className="text-sm text-white/50">Já tem conta? </span>
              <Link href="/login" className="text-sm text-[#00D0E6] hover:underline font-semibold">
                Entrar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
