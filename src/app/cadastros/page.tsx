"use client";

import {
  PlusCircle,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";

export default function CadastrosPage() {
  const HeaderActions = () => (
    <Button>
      <PlusCircle className="mr-2" />
      Adicionar
    </Button>
  );

  return (
    <AppLayout pageTitle="Gestão de Cadastros" headerActions={<HeaderActions />}>
        <div>Conteúdo da página de cadastros</div>
    </AppLayout>
  );
}
