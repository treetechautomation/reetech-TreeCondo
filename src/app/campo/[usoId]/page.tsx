"use client";

/** FASE 16.18 / R6 — /campo/[usoId] — Detalhe + Convidados + Saldo */

import * as React from "react";
import { useParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { useCondominio } from "@/contexts/CondominioContext";
import { useFirestore } from "@/firebase";
import { doc, getDoc, collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, UserPlus, Trash2, CheckCircle, Clock, Ban } from "lucide-react";

function GuestStatus({ status }: { status: string }) {
  if (status === "RESERVADO") return <span className="text-amber-600"><Clock className="h-3 w-3 inline mr-1"/> Aguardando entrada</span>;
  if (status === "CONSUMIDO") return <span className="text-emerald-600"><CheckCircle className="h-3 w-3 inline mr-1"/> Entrou</span>;
  return <span className="text-muted-foreground"><Ban className="h-3 w-3 inline mr-1"/> Liberado</span>;
}

export default function CampoDetailPage() {
  const p = useParams(); const usoId = String(p?.usoId ?? "");
  const { condominioAtivoId: condId } = useCondominio();
  const firestore = useFirestore();
  const [uso, setUso] = React.useState<any>(null);
  const [convidados, setConvidados] = React.useState<any[]>([]);
  const [saldo, setSaldo] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [nome, setNome] = React.useState("");
  const [docStr, setDocStr] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [requestKey] = React.useState(() => Math.random().toString(36).slice(2));
  const [msg, setMsg] = React.useState("");

  React.useEffect(() => {
    if (!firestore || !condId || !usoId) return;
    getDoc(doc(firestore, "condominios", condId, "usoCampo", usoId)).then(s => { if (s.exists()) setUso({ id: s.id, ...s.data() }); setLoading(false); });
    const unsub = onSnapshot(query(collection(firestore, "condominios", condId, "usoCampo", usoId, "convidados"), orderBy("criadoEm", "asc")), snap => setConvidados(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [firestore, condId, usoId]);

  React.useEffect(() => { if (firestore && condId) fetch(`/api/convidados/saldo?condominioId=${condId}`).then(r => r.json().then(setSaldo).catch(() => {})); }, [firestore, condId]);

  async function handleAdd() { if (!nome) return; setAdding(true); setMsg("");
    try { const r = await fetch(`/api/campo/${usoId}/convidados/adicionar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ condominioId: condId, nome, documento: docStr || null, requestKey }) }); if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Erro"); } setNome(""); setDocStr(""); } catch (e: any) { setMsg(e.message); } finally { setAdding(false); }
  }

  async function handleRemove(convidadoId: string) { await fetch(`/api/campo/${usoId}/convidados/remover`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ condominioId: condId, convidadoId }) }); }

  if (loading) return <AppLayout><div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div></AppLayout>;
  if (!uso) return <AppLayout><div className="p-12 text-center text-muted-foreground">Uso não encontrado.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">{uso.dateStr} — {uso.horaInicio} às {uso.horaFim}</h1><p className="text-muted-foreground">{uso.status}</p></div>

        {saldo && (<Card><CardHeader><CardTitle className="text-base">Saldo mensal de convidados</CardTitle></CardHeader><CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            {[{ l:"Total",v:saldo.total,c:"text-foreground"},{l:"Disponível",v:saldo.disponivel,c:"text-emerald-600"},{l:"Reservado",v:saldo.reservado,c:"text-amber-600"},{l:"Utilizado",v:saldo.consumido,c:"text-blue-600"}].map(k => (<div key={k.l}><p className="text-xs text-muted-foreground">{k.l}</p><p className={`text-2xl font-bold ${k.c}`}>{k.v}</p></div>))}
          </div>
        </CardContent></Card>)}

        {uso.status === "ATIVO" && (
          <Card><CardHeader><CardTitle className="text-base">Adicionar convidado</CardTitle></CardHeader><CardContent className="space-y-3">
            {msg && <p className="text-sm text-destructive">{msg}</p>}
            <Input placeholder="Nome *" value={nome} onChange={e => setNome(e.target.value)} />
            <Input placeholder="Documento / CPF (opcional)" value={docStr} onChange={e => setDocStr(e.target.value)} />
            <Button onClick={handleAdd} disabled={adding || !nome}><UserPlus className="h-4 w-4 mr-2"/>{adding ? "Adicionando..." : "Adicionar convidado"}</Button>
          </CardContent></Card>
        )}

        <Card><CardHeader><CardTitle className="text-base">Convidados ({convidados.length})</CardTitle></CardHeader><CardContent>
          {convidados.length === 0 ? <p className="text-muted-foreground text-sm">Nenhum convidado.</p> : (
            <div className="space-y-2">
              {convidados.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div><p className="font-medium text-sm">{c.nome}</p><p className="text-xs"><GuestStatus status={c.status} /></p></div>
                  {c.status === "RESERVADO" && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleRemove(c.id)}><Trash2 className="h-3 w-3"/></Button>}
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
      </div>
    </AppLayout>
  );
}
