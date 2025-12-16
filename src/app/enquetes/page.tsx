"use client";
import React from 'react';
import {
  PlusCircle,
  BarChart,
  Send,
  Plus,
  ShieldCheck,
  Vote
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

const polls = [
  {
    id: 1,
    title: "Nova pintura para a fachada",
    category: "Votação oficial",
    type: "multiple",
    status: "Aberta",
    legal: true,
    description: "Escolha a cor para a nova pintura da fachada do Bloco A.",
    options: [
      { text: "Branco Neve", votes: 45 },
      { text: "Cinza Urbano", votes: 32 },
      { text: "Areia", votes: 23 },
    ],
    totalVotes: 100,
    endDate: "Encerra em 3 dias"
  },
  {
    id: 2,
    title: "Pesquisa de satisfação da academia",
    category: "Pesquisa de Satisfação",
    type: "descriptive",
    status: "Encerrada",
    legal: false,
    description: "Deixe sua opinião sobre os novos equipamentos da academia.",
    totalVotes: 25,
    endDate: "Encerrada há 1 semana"
  },
   {
    id: 3,
    title: "Coleta de temas para a assembleia",
    category: "Feedback pré-assembleia",
    type: "descriptive",
    status: "Aberta",
    legal: false,
    description: "Quais assuntos você gostaria de discutir na próxima assembleia geral?",
    totalVotes: 15,
    endDate: "Encerra em 10 dias"
  },
];


export default function EnquetesPage() {
    const [responseType, setResponseType] = React.useState("multiple");
    const [options, setOptions] = React.useState(["", ""]);

    const addOption = () => {
        setOptions([...options, ""]);
    }

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    }

    const HeaderActions = () => (
       <Dialog>
        <DialogTrigger asChild>
          <Button>
            <PlusCircle />
            Nova Enquete
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Criar Nova Enquete/Votação</DialogTitle>
            <DialogDescription>
              Configure e lance uma nova pesquisa para os moradores.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="poll-title" className="text-right">
                Título
              </Label>
              <Input id="poll-title" placeholder="Ex: Escolha da nova cor da fachada" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="poll-category" className="text-right">
                Categoria
              </Label>
                <Select>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feedback">Coleta de Feedback pré-assembleia</SelectItem>
                  <SelectItem value="satisfaction">Pesquisa de Satisfação</SelectItem>
                  <SelectItem value="official">Votação Oficial</SelectItem>
                    <SelectItem value="other">Outra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="poll-desc" className="text-right">
                Pergunta
              </Label>
              <Textarea id="poll-desc" placeholder="Descreva a pergunta ou o tema da enquete." className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Tipo de Resposta</Label>
              <RadioGroup defaultValue="multiple" className="col-span-3 flex gap-4" onValueChange={setResponseType}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="multiple" id="r-multi" />
                  <Label htmlFor="r-multi">Múltipla Escolha</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="descriptive" id="r-desc" />
                  <Label htmlFor="r-desc">Descritiva (Opinião)</Label>
                </div>
              </RadioGroup>
            </div>
              {responseType === 'multiple' && (
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right pt-2">Opções</Label>
                  <div className="col-span-3 space-y-2">
                      {options.map((option, index) => (
                          <Input key={index} value={option} onChange={(e) => handleOptionChange(index, e.target.value)} placeholder={`Opção ${index + 1}`} />
                      ))}
                      <Button variant="outline" size="sm" onClick={addOption}><Plus className="mr-2"/> Adicionar opção</Button>
                  </div>
                </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="legal-validity" className="text-right">
                Validade Jurídica
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                  <Switch id="legal-validity" />
                  <span className="text-xs text-muted-foreground">Marque se for uma votação com valor legal (ex: assembleia).</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">
              <Send className="mr-2" />
              Lançar Enquete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

  return (
    <AppLayout pageTitle="Enquetes e Votações" headerActions={<HeaderActions />}>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {polls.map((poll) => (
            <Card key={poll.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                      <CardTitle className="text-lg">{poll.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                          {poll.category}
                          {poll.legal && (
                            <span title="Votação com validade jurídica">
                              <ShieldCheck className="text-primary" />
                            </span>
                          )}
                      </CardDescription>
                  </div>
                  <Badge variant={poll.status === 'Aberta' ? 'default' : 'secondary'}>{poll.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                {poll.type === 'multiple' && poll.options ? (
                  <div className="space-y-3">
                    {poll.options.map(option => {
                      const percentage = poll.totalVotes > 0 ? (option.votes / poll.totalVotes) * 100 : 0;
                      return (
                        <div key={option.text}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">{option.text}</span>
                            <span>{Math.round(percentage)}% ({option.votes} votos)</span>
                          </div>
                          <Progress value={percentage} />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{poll.description}</p>
                )}
              </CardContent>
              <CardFooter className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>{poll.endDate}</span>
                  <Button variant="outline" size="sm">
                      {poll.type === 'multiple' ? <Vote className="mr-2" /> : <BarChart className="mr-2" />}
                      {poll.status === 'Aberta' ? 'Votar' : 'Ver Resultados'}
                  </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
    </AppLayout>
  );
}
