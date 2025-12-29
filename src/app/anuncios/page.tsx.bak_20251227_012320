"use client";

import {
  Image as ImageIcon,
  PlusCircle,
  Send,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function AnunciosPage() {
  const [destination, setDestination] = useState("all");

  const HeaderActions = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle />
          <span className="hidden sm:inline-block">Novo Anúncio</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Anúncio</DialogTitle>
          <DialogDescription>
            Envie comunicados para os moradores. O disparo será feito em tempo real.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Título
            </Label>
            <Input id="title" placeholder="Ex: Manutenção da Piscina" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="message" className="text-right">
              Mensagem
            </Label>
            <Textarea id="message" placeholder="Detalhe o seu anúncio aqui." className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Foto</Label>
            <div className="col-span-3">
              <Button variant="outline">
                <ImageIcon className="mr-2" />
                Adicionar Foto
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Destino</Label>
            <RadioGroup
              defaultValue="all"
              className="col-span-3 flex flex-col gap-2"
              onValueChange={setDestination}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="r1" />
                <Label htmlFor="r1">Todo o Condomínio</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tower" id="r2" />
                <Label htmlFor="r2">Bloco ou Torre Específica</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unit" id="r3" />
                <Label htmlFor="r3">Unidade ou Pessoa Específica</Label>
              </div>
            </RadioGroup>
          </div>
          {destination === "tower" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tower-select" className="text-right">
                Bloco/Torre
              </Label>
              <Input id="tower-select" placeholder="Ex: Bloco A" className="col-span-3" />
            </div>
          )}
          {destination === "unit" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unit-select" className="text-right">
                Unidade/Pessoa
              </Label>
              <Input
                id="unit-select"
                placeholder="Ex: Apto 101 ou João Silva"
                className="col-span-3"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="submit">
            <Send className="mr-2" />
            Enviar Notificação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <AppLayout pageTitle="Anúncios" headerActions={<HeaderActions />}>
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-start gap-4">
            <Avatar className="h-10 w-10 border">
              <AvatarImage
                src="https://picsum.photos/seed/admin-1/40/40"
                alt="Avatar"
                data-ai-hint="person face"
              />
              <AvatarFallback>S</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>Manutenção da Piscina Agendada</CardTitle>
              <CardDescription>
                Enviado por Síndico Admin - há 2 dias para Todo o Condomínio
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Prezados moradores, informamos que a piscina será fechada para manutenção anual no
              dia 28 de Julho. Agradecemos a compreensão.
            </p>
            <Image
              src="https://picsum.photos/seed/pool/600/400"
              alt="Piscina em manutenção"
              width={600}
              height={400}
              className="rounded-md object-cover"
              data-ai-hint="swimming pool"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-4">
            <Avatar className="h-10 w-10 border">
              <AvatarImage
                src="https://picsum.photos/seed/admin-1/40/40"
                alt="Avatar"
                data-ai-hint="person face"
              />
              <AvatarFallback>S</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>Controle de Pragas Trimestral</CardTitle>
              <CardDescription>
                Enviado por Síndico Admin - há 5 dias para Todo o Condomínio
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p>
              O controle de pragas trimestral está agendado para 1º de Agosto. Por favor,
              garantam que as áreas comuns e, se necessário, suas unidades, estejam acessíveis
              para a equipe.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
