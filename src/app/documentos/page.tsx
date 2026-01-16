"use client";

import {
  Upload,
  Download,
  Eye,
  FileUp,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";


const balancetes = [
    {
        name: "Balancete Mensal - Junho 2024",
        date: "05/07/2024",
        size: "1.2 MB",
    },
    {
        name: "Balancete Mensal - Maio 2024",
        date: "04/06/2024",
        size: "1.1 MB",
    },
    {
        name: "Balancete Mensal - Abril 2024",
        date: "05/05/2024",
        size: "1.3 MB",
    }
];

const atas = [
    {
        name: "Ata da Assembleia Geral Ordinária - 30/07/2024",
        date: "01/08/2024",
        size: "800 KB",
    },
    {
        name: "Ata da Reunião do Conselho - 15/05/2024",
        date: "16/05/2024",
        size: "450 KB",
    },
];

const regimento = [
     {
        name: "Regimento Interno - Versão 2023",
        date: "10/01/2023",
        size: "2.5 MB",
    },
    {
        name: "Convenção do Condomínio - Versão 2020",
        date: "15/02/2020",
        size: "3.1 MB",
    }
]


export default function DocumentosPage() {

  const HeaderActions = () => (
     <Dialog>
        <DialogTrigger asChild>
          <Button size="sm">
            <Upload />
            <span className="hidden sm:inline-block">Carregar Documento</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Carregar Novo Documento</DialogTitle>
            <DialogDescription>
              Faça o upload de um novo documento para o condomínio.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="doc-name" className="text-right">
                Nome
              </Label>
              <Input id="doc-name" placeholder="Ex: Balancete de Agosto 2024" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="doc-type" className="text-right">
                Tipo
              </Label>
              <Select>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balancete">Balancete</SelectItem>
                  <SelectItem value="ata">Ata</SelectItem>
                  <SelectItem value="regimento">Regimento/Convenção</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
              <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Arquivo</Label>
              <div className="col-span-3">
                  <Button variant="outline">
                      <FileUp className="mr-2" />
                      Selecionar Arquivo
                  </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">
              <Upload className="mr-2" />
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );

  return (
    <AppLayout pageTitle="Documentos do Condomínio" headerActions={<HeaderActions />}>
        <div className="rounded-2xl border-black/5 bg-white/55 backdrop-blur-xl p-6 shadow-sm">
            <Tabs defaultValue="balancetes">
                <TabsList>
                <TabsTrigger value="balancetes">Balancetes</TabsTrigger>
                <TabsTrigger value="atas">Atas</TabsTrigger>
                <TabsTrigger value="regimento">Regimento</TabsTrigger>
                </TabsList>
                <TabsContent value="balancetes">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome do Arquivo</TableHead>
                            <TableHead className="hidden sm:table-cell w-[150px]">Publicação</TableHead>
                            <TableHead className="hidden md:table-cell w-[120px]">Tamanho</TableHead>
                            <TableHead className="w-[180px] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {balancetes.map((doc) => (
                                <TableRow key={doc.name}>
                                <TableCell className="font-medium">{doc.name}</TableCell>
                                <TableCell className="hidden sm:table-cell">{doc.date}</TableCell>
                                <TableCell className="hidden md:table-cell">{doc.size}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="icon"><Eye /></Button>
                                    <Button variant="secondary" size="icon"><Download /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </TabsContent>
                <TabsContent value="atas">
                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome do Arquivo</TableHead>
                            <TableHead className="hidden sm:table-cell w-[150px]">Publicação</TableHead>
                            <TableHead className="hidden md:table-cell w-[120px]">Tamanho</TableHead>
                            <TableHead className="w-[180px] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {atas.map((doc) => (
                                <TableRow key={doc.name}>
                                <TableCell className="font-medium">{doc.name}</TableCell>
                                <TableCell className="hidden sm:table-cell">{doc.date}</TableCell>
                                <TableCell className="hidden md:table-cell">{doc.size}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="icon"><Eye /></Button>
                                    <Button variant="secondary" size="icon"><Download /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </TabsContent>
                <TabsContent value="regimento">
                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome do Arquivo</TableHead>
                            <TableHead className="hidden sm:table-cell w-[150px]">Publicação</TableHead>
                            <TableHead className="hidden md:table-cell w-[120px]">Tamanho</TableHead>
                            <TableHead className="w-[180px] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {regimento.map((doc) => (
                                <TableRow key={doc.name}>
                                <TableCell className="font-medium">{doc.name}</TableCell>
                                <TableCell className="hidden sm:table-cell">{doc.date}</TableCell>
                                <TableCell className="hidden md:table-cell">{doc.size}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="outline" size="icon"><Eye /></Button>
                                    <Button variant="secondary" size="icon"><Download /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </TabsContent>
            </Tabs>
        </div>
    </AppLayout>
  );
}
