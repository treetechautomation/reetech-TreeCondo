"use client";

import {
  PlusCircle,
  QrCode,
  PackageCheck,
  Camera,
  Clock,
  History,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const waitingPackages = [
    { id: "PKG001", unit: "Apto 101", carrier: "Correios", arrival: "28/07/2024 10:30", code: "A1B2C3D4" },
    { id: "PKG002", unit: "Apto 504", carrier: "Mercado Livre", arrival: "28/07/2024 14:00", code: "E5F6G7H8" },
    { id: "PKG003", unit: "Apto 802", carrier: "Amazon", arrival: "27/07/2024 18:15", code: "I9J0K1L2" },
];

const deliveredPackages = [
    { id: "PKG004", unit: "Apto 202", carrier: "FedEx", arrival: "26/07/2024 11:00", pickup: "26/07/2024 19:00", by: "Maria Oliveira" },
    { id: "PKG005", unit: "Apto 301", carrier: "DHL", arrival: "25/07/2024 09:20", pickup: "25/07/2024 12:30", by: "João da Silva" },
]


export default function EncomendasPage() {

  const HeaderActions = () => (
     <Dialog>
        <DialogTrigger asChild>
          <Button size="sm">
            <PlusCircle />
            <span className="hidden sm:inline-block">Registrar Encomenda</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Registrar Nova Encomenda</DialogTitle>
            <DialogDescription>
              Insira os dados da encomenda e notifique o morador.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unit" className="text-right">
                Unidade
              </Label>
              <Input id="unit" placeholder="Ex: Apto 101" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="carrier" className="text-right">
                Transportadora
              </Label>
                <Input id="carrier" placeholder="Ex: Correios, Mercado Livre" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Foto</Label>
              <div className="col-span-3">
                  <Button variant="outline">
                      <Camera className="mr-2" />
                      Tirar Foto do Pacote
                  </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">
              <PackageCheck className="mr-2"/>
              Registrar e Notificar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );

  return (
    <AppLayout pageTitle="Gestão de Encomendas" headerActions={<HeaderActions />}>
        <Tabs defaultValue="waiting">
            <TabsList className="mb-4">
                <TabsTrigger value="waiting"><Clock className="mr-2" />Aguardando</TabsTrigger>
                <TabsTrigger value="history"><History className="mr-2" />Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="waiting">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="hidden sm:table-cell">Cód.</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Chegada</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {waitingPackages.map((pkg) => (
                        <TableRow key={pkg.id}>
                        <TableCell className="font-mono hidden sm:table-cell">{pkg.id}</TableCell>
                        <TableCell>{pkg.unit}</TableCell>
                        <TableCell>{pkg.arrival}</TableCell>
                        <TableCell className="text-right">
                            <Button variant="outline" size="sm">
                                <QrCode className="mr-2" />
                                <span className="hidden sm:inline-block">Registrar Retirada</span>
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
            </Table>
            </TabsContent>
            <TabsContent value="history">
                <Table>
                <TableHeader>
                    <TableRow>
                            <TableHead className="hidden sm:table-cell">Cód.</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead>Retirada</TableHead>
                            <TableHead className="hidden md:table-cell">Retirado por</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {deliveredPackages.map((pkg) => (
                        <TableRow key={pkg.id}>
                        <TableCell className="font-mono hidden sm:table-cell">{pkg.id}</TableCell>
                        <TableCell>{pkg.unit}</TableCell>
                        <TableCell>{pkg.pickup}</TableCell>
                        <TableCell className="hidden md:table-cell">{pkg.by}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
            </Table>
            </TabsContent>
        </Tabs>
    </AppLayout>
  );
}
