"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "firebase/auth";
import { initializeFirebase } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PrimeiroAcessoPage() {
  const router = useRouter();
  const { auth } = initializeFirebase();

  const [senha, setSenha] = React.useState("");
  const [senha2, setSenha2] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const user = auth.currentUser;

  React.useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [user, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (senha.length < 6) {
      setMsg("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== senha2) {
      setMsg("As senhas não conferem.");
      return;
    }

    if (!auth.currentUser) {
      setMsg("Sessão expirada. Faça login novamente.");
      router.replace("/login");
      return;
    }

    setLoading(true);
    try {
      await updatePassword(auth.currentUser, senha);
      setMsg("Senha criada com sucesso! Agora você já pode entrar com e-mail e senha.");
      setTimeout(() => router.replace("/"), 800);
    } catch (err: any) {
      setMsg(err?.message || "Não foi possível definir a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f1ea] p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle>Criar senha</CardTitle>
          <CardDescription>
            Esse é seu primeiro acesso via link mágico. Crie uma senha para entrar normalmente depois.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nova senha</label>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirmar senha</label>
              <Input type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} placeholder="Repita a senha" />
            </div>

            {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
