"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { File, Paperclip } from "lucide-react";


const MOCK_EXECUCOES = [
    { id: "ex1", dataProgramada: "15/07/2024", dataConcluida: "16/07/2024", status: "CONCLUIDA", responsavel: "José (zelador)" },
    { id: "ex2", dataProgramada: "15/06/2024", dataConcluida: "15/06/2024", status: "CONCLUIDA", responsavel: "Pest Control" },
    { id: "ex3", dataProgramada: "15/05/2024", dataConcluida: "15/05/2024", status: "CONCLUIDA", responsavel: "Pest Control" },
];

const MOCK_DOCUMENTOS = [
    { id: "doc1", nome: "Certificado Dedetização Jul-2024.pdf", data: "16/07/2024", tamanho: "1.2 MB"},
    { id: "doc2", nome: "Nota Fiscal Servico Jul-2024.pdf", data: "16/07/2024", tamanho: "300 KB"},
];

export default function RotinaDetalhePage() {
  const params = useParams<{ rotinaId: string }>();
  const rotinaId = params?.rotinaId;

  return (
    <AppLayout pageTitle="Detalhe da Rotina">
        <Tabs defaultValue="resumo" className="space-y-4">
            <TabsList>
                <TabsTrigger value="resumo">Resumo</TabsTrigger>
                <TabsTrigger value="execucoes">Execuções</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
                <TabsTrigger value="fornecedor">Fornecedor</TabsTrigger>
            </TabsList>
            
            <TabsContent value="resumo" className="space-y-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>Dedetização Mensal</CardTitle>
                        <CardDescription>Rotina ID: {rotinaId}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-3 gap-4 text-sm">
                            <div><span className="font-semibold text-muted-foreground">Categoria:</span> <Badge variant="secondary">DEDETIZACAO</Badge></div>
                            <div><span className="font-semibold text-muted-foreground">Status:</span> <Badge className="bg-green-100 text-green-800">ATIVA</Badge></div>
                            <div><span className="font-semibold text-muted-foreground">Recorrência:</span> Mensal</div>
                            <div><span className="font-semibold text-muted-foreground">Próxima Execução:</span> 15/08/2024</div>
                            <div><span className="font-semibold text-muted-foreground">Responsável:</span> Terceiro</div>
                            <div><span className="font-semibold text-muted-foreground">Fornecedor:</span> Pest Control</div>
                        </div>
                        <div>
                             <h4 className="font-semibold text-muted-foreground">Descrição</h4>
                            <p>Serviço de dedetização em todas as áreas comuns do condomínio, incluindo garagens, corredores e áreas de lazer.</p>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            
            <TabsContent value="execucoes">
                <Card>
                    <CardHeader>
                        <CardTitle>Histórico de Execuções</CardTitle>
                        <CardDescription>Acompanhe as manutenções realizadas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data Programada</TableHead>
                                    <TableHead>Data Conclusão</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Responsável</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {MOCK_EXECUCOES.map(ex => (
                                    <TableRow key={ex.id}>
                                        <TableCell>{ex.dataProgramada}</TableCell>
                                        <TableCell>{ex.dataConcluida}</TableCell>
                                        <TableCell><Badge variant={ex.status === "CONCLUIDA" ? "default" : "secondary"}>{ex.status}</Badge></TableCell>
                                        <TableCell>{ex.responsavel}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm">Ver Detalhes</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

             <TabsContent value="documentos">
                <Card>
                    <CardHeader>
                        <CardTitle>Documentos e Anexos</CardTitle>
                        <CardDescription>Certificados, notas fiscais e outros documentos importantes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="space-y-3">
                        {MOCK_DOCUMENTOS.map(doc => (
                             <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <File className="h-6 w-6 text-muted-foreground"/>
                                    <div>
                                        <p className="font-medium">{doc.nome}</p>
                                        <p className="text-sm text-muted-foreground">Enviado em {doc.data} • {doc.tamanho}</p>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm">Baixar</Button>
                            </div>
                        ))}
                       </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="fornecedor">
                <Card>
                    <CardHeader>
                        <CardTitle>Fornecedor Associado</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                        <p><span className="font-semibold text-muted-foreground">Nome:</span> Pest Control Ltda.</p>
                        <p><span className="font-semibold text-muted-foreground">Serviço:</span> Controle de Pragas</p>
                        <p><span className="font-semibold text-muted-foreground">Contato:</span> (11) 98765-4321</p>
                    </CardContent>
                </Card>
            </TabsContent>

        </Tabs>
    </AppLayout>
  );
}
