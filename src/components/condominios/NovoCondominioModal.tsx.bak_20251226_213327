"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useFirestore } from "@/firebase";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NovoCondominioModal({ open, onOpenChange }: Props) {
  const firestore = useFirestore();

  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!firestore) return;
    if (!nome.trim()) return;

    setSaving(true);
    try {
      await addDoc(collection(firestore, "condominios"), {
        nome: nome.trim(),
        cnpj: cnpj.trim() || null,
        ativo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNome("");
      setCnpj("");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Novo Condomínio</DialogTitle>
          <DialogDescription>
            Cadastre um novo condomínio na plataforma.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Chácara Itaguaí" />
          </div>
          <div className="grid gap-2">
            <Label>CNPJ (opcional)</Label>
            <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving || !nome.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
