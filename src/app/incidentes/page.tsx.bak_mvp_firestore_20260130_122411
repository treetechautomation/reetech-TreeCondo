"use client";

import * as React from "react";
import {
  PlusCircle,
  Paperclip,
  Send,
  Star,
  MessageSquare,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

export default function IncidentesPage() {

  const HeaderActions = () => (
     <Dialog>
        <DialogTrigger asChild>
          <Button size="sm">
            <PlusCircle />
            <span className="hidden sm:inline-block">Abrir Chamado</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Abrir Novo Chamado</DialogTitle>
            <DialogDescription>
              Descreva o seu problema ou sugestão. O gestor será notificado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                Tipo
              </Label>
              <Select>
                  <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Selecione o tipo de solicitação" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="reclamacao">Reclamação</SelectItem>
                      <SelectItem value="manutencao">Manutenção</SelectItem>
                      <SelectItem value="duvida-sugestao">Dúvida/Sugestão</SelectItem>
                  </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Título
              </Label>
              <Input id="title" placeholder="Ex: Lâmpada do corredor queimada" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Descrição
              </Label>
              <Textarea id="description" placeholder="Detalhe o que está acontecendo." className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Foto</Label>
              <div className="col-span-3">
                  <Button variant="outline">
                      <Paperclip className="mr-2" />
                      Anexar Foto
                  </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">
              <Send className="mr-2" />
              Enviar Chamado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );

  return (
    <AppLayout pageTitle="Chamados e Incidentes" headerActions={<HeaderActions />}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-lg">Lâmpada queimada</CardTitle>
                            <CardDescription>Aberto por João (Apto 101) - há 1 dia</CardDescription>
                        </div>
                        <Badge variant="destructive">Manutenção</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">A lâmpada do corredor do 1º andar, em frente ao elevador, está queimada.</p>
                    <Separator className="my-4" />
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold">Histórico</h4>
                          <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Gestor:</span> "Recebido. Encaminhado para o zelador." (há 1 dia)</p>
                          <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Sistema:</span> Chamado aberto. (há 1 dia)</p>
                    </div>
                </CardContent>
                <CardFooter className="justify-between">
                      <Badge>Em Andamento</Badge>
                      <Button variant="outline" size="sm"><MessageSquare className="mr-2" /> Comentar</Button>
                </CardFooter>
            </Card>
              <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-lg">Barulho após as 22h</CardTitle>
                            <CardDescription>Aberto por Maria (Apto 304) - há 3 dias</CardDescription>
                        </div>
                        <Badge variant="secondary">Reclamação</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">O vizinho do 404 está fazendo muito barulho de festa durante a semana.</p>
                      <Separator className="my-4" />
                    <div className="space-y-3">
                          <h4 className="text-sm font-semibold">Histórico</h4>
                          <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Maria (Apto 304):</span> "Obrigada!" (há 2 dias)</p>
                          <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Gestor:</span> "Prezada Maria, o morador foi notificado. Por favor, nos informe caso o problema persista." (há 2 dias)</p>
                          <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Sistema:</span> Chamado aberto. (há 3 dias)</p>
                    </div>
                </CardContent>
                <CardFooter className="justify-between items-center">
                    <Badge variant="default" className="bg-green-600 hover:bg-green-700">Resolvido</Badge>
                    <div className="flex items-center gap-1 text-sm">
                        <span className="text-muted-foreground">Sua Avaliação:</span>
                        <Star className="text-yellow-400 fill-yellow-400" />
                        <Star className="text-yellow-400 fill-yellow-400" />
                        <Star className="text-yellow-400 fill-yellow-400" />
                        <Star className="text-yellow-400 fill-yellow-400" />
                        <Star className="text-muted-foreground" />
                    </div>
                </CardFooter>
            </Card>
              <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-lg">Sugestão de lixeiras</CardTitle>
                            <CardDescription>Aberto por Carlos (Apto 802) - há 5 dias</CardDescription>
                        </div>
                        <Badge>Dúvida/Sugestão</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Sugiro a instalação de lixeiras para coleta seletiva em cada andar.</p>
                      <Separator className="my-4" />
                    <div className="space-y-3">
                          <h4 className="text-sm font-semibold">Histórico</h4>
                          <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Gestor:</span> "Ótima sugestão, Carlos! Levaremos para a próxima reunião de conselho." (há 4 dias)</p>
                          <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Sistema:</span> Chamado aberto. (há 5 dias)</p>
                    </div>
                </CardContent>
                <CardFooter className="justify-between">
                      <Badge>Finalizado</Badge>
                      <Button variant="outline" size="sm" disabled><Star className="mr-2" /> Avaliar</Button>
                </CardFooter>
            </Card>
        </div>
    </AppLayout>
  );
}
