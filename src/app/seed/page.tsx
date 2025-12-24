"use client";

import React from "react";
import { initializeFirebase } from "@/firebase";
import {
  addDoc,
  collection,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function SeedPage() {
  const [email, setEmail] = React.useState<string>("");
  const [uid, setUid] = React.useState<string>("");
  const [nome, setNome] = React.useState("");
  const [cnpj, setCnpj] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string>("");

  React.useEffect(() => {
    const { auth } = initializeFirebase();
    return onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? "");
      setEmail(u?.email ?? "");
    });
  }, []);

  async function handleCreate() {
    setMsg("");
    if (!uid) {
      setMsg("Você precisa estar logado para criar o condomínio.");
      return;
    }
    if (!nome.trim()) {
      setMsg("Informe o nome do condomínio.");
      return;
    }

    setLoading(true);
    try {
      const { firestore } = initializeFirebase();

      // 1) cria condomínio
      const ref = await addDoc(collection(firestore, "condominios"), {
        nome: nome.trim(),
        cnpj: cnpj.trim() || null,
        ativo: true,
        createdAt: serverTimestamp(),
        createdBy: uid,
      });

      // 2) cria vínculo do usuário dentro do condomínio
      await setDoc(doc(firestore, "condominios", ref.id, "membros", uid), {
        uid,
        email: email || null,
        role: "ADMIN", // ou "SINDICO" se preferir
        status: "ATIVO",
        createdAt: serverTimestamp(),
      });

      setMsg(`✅ Condomínio criado: ${ref.id}. Você foi vinculado como ADMIN.`);
    } catch (e: any) {
      console.error(e);
      setMsg(`❌ Erro: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border bg-card shadow-sm p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Seed do TreeCondo</h1>
          <p className="text-sm text-muted-foreground">
            Crie o primeiro condomínio e se vincule automaticamente como ADMIN.
          </p>
        </div>

        <div className="text-sm rounded-lg bg-muted p-3">
          <div><span className="font-medium">Logado como:</span> {email || "(sem email)"} </div>
          <div className="truncate"><span className="font-medium">UID:</span> {uid || "(não logado)"} </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nome do condomínio</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Condomínio Jardim..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">CNPJ (opcional)</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full rounded-md px-4 py-2 font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Criando..." : "Criar condomínio + me vincular"}
          </button>

          {msg ? (
            <p className="text-sm whitespace-pre-wrap">{msg}</p>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          Dica: depois disso, volte para <code>/condominios</code> e recarregue.
        </p>
      </div>
    </div>
  );
}
