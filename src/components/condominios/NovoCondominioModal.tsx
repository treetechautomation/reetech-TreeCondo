"use client";

import * as React from "react";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { useFirestore } from "@/firebase";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

function parseBlockNames(raw: string) {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function NovoCondominioModal({ open, onOpenChange }: Props) {
  const firestore = useFirestore();

  const [nome, setNome] = React.useState("");
  const [cnpj, setCnpj] = React.useState("");
  const [ativo, setAtivo] = React.useState(true);

  // ✅ NOVO: blocos
  const [blocosCount, setBlocosCount] = React.useState<number>(0);
  const [blocosNames, setBlocosNames] = React.useState<string>(""); // 1 por linha

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setErr(null);
      setOk(null);
      setLoading(false);
      // não zera campos automaticamente pra não perder dados sem querer
    }
  }, [open]);

  async function handleCreate() {
    if (!firestore) {
      setErr("Firestore não inicializado.");
      return;
    }

    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setErr("Informe o nome do condomínio.");
      return;
    }

    setErr(null);
    setOk(null);
    setLoading(true);

    try {
      const condominiosCol = collection(firestore, "condominios");
      const condoRef = doc(condominiosCol); // auto-id

      const namesFromTextarea = parseBlockNames(blocosNames);

      let blocosFinal: string[] = [];
      if (namesFromTextarea.length > 0) {
        blocosFinal = namesFromTextarea;
      } else if (blocosCount > 0) {
        blocosFinal = Array.from({ length: blocosCount }, (_, i) => `Bloco ${i + 1}`);
      }

      const batch = writeBatch(firestore);

      // Doc principal do condomínio
      batch.set(condoRef, {
        nome: nomeTrim,
        cnpj: cnpj.trim() || null,
        ativo: !!ativo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // ✅ opcional: coleção pública (se você usa /api/condominios-publicos)
      const publicoRef = doc(firestore, "condominiosPublicos", condoRef.id);
      batch.set(
        publicoRef,
        {
          nome: nomeTrim,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Subcoleção de blocos
      if (blocosFinal.length > 0) {
        for (const blocoNome of blocosFinal) {
          const blocoRef = doc(firestore, "condominios", condoRef.id, "blocos", blocoNome);
          batch.set(blocoRef, {
            nome: blocoNome,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();

      setOk(
        blocosFinal.length > 0
          ? `✅ Condomínio criado com ${blocosFinal.length} bloco(s).`
          : "✅ Condomínio criado (sem blocos)."
      );

      // limpa campos
      setNome("");
      setCnpj("");
      setAtivo(true);
      setBlocosCount(0);
      setBlocosNames("");

      // fecha modal depois de um instante
      setTimeout(() => onOpenChange(false), 500);
    } catch (e: any) {
      setErr(e?.message || "Falha ao criar condomínio.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] tc-dialog-center">
        <DialogHeader>
          <DialogTitle>Novo Condomínio</DialogTitle>
          <DialogDescription>
            Cadastre o condomínio e (opcionalmente) crie os blocos automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Nome do condomínio</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Residencial Jardim" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">CNPJ (opcional)</label>
              <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Status</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={ativo ? "default" : "secondary"}
                  onClick={() => setAtivo(true)}
                  className="w-full"
                >
                  Ativo
                </Button>
                <Button
                  type="button"
                  variant={!ativo ? "default" : "secondary"}
                  onClick={() => setAtivo(false)}
                  className="w-full"
                >
                  Inativo
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-4 bg-muted/30">
            <div className="text-sm font-semibold mb-1">Blocos</div>
            <div className="text-xs text-muted-foreground mb-3">
              Você pode informar <b>quantidade</b> ou os <b>nomes</b> (1 por linha). Se você preencher os nomes, a quantidade é ignorada.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Quantidade de blocos</label>
                <Input
                  type="number"
                  min={0}
                  value={String(blocosCount)}
                  onChange={(e) => setBlocosCount(Math.max(0, Number(e.target.value || 0)))}
                  placeholder="Ex: 3"
                />
              </div>

              <div className="grid gap-2 md:col-span-2">
                <label className="text-sm font-medium">Nomes dos blocos (1 por linha)</label>
                <Textarea
                  value={blocosNames}
                  onChange={(e) => setBlocosNames(e.target.value)}
                  placeholder={"Bloco A\nBloco B\nBloco C"}
                  className="min-h-[96px]"
                />
              </div>
            </div>
          </div>

          {ok && <div className="text-sm text-emerald-700">{ok}</div>}
          {err && <div className="text-sm text-red-600">{err}</div>}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={loading || !nome.trim()}>
            {loading ? "Salvando..." : "Criar condomínio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NovoCondominioModal;
