"use client";

import * as React from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, HardHat, Users } from "lucide-react";

export default function ManutencaoPreventivaPage() {
  const cards = [
    {
      title: "Rotinas",
      description: "Cadastre e gerencie as manutenções recorrentes.",
      href: "/manutencao-preventiva/rotinas",
      icon: <FileText />,
    },
    {
      title: "Calendário",
      description: "Visualize as datas programadas no calendário.",
      href: "/manutencao-preventiva/calendario",
      icon: <Calendar />,
    },
    {
      title: "Fornecedores",
      description: "Gerencie os fornecedores de serviços.",
      href: "/manutencao-preventiva/fornecedores",
      icon: <Users />,
    },
  ];

  return (
    <AppLayout pageTitle="Manutenção Preventiva">
      <div className="space-y-6">
        <Card className="border-black/5 bg-white/60 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Plano de Manutenção Preventiva</CardTitle>
            <CardDescription>
              Gerencie as rotinas de manutenção para garantir o bom funcionamento do
              condomínio e a segurança de todos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Utilize os módulos abaixo para cadastrar rotinas (como limpeza de
              caixa d'água, manutenção de elevadores), visualizar o calendário
              de execuções e gerenciar os fornecedores.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Card
              key={card.href}
              className="border-black/5 bg-white/60 backdrop-blur-md hover:bg-white/80 transition-all"
            >
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  {card.icon}
                </div>
                <div>
                  <CardTitle>{card.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {card.description}
                </p>
                <Button asChild variant="outline">
                  <Link href={card.href}>Acessar</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
