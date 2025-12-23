"use client";

import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

export default function Dashboard() {
  return (
    <AppLayout pageTitle="Painel">
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Novas Encomendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              Aguardando retirada na portaria
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Incidentes Abertos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">
              +2 da semana passada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Próximas Reservas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">
              Salão de festas e churrasqueira neste fim de semana
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Próxima Assembleia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">30 de Julho</div>
            <p className="text-xs text-muted-foreground">
              Assembleia Geral Ordinária
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
