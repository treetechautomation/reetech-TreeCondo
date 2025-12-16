"use client";

import {
  AlertTriangle,
  Archive,
  CalendarDays,
  Users,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Overview } from "@/components/dashboard/overview";
import { RecentAnnouncements } from "@/components/dashboard/recent-announcements";
import { AppLayout } from "@/components/layout/AppLayout";

export default function Dashboard() {

  return (
    <AppLayout pageTitle="Painel">
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Novas Encomendas
              </CardTitle>
              <Archive className="h-4 w-4 text-muted-foreground" />
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
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
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
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
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
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">30 de Julho</div>
              <p className="text-xs text-muted-foreground">
                Assembleia Geral Ordinária
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="mt-4 grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="font-headline">Visão Geral de Incidentes</CardTitle>
            </CardHeader>
            <CardContent className="h-72 pl-2">
              <Overview />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Anúncios Recentes</CardTitle>
              <CardDescription>
                Fique por dentro das últimas notícias.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentAnnouncements />
            </CardContent>
          </Card>
        </div>
    </AppLayout>
  );
}
