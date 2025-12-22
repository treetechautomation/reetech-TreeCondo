"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useCondominio } from "@/contexts/CondominioContext";
import { useFirestore } from "@/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

type MembroRole = "MORADOR" | "SINDICO" | "PORTEIRO" | "FUNCIONARIO";

type Membro = {
  id: string;
  nome: string;
  email: string;
  role: MembroRole;
  blocoId?: string | null;
  unidadeId?: string | null;
};

export default function PessoasPage() {
  const { condominioAtivoId } = useCondominio();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    role: "MORADOR" as MembroRole,
  });

  // ---------------------------------------------------------------------------
  // LISTAGEM EM TEMPO REAL
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!firestore || !condominioAtivoId) {
      setMembros([]);
      return;
    }

    setLoading(true);

    const colRef = collection(
      firestore,
      `condominios/${condominioAtivoId}/membros`
    );

    const q = query(colRef, orderBy("nome"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: Membro[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            nome: data.nome ?? "",
            email: data.email ?? "",
            role: (data.role ?? "MORADOR") as MembroRole,
            blocoId: data.blocoId ?? null,
            unidadeId: data.unidadeId ?? null,
          };
        });
        setMembros(items);
        setLoading(false);
      },
      (err) => {
        console.error("[Pessoas] erro ao ouvir membros:", err);
        toast({
          variant: "destructive",
          title: "Erro ao carregar moradores",
          description: "Verifique suas permissões de acesso.",
        });
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, condominioAtivoId, toast]);

  // ---------------------------------------------------------------------------
  // CADASTRAR MORADOR / MEMBRO
  // ---------------------------------------------------------------------------
  const handleSave = async () => {
    if (!firestore || !condominioAtivoId) {
      toast({
        variant: "destructive",
        title: "Selecione um condomínio para continuar.",
      });
      return;
    }

    if (!form.nome.trim() || !form.email.trim()) {
      toast({
        variant: "destructive",
        title: "Preencha nome e e-mail.",
      });
      return;
    }

    try {
      const colRef = collection(
        firestore,
        `condominios/${condominioAtivoId}/membros`
      );
      const newDoc = doc(colRef); // Firestore gera um ID automático

      await setDoc(newDoc, {
        nome: form.nome.trim(),
        email: form.email.trim(),
        role: form.role,
        // Aqui depois podemos adicionar blocoId / unidadeId
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setForm({
        nome: "",
        email: "",
        role: "MORADOR",
      });

      toast({ title: "Morador cadastrado com sucesso." });
    } catch (err: any) {
      console.error("[Pessoas] erro ao salvar membro:", err);
      toast({
        variant: "destructive",
        title: "Erro ao salvar morador",
        description: err?.message ?? "Tente novamente.",
      });
    }
  };

  // ---------------------------------------------------------------------------
  // TORNAR SÍNDICO
  // ---------------------------------------------------------------------------
  const handlePromoverSindico = async (m: Membro) => {
    if (!firestore || !condominioAtivoId) return;

    try {
      const ref = doc(
        firestore,
        `condominios/${condominioAtivoId}/membros/${m.id}`
      );

      await updateDoc(ref, {
        role: "SINDICO",
        updatedAt: new Date().toISOString(),
      });

      toast({ title: `${m.nome} agora é síndico.` });
    } catch (err: any) {
      console.error("[Pessoas] erro ao promover síndico:", err);
      toast({
        variant: "destructive",
        title: "Erro ao tornar síndico",
        description:
          "Verifique se você é Super Admin ou Síndico do condomínio.",
      });
    }
  };

  const HeaderActions = () => null;

  return (
    <AppLayout pageTitle="Moradores / Síndicos" headerActions={<HeaderActions />}>
      <div className="space-y-8">
        {!condominioAtivoId && (
          <div className="mb-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Selecione um condomínio para gerenciar moradores.
          </div>
        )}

        {/* FORMULÁRIO */}
        <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Cadastrar morador</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Input
              placeholder="Nome completo"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
            <Input
              placeholder="E-mail"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({ ...f, role: e.target.value as MembroRole }))
              }
            >
              <option value="MORADOR">Morador</option>
              <option value="SINDICO">Síndico</option>
              <option value="PORTEIRO">Porteiro</option>
              <option value="FUNCIONARIO">Funcionário</option>
            </select>
            <Button onClick={handleSave} disabled={!condominioAtivoId || loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        {/* LISTA */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">
            Moradores cadastrados
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : membros.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center">
                    Nenhum morador cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                membros.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>
                      {m.role === "MORADOR"
                        ? "Morador"
                        : m.role === "SINDICO"
                        ? "Síndico"
                        : m.role === "PORTEIRO"
                        ? "Porteiro"
                        : "Funcionário"}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      {m.role !== "SINDICO" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePromoverSindico(m)}
                        >
                          Tornar síndico
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
