"use client";

import * as React from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CadastrosClient() {
  return (
    <AppLayout pageTitle="Gestão de Cadastros">
      <div className="space-y-6">
        <Card className="border-white/20 bg-white/28 backdrop-blur-xl shadow-[0_18px_55px_rgba(2,6,23,0.12)]">
          <CardHeader>
            <CardTitle>Cadastros</CardTitle>
            <CardDescription>
              Acesse os módulos de cadastro. (Seleção de condomínio pode ser feita dentro de cada módulo, se aplicável.)
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-wrap gap-3">
            <Link href="/cadastros/moradores">
              <Button className="min-w-[200px]">Moradores</Button>
            </Link>

            <Link href="/cadastros/pessoas">
              <Button variant="secondary" className="min-w-[200px]">Pessoas</Button>
            </Link>

            <Link href="/condominios">
              <Button variant="outline" className="min-w-[200px]">Condomínios</Button>
            </Link>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-dashed border-black/10 bg-white/40 p-10 text-center text-slate-600">
          Se você quiser, eu encaixo aqui um “Seletor de Condomínio” padrão (bem bonito) e ele passa o condomínio
          selecionado para os módulos.
        </div>
      </div>
    </AppLayout>
  );
}
