"use client";

import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function RotinasManutencaoPage() {
  return (
    <AppLayout pageTitle="Rotinas de Manutenção">
      <Card>
        <CardHeader>
          <CardTitle>Rotinas</CardTitle>
          <CardDescription>
            Gerencie as rotinas de manutenção preventiva do condomínio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-600">
            (Página em construção. Aqui será exibida a tabela com as rotinas, filtros e o botão para criar uma nova rotina.)
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
