"use client";

import {
  Clock,
  ArrowRightLeft,
  FileDown,
  Calendar as CalendarIcon,
  UserPlus
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from 'date-fns/locale';
import React from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const upcomingVisitors = [
  { name: "Ana Silva (Personal)", type: "Recorrente", details: "Seg, Qua, Sex - 08:00", unit: "Apto 101" },
  { name: "Marcos Andrade (Técnico)", type: "Único", details: "28/07/2024", unit: "Apto 304" },
  { name: "Delivery iFood", type: "Único", details: "Hoje, 19:30", unit: "Apto 802" },
];

const accessLog = [
    { name: "Ana Silva", unit: "Apto 101", timeIn: "27/07/2024 08:01", timeOut: "27/07/2024 09:05", status: "Saiu" },
    { name: "Entregador Rappi", unit: "Apto 505", timeIn: "27/07/2024 12:45", timeOut: "27/07/2024 12:50", status: "Saiu" },
    { name: "Visitante - João", unit: "Apto 202", timeIn: "27/07/2024 14:00", timeOut: "-", status: "Dentro" },
];

export default function AcessoPage() {
    const [date, setDate] = React.useState<Date>();

  const HeaderActions = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus />
          <span className="hidden sm:inline-block">Pré-liberar Visita</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Pré-liberar Nova Visita</DialogTitle>
          <DialogDescription>
            Agilize a entrada de seus visitantes e prestadores de serviço.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="visitor-name" className="text-right">
                Nome
            </Label>
            <Input id="visitor-name" placeholder="Nome completo do visitante" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="visitor-doc" className="text-right">
                Documento
            </Label>
            <Input id="visitor-doc" placeholder="CPF ou RG" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">
                Data da Visita
            </Label>
                <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                    "col-span-3 justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                        locale={ptBR}
                    />
                </PopoverContent>
            </Popover>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="recurrent" className="text-right">
                Visita Recorrente
            </Label>
            <div className="col-span-3 flex items-center gap-2">
                <Switch id="recurrent" />
                <span className="text-xs text-muted-foreground">Ex: diarista, personal trainer.</span>
            </div>
            </div>
        </div>
        <DialogFooter>
            <Button type="submit">
            <UserPlus className="mr-2" />
            Salvar Liberação
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <AppLayout pageTitle="Controle de Acesso" headerActions={<HeaderActions />}>
        <Tabs defaultValue="upcoming">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
            <TabsList>
                <TabsTrigger value="upcoming"><Clock className="mr-2"/>Próximas</TabsTrigger>
                <TabsTrigger value="log"><ArrowRightLeft className="mr-2"/>Registro</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm"><FileDown className="mr-2" /> Gerar Relatório</Button>
            </div>
            <TabsContent value="upcoming">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className="hidden sm:table-cell">Unidade</TableHead>
                        <TableHead className="hidden md:table-cell">Tipo</TableHead>
                        <TableHead>Detalhes</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {upcomingVisitors.map((visitor) => (
                            <TableRow key={visitor.name}>
                            <TableCell className="font-medium">{visitor.name}</TableCell>
                            <TableCell className="hidden sm:table-cell">{visitor.unit}</TableCell>
                            <TableCell className="hidden md:table-cell">{visitor.type}</TableCell>
                            <TableCell>{visitor.details}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            </TabsContent>
            <TabsContent value="log">
                <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className="hidden sm:table-cell">Unidade</TableHead>
                        <TableHead>Entrada</TableHead>
                        <TableHead className="hidden md:table-cell">Saída</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {accessLog.map((log) => (
                            <TableRow key={log.name + log.timeIn}>
                            <TableCell className="font-medium">{log.name}</TableCell>
                            <TableCell className="hidden sm:table-cell">{log.unit}</TableCell>
                            <TableCell>{log.timeIn}</TableCell>
                            <TableCell className="hidden md:table-cell">{log.timeOut}</TableCell>
                            <TableCell>
                                <Badge variant={log.status === 'Dentro' ? 'default' : 'secondary'}>{log.status}</Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            </TabsContent>
        </Tabs>
    </AppLayout>
  );
}
