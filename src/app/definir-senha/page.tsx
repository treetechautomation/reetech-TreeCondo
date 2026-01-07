"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, updatePassword, type User } from "firebase/auth";
import { initializeFirebase } from "@/firebase";

export default function DefinirSenhaPage() {
  const router = useRouter();

  const [user, setUser] = React.useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = React.useState(true);

  const [senha, setSenha] = React.useState("");
  const [senha2, setSenha2] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    const { auth } = initializeFirebase();

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
      setCheckingAuth(false);

      // Só redireciona DEPOIS que o Firebase confirmar que não tem usuário
      if (!u) router.replace("/login?tab=primeiro");
    });

    return () => unsub();
  }, [router]);

  const handleSave = async () => {
    setErr(null);
    setMsg(null);

    if (senha.length < 6) {
      setErr("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== senha2) {
      setErr("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const { auth } = initializeFirebase();
      const u = auth.currentUser;

      if (!u) {
        setErr("Sua sessão expirou. Faça o primeiro acesso novamente.");
        router.replace("/login?tab=primeiro");
        return;
      }

      await updatePassword(u, senha);

      setMsg("✅ Senha criada com sucesso! Agora você já pode entrar com e-mail e senha.");
      setTimeout(() => router.replace("/login"), 900);
    } catch (e: any) {
      setErr(e?.message || "Não foi possível definir a senha.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="rounded-2xl border bg-white/80 dark:bg-slate-900/60 backdrop-blur p-6 shadow">
          Carregando sua sessão...
        </div>
      </div>
    );
  }

  // Se não tem user, o redirect já acontece no effect
  if (!user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white/80 dark:bg-slate-900/60 backdrop-blur p-6 shadow">
        <h1 className="text-2xl font-semibold">Criar senha</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Primeiro acesso validado. Agora crie sua senha para os próximos logins.
        </p>

        <div className="mt-5 space-y-3">
          <div>
            <label className="text-sm font-medium">Nova senha</label>
            <input
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              type="password"
              className="mt-1 w-full rounded-xl border px-3 py-2 bg-transparent"
              placeholder="mínimo 6 caracteres"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Confirmar senha</label>
            <input
              value={senha2}
              onChange={(e) => setSenha2(e.target.value)}
              type="password"
              className="mt-1 w-full rounded-xl border px-3 py-2 bg-transparent"
              placeholder="repita a senha"
            />
          </div>

          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full rounded-xl px-4 py-2 font-medium bg-emerald-600 text-white disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar senha"}
          </button>

          <button
            onClick={() => router.replace("/")}
            className="w-full rounded-xl px-4 py-2 font-medium border"
          >
            Pular por agora
          </button>
        </div>
      </div>
    </div>
  );
}
