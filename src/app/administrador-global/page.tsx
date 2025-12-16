"use client";

import {
  Home,
  UserCheck,
  User,
  DoorOpen,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClaims } from "@/firebase"; // vem do provider.tsx atualizado

const modules = [
  { id: "painel", name: "Painel", icon: Home, roles: { sindico: true, morador: true, porteiro: true } },
  { id: "anuncios", name: "Anúncios", icon: "Megaphone", roles: { sindico: true, morador: true, porteiro: false } },
  { id: "reservas", name: "Reservas", icon: "CalendarDays", roles: { sindico: true, morador: true, porteiro: false } },
  { id: "reunioes", name: "Reuniões", icon: "Users", roles: { sindico: true, morador: true, porteiro: false } },
  { id: "incidentes", name: "Incidentes", icon: "AlertTriangle", roles: { sindico: true, morador: true, porteiro: true } },
  { id: "encomendas", name: "Encomendas", icon: "Package", roles: { sindico: true, morador: true, porteiro: true } },
  { id: "documentos", name: "Documentos", icon: "FileText", roles: { sindico: true, morador: true, porteiro: false } },
  { id: "enquetes", name: "Enquetes", icon: "Vote", roles: { sindico: true, morador: true, porteiro: false } },
  { id: "acesso", name: "Acesso", icon: "KeyRound", roles: { sindico: true, morador: true, porteiro: true } },
  { id: "cadastros", name: "Cadastros", icon: "BookUser", roles: { sindico: true, morador: false, porteiro: false } },
  { id: "condominios", name: "Condomínios", icon: "Building", roles: { sindico: false, morador: false, porteiro: false } },
  { id: "configuracoes", name: "Configurações", icon: "Settings", roles: { sindico: true, morador: true, porteiro: true } },
];

export default function AdministradorGlobalPage() {
  const router = useRouter();
  const { claims, isClaimsLoading } = useClaims();

  const isSuperAdmin = claims?.super_admin === true;

  useEffect(() => {
    if (isClaimsLoading) return;

    if (!isSuperAdmin) {
      router.replace("/"); // ou "/login" se preferir
    }
  }, [isClaimsLoading, isSuperAdmin, router]);

  if (isClaimsLoading || !isSuperAdmin) return <AppLayout pageTitle="Acesso Negado"><div>Você não tem permissão para acessar esta página.</div></AppLayout>;


  return (
    <AppLayout pageTitle="Administrador Global">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Gestão de Permissões de Menu</CardTitle>
                <CardDescription>
                  Controle a visibilidade dos itens de menu para cada perfil de usuário.
                </CardDescription>
              </div>

              <div className="w-64">
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar Condomínio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="condo1">Condomínio Vila das Flores</SelectItem>
                    <SelectItem value="condo2">Residencial Bosque Verde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Módulo</TableHead>
                  <TableHead className="text-center">
                    <UserCheck className="inline-block mr-2" />
                    Síndico
                  </TableHead>
                  <TableHead className="text-center">
                    <User className="inline-block mr-2" />
                    Morador
                  </TableHead>
                  <TableHead className="text-center">
                    <DoorOpen className="inline-block mr-2" />
                    Porteiro
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {modules.map((mod) => (
                  <TableRow key={mod.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <mod.icon className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{mod.name}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <Switch defaultChecked={mod.roles.sindico} aria-label={`${mod.name} - Síndico`} />
                    </TableCell>

                    <TableCell className="text-center">
                      <Switch defaultChecked={mod.roles.morador} aria-label={`${mod.name} - Morador`} />
                    </TableCell>

                    <TableCell className="text-center">
                      <Switch defaultChecked={mod.roles.porteiro} aria-label={`${mod.name} - Porteiro`} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end mt-6">
              <Button>Salvar Alterações</Button>
            </div>
          </CardContent>
        </Card>
    </AppLayout>
  );
}
