"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";

const MOCK_EVENTS = {
    "2024-08-10": [{ title: "Limpeza Caixa D'água", category: "CAIXA_DAGUA" }],
    "2024-08-15": [{ title: "Manutenção Elevador B", category: "ELEVADOR" }],
    "2024-08-22": [{ title: "Dedetização Geral", category: "DEDETIZACAO" }],
    "2024-09-01": [{ title: "Recarga Extintores", category: "EXTINTORES" }],
};

const CATEGORY_COLORS: Record<string, string> = {
    DEDETIZACAO: "bg-red-200 text-red-800",
    CAIXA_DAGUA: "bg-blue-200 text-blue-800",
    ELEVADOR: "bg-yellow-200 text-yellow-800",
    EXTINTORES: "bg-orange-200 text-orange-800",
    OUTROS: "bg-gray-200 text-gray-800",
}

function toISODate(date: Date){
    return date.toISOString().split('T')[0];
}

export default function CalendarioManutencaoPage() {
    const [date, setDate] = React.useState<Date | undefined>(new Date());

  return (
    <AppLayout pageTitle="Calendário de Manutenções">
      <Card>
        <CardHeader>
          <CardTitle>Calendário</CardTitle>
          <CardDescription>
            Visualize as manutenções programadas para o condomínio.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 flex justify-center">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="rounded-md border"
                    components={{
                        DayContent: ({ date }) => {
                            const iso = toISODate(date);
                            const events = (MOCK_EVENTS as any)[iso];
                            return (
                                <div className="relative h-full w-full">
                                    <p>{date.getDate()}</p>
                                    {events && (
                                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                                            {events.map((e: any, i: number) => (
                                                <div key={i} className={`h-1.5 w-1.5 rounded-full ${CATEGORY_COLORS[e.category] || CATEGORY_COLORS.OUTROS}`} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        }
                    }}
                />
            </div>
            <div className="w-full md:w-1/3">
                <h4 className="font-semibold mb-3">Eventos do dia:</h4>
                <div className="space-y-3">
                    {date && (MOCK_EVENTS as any)[toISODate(date)] ? (
                        (MOCK_EVENTS as any)[toISODate(date)].map((event: any, i: number) => (
                            <div key={i} className="p-3 rounded-md border bg-muted/50">
                                <Badge className={`${CATEGORY_COLORS[event.category]}`}>{event.category.replace("_", " ")}</Badge>
                                <p className="font-medium mt-1">{event.title}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground">Nenhum evento para a data selecionada.</p>
                    )}
                </div>
            </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
