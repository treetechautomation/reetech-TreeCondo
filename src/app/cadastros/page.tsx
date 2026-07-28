"use client";

import * as React from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { SectionCard } from "@/components/layout/SectionCard";
import { Button } from "@/components/ui/button";

export default function CadastrosPage() {
  return (
    <AppLayout pageTitle="Gestão de Cadastros">
      <div className="space-y-6">
        <SectionCard title="Cadastros" description="Acesse os módulos de cadastro. (Seleção de condomínio pode ser feita dentro de cada módulo, se aplicável.)">
          <div className="flex flex-wrap gap-3">
            <Link href="/cadastros/pessoas">
              <Button className="min-w-[200px]">Pessoas / Moradores</Button>
            </Link>

            <Link href="/cadastros/estrutura">
              <Button variant="outline" className="min-w-[200px] border-primary text-primary hover:bg-primary/10">Blocos e Unidades</Button>
            </Link>

            <Link href="/cadastros/procuracoes">
              <Button variant="outline" className="min-w-[200px] border-primary text-primary hover:bg-primary/10">Procurações</Button>
            </Link>
          </div>
        </SectionCard>
      </div>
    </AppLayout>
  );
}
