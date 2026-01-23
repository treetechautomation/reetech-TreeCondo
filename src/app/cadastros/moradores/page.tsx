"use client";

import * as React from "react";
import Link from "next/link";

import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { initializeFirebase } from "@/firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

import { useSession } from "@/hooks/useSession";
import BlocoSelect from "@/components/condominios/BlocoSelect";

type CondoPublico = { id: string; nome: string };

type Convite = {
  id: string;
  nome?: string;
  email: string;
  condominioId: string;
  tipo: "MORADOR" | "PORTEIRO" | "SINDICO" | "ADMIN";
  bloco?: string | null;
  apartamento?: string | null;
  uidGerado?: string | null;
  acceptedByUid?: string | null;
  acceptedByEmail?: string | null;
  status?: string;
  createdAt?: any;
};

export default function CadastroMoradorPage() {
  const [blocoId, setBlocoId] = React.useState<string>("");
  const { session, isSessionLoading } = useSession();
  const [condos, setCondos] = React.useState<CondoPublico[]>([]);
  const [loadingCondo, setLoadingCondo] = React.useState(true);

  const [condominioId, setCondominioId] = React.useState("");
  const [bloco, setBloco] = React.useState("");
  const [apartamento, setApartamento] = React.useState("");
  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const [convites, setConvites] = React.useState<Convite[]>([]);
  const [loadingConvites, setLoadingConvites] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/condominios-publicos", { cache: "no-store" });
        const json = await res.json();
        if (json?.ok) setCondos(json.data ?? []);
      } catch {
        // silencioso
      } finally {
        setLoadingCondo(false);
      }
    })();
  }, []);

  // Listener realtime dos convites do condomínio selecionado
  React.useEffect(() => {
    if (!condominioId) {
      setConvites([]);
      return;
    }

    const { firestore } = initializeFirebase();
    setLoadingConvites(true);

    const q = query(
      collection(firestore, "convites"),
      where("condominioId", "==", condominioId),
      where("tipo", "==", "MORADOR"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: Convite[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setConvites(items);
        setLoadingConvites(false);
      },
      () => {
        setConvites([]);
        setLoadingConvites(false);
      }
    );

    return () => unsub();
  }, [condominioId]);

  const canUse = !isSessionLoading && !!session;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    if (!canUse) {
      setErr("Sessão não carregada. Faça login novamente.");
      return;
    }
    if (!condominioId) {
      setErr("Selecione o condomínio.");
      return;
    }
    if (!nome.trim() || !email.trim()) {
      setErr("Informe nome e e-mail.");
      return;
    }

    setSaving(true);
    try {
      const { firestore } = initializeFirebase();

      // Cria convite (processado depois por /api/convites/accept)
      await addDoc(collection(firestore, "convites"), {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        condominioId,
        tipo: "MORADOR",

        // (mantendo compatível com seu accept/route.ts)
        bloco: bloco.trim() || null,
        apartamento: apartamento.trim() || null,

        // opcional: se você quiser usar esse BlocoSelect no futuro:
        blocoId: blocoId || null,

        status: "PENDENTE",
        createdAt: serverTimestamp(),
        createdByUid: session?.user?.uid ?? null,
        createdByEmail: session?.user?.email ?? null,
      });

      setMsg("✅ Convite criado! Após o morador aceitar, você poderá abrir a ficha cadastral.");
      setNome("");
      setEmail("");
      setBloco("");
      setApartamento("");
      setBlocoId("");
    } catch (e: any) {
      setErr(e?.message || "Falha ao cadastrar morador.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout pageTitle="Cadastro de Moradores">
      <div className="max-w-4xl space-y-6">
        <Card className="tc-card">
          <CardHeader>
            <CardTitle className="text-lg">Novo morador (via convite)</CardTitle>
            <CardDescription>
              Crie um convite. Quando o morador aceitar, será criado/atualizado <code>condominios/&lt;condId&gt;/membros/&lt;uid&gt;</code>.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Condomínio</Label>
                  <select
                    className="w-full h-10 rounded-md px-3 tc-input"
                    value={condominioId}
                    onChange={(e) => setCondominioId(e.target.value)}
                    disabled={loadingCondo}
                  >
                    <option value="">{loadingCondo ? "Carregando..." : "Selecione"}</option>
                    {condos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-600">(lista vem de <code>condominiosPublicos</code>)</p>
                </div>

                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input className="tc-input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
                </div>

                <div className="space-y-1">
                  <Label>E-mail</Label>
                  <Input className="tc-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="morador@exemplo.com" type="email" />
                </div>

                <div className="space-y-1">
                  <Label>Bloco (texto)</Label>
                  <Input className="tc-input" value={bloco} onChange={(e) => setBloco(e.target.value)} placeholder="Ex: A" />
                </div>

                <div className="space-y-1">
                  <Label>Apartamento (texto)</Label>
                  <Input className="tc-input" value={apartamento} onChange={(e) => setApartamento(e.target.value)} placeholder="Ex: 302" />
                </div>

                <div className="space-y-1">
                  <Label>Bloco (select - opcional)</Label>
                  <BlocoSelect condominioId={condominioId ?? null} value={blocoId} onChange={setBlocoId} />
                  <p className="text-xs text-slate-600">Opcional (ainda não usado no accept/route.ts).</p>
                </div>
              </div>

              {msg && <p className="text-sm text-emerald-700">{msg}</p>}
              {err && <p className="text-sm text-red-600">{err}</p>}

              <div className="flex gap-2">
                <Button type="submit" disabled={saving} className="tc-btn-primary">
                  {saving ? "Cadastrando..." : "Criar convite"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="tc-btn-soft"
                  onClick={() => {
                    setMsg(null);
                    setErr(null);
                    setNome("");
                    setEmail("");
                    setBloco("");
                    setApartamento("");
                    setBlocoId("");
                  }}
                >
                  Limpar
                </Button>
              </div>

              <div className="text-xs text-slate-600">
                <p><b>Fluxo:</b> cria documento em <code>convites</code> → morador aceita → API <code>/api/convites/accept</code> cria <code>membros/{"{uid}"}</code>.</p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* LISTA DE CONVITES */}
        <Card className="tc-card">
          <CardHeader>
            <CardTitle className="text-lg">Convites de moradores</CardTitle>
            <CardDescription>
              Quando o convite estiver <b>CONCLUIDO</b>, o morador já virou membro e você pode abrir a ficha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!condominioId ? (
              <p className="text-sm text-slate-600">Selecione um condomínio para listar os convites.</p>
            ) : loadingConvites ? (
              <p className="text-sm text-slate-600">Carregando convites...</p>
            ) : convites.length === 0 ? (
              <p className="text-sm text-slate-600">Nenhum convite encontrado.</p>
            ) : (
              <div className="space-y-2">
                {convites.map((c) => {
                  const status = (c.status ?? "PENDENTE").toUpperCase();
                  const uid = c.uidGerado ?? c.acceptedByUid ?? null;
                  const canOpen = status === "CONCLUIDO" && !!uid;

                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3 border rounded-md p-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.nome ?? "-"}</div>
                        <div className="text-xs text-slate-600 truncate">{c.email}</div>
                        <div className="text-xs text-slate-600">
                          Status: <b>{status}</b>{" "}
                          {uid ? (
                            <>
                              — UID: <code>{uid}</code>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="tc-btn-soft"
                          type="button"
                          onClick={() => navigator.clipboard.writeText(c.id)}
                        >
                          Copiar ID
                        </Button>

                        {canOpen ? (
                          <Link href={`/cadastros/moradores/${condominioId}/${uid}/ficha`}>
                            <Button className="tc-btn-primary">Abrir Ficha</Button>
                          </Link>
                        ) : (
                          <Button disabled variant="outline" className="tc-btn-soft" type="button">
                            Aguardando aceite
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
