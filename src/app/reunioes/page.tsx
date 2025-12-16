"use client";

import * as React from "react";
import {
  PlusCircle,
  FileDown,
  Calendar as CalendarIcon,
  CalendarDays,
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ReunioesPage() {
  const [date, setDate] = React.useState<Date>();

  const HeaderActions = () => (
     <Dialog>
        <DialogTrigger asChild>
          <Button size="sm">
            <PlusCircle />
            <span className="hidden sm:inline-block">Nova Reunião</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Agendar Nova Reunião</DialogTitle>
            <DialogDescription>
              Preencha os detalhes para agendar uma nova reunião e notificar os moradores.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Título
              </Label>
              <Input id="title" placeholder="Ex: Assembleia Geral Ordinária" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Data
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
                <Label className="text-right">Horário</Label>
                <div className="col-span-3 grid grid-cols-2 gap-2">
                  <Input id="start-time" type="time" />
                  <Input id="end-time" type="time" />
                </div>
            </div>
              <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">
                Local
              </Label>
              <Select>
                  <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Selecione o espaço" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="salao">Salão de Festas</SelectItem>
                      <SelectItem value="reunioes">Sala de Reuniões</SelectItem>
                      <SelectItem value="churrasqueira">Churrasqueira</SelectItem>
                  </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="agenda" className="text-right">
                Pautas
              </Label>
              <Textarea id="agenda" placeholder="1. Aprovação de contas&#x0a;2. Eleição de síndico&#x0a;3. Assuntos gerais" className="col-span-3" rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">
              <CalendarDays className="mr-2" />
              Agendar e Notificar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );

  return (
    <AppLayout pageTitle="Reuniões" headerActions={<HeaderActions />}>
        <div className="space-y-4">
              <Card>
                  <CardHeader>
                      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                          <div>
                              <CardTitle>Assembleia Geral Ordinária</CardTitle>
                              <CardDescription>Agendada para 30 de Julho de 2024, às 19:00 - Salão de Festas</CardDescription>
                          </div>
                          <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm">
                                      <FileDown className="mr-2" />
                                      Gerar Documentos
                                  </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                  <DropdownMenuItem>Protocolo de Convocação</DropdownMenuItem>
                                  <DropdownMenuItem>Lista de Presença</DropdownMenuItem>
                                  <DropdownMenuItem>Carta de Convocação (Modelo)</DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
                      </div>
                  </CardHeader>
                  <CardContent>
                      <h4 className="font-semibold mb-2">Pautas:</h4>
                      <ul className="list-disc pl-5 text-muted-foreground">
                          <li>Aprovação das contas do último exercício.</li>
                          <li>Eleição do novo síndico e conselho fiscal.</li>
                          <li>Previsão orçamentária para o próximo ano.</li>
                          <li>Assuntos gerais.</li>
                      </ul>
                  </CardContent>
              </Card>
                <Card>
                  <CardHeader>
                      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                          <div>
                              <CardTitle>Reunião do Conselho Fiscal</CardTitle>
                              <CardDescription>Agendada para 15 de Agosto de 2024, às 20:00 - Sala de Reuniões</CardDescription>
                          </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" disabled>
                                      <FileDown className="mr-2" />
                                      Gerar Documentos
                                  </Button>
                              </DropdownMenuTrigger>
                          </DropdownMenu>
                      </div>
                  </CardHeader>
                  <CardContent>
                      <h4 className="font-semibold mb-2">Pautas:</h4>
                        <ul className="list-disc pl-5 text-muted-foreground">
                          <li>Análise dos balancetes de Junho e Julho.</li>
                          <li>Discussão sobre investimentos.</li>
                      </ul>
                  </CardContent>
              </Card>
          </div>
    </AppLayout>
  );
}
