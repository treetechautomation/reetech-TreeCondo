"use client";

import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CalendarioManutencaoPage() {
  return (
    <AppLayout pageTitle="Calendário de Manutenções">
      <Card>
        <CardHeader>
          <CardTitle>Calendário</CardTitle>
          <CardDescription>
            Visualize as manutenções programadas para o condomínio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-600">
            (Página em construção. Aqui será exibido um calendário com as
            datas das manutenções preventivas.)
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
