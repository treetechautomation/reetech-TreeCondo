"use client";

/** FASE 16.18 / R6 — Página /campo — Meus usos do Campo */

import * as React from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useCondominio } from "@/contexts/CondominioContext";
import { useFirestore } from "@/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users } from "lucide-react";

export default function CampoPage() {
  const { session } = useSessionCtx(); const { condominioAtivoId: condId } = useCondominio();
  const firestore = useFirestore();
  const [usos, setUsos] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore || !condId || !session?.user?.uid) return;
    setLoading(true);
    const q = query(collection(firestore, "condominios", condId, "usoCampo"), where("uid", "==", session.user.uid), orderBy("criadoEm", "desc"));
    getDocs(q).then(s => setUsos(s.docs.map(d => ({ id: d.id, ...d.data() })))).finally(() => setLoading(false));
  }, [firestore, condId, session?.user?.uid]);

  if (!condId) return <AppLayout><div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Campo / Quadra</h1><p className="text-muted-foreground">Meus registros de uso do Campo.</p></div>
        {loading ? <Loader2 className="h-6 w-6 animate-spin"/> : !usos.length ? <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum uso registrado.</CardContent></Card> : (
          <div className="grid gap-4">{usos.map((u: any) => (
            <Card key={u.id}>
              <CardHeader className="pb-2"><CardTitle className="text-base flex justify-between"><span>{u.dateStr} — {u.horaInicio} às {u.horaFim}</span><span className={`text-xs px-2 py-1 rounded-full ${u.status === "ATIVO" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{u.status}</span></CardTitle></CardHeader>
              <CardContent>
                <Link href={`/campo/${u.id}`}><Button variant="outline" size="sm"><Users className="h-4 w-4 mr-2"/> Convidados</Button></Link>
              </CardContent>
            </Card>))}</div>
        )}
      </div>
    </AppLayout>
  );
}
