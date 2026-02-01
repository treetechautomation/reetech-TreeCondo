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
import { FileText, Calendar, Users, AlertTriangle, CheckCircle, Clock } from "lucide-react";

export default function ManutencaoPreventivaPage() {
  const summaryCards = [
    { title: "Próximas 7 dias", value: "3", icon: <Clock className="h-4 w-4 text-muted-foreground" /> },
    { title: "Atrasadas", value: "1", icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" /> },
    { title: "Concluídas no mês", value: "5", icon: <CheckCircle className="h-4 w-4 text-muted-foreground" /> },
  ];

  const navCards = [
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
        <div className="grid gap-4 md:grid-cols-3">
            {summaryCards.map(card => (
                 <Card key={card.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                        {card.icon}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{card.value}</div>
                    </CardContent>
                </Card>
            ))}
        </div>

        <Card className="border-black/5 bg-white/60 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Acesso Rápido</CardTitle>
            <CardDescription>
              Navegue pelas seções do módulo de manutenção.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {navCards.map((card) => (
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
