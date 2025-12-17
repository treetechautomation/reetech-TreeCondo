"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { useClaims, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { useDoc } from "@/firebase/firestore/use-doc";
import { saveMenuPermissions } from "@/services/menuPermissions";

import {
  Home,
  Megaphone,
  CalendarDays,
  Users,
  AlertTriangle,
  Package,
  FileText,
  Vote,
  KeyRound,
  BookUser,
  Building,
  Settings,
  UserCheck,
  User,
  DoorOpen,
} from "lucide-react";

type RoleKey = "sindico" | "morador" | "porteiro";

const defaultModules = [
  { id: "painel", name: "Painel", icon: Home, roles: { sindico: true, morador: true, porteiro: true } },
  { id: "anuncios", name: "Anúncios", icon: Megaphone, roles: { sindico: true, morador: true, porteiro: false } },
  { id: "reservas", name: "Reservas", icon: CalendarDays, roles: { sindico: true, morador: true, porteiro: false } },
  { id: "reunioes", name: "Reuniões", icon: Users, roles: { sindico: true, morador: true, porteiro: false } },
  { id: "incidentes", name: "Incidentes", icon: AlertTriangle, roles: { sindico: true, morador: true, porteiro: true } },
  { id: "encomendas", name: "Encomendas", icon: Package, roles: { sindico: true, morador: true, porteiro: true } },
  { id: "documentos", name: "Documentos", icon: FileText, roles: { sindico: true, morador: true, porteiro: false } },
  { id: "enquetes", name: "Enquetes", icon: Vote, roles: { sindico: true, morador: true, porteiro: false } },
  { id: "acesso", name: "Acesso", icon: KeyRound, roles: { sindico: true, morador: true, porteiro: true } },
  { id: "cadastros", name: "Cadastros", icon: BookUser, roles: { sindico: true, morador: false, porteiro: false } },
  { id: "condominios", name: "Condomínios", icon: Building, roles: { sindico: false, morador: false, porteiro: false } },
  { id: "configuracoes", name: "Configurações", icon: Settings, roles: { sindico: true, morador: true, porteiro: true } },
];

type MenuPermissionsDoc = {
  updatedAt?: any;
  updatedBy?: string;
  modules?: Record<string, Record<RoleKey, boolean>>;
};

export default function AdministradorGlobalPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { claims, isClaimsLoading } = useClaims();

  const isSuperAdmin = claims?.super_admin === true;

  useEffect(() => {
    if (isClaimsLoading) return;
    if (!isSuperAdmin) router.replace("/");
  }, [isClaimsLoading, isSuperAdmin, router]);

  const condominiosRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "condominios"), orderBy("nome"));
  }, [firestore]);

  const { data: condominios } = useCollection<any>(condominiosRef);

  const [condominioId, setCondominioId] = useState<string>("");

  useEffect(() => {
    if (condominioId) return;
    if (condominios?.length) setCondominioId(condominios[0].id);
  }, [condominios, condominioId]);

  const permDocRef = useMemo(() => {
    if (!firestore || !condominioId) return null;
    return doc(firestore, `condominios/${condominioId}/config/menuPermissions`);
  }, [firestore, condominioId]);

  const { data: permDoc, isLoading: isLoadingPermDoc } =
    useDoc<MenuPermissionsDoc>(permDocRef as any);

  const mergedModules = useMemo(() => {
    const base = defaultModules.map((m) => ({ ...m, roles: { ...m.roles } }));
    const saved = permDoc?.modules || {};
    for (const mod of base) {
      const savedRoles = saved[mod.id];
      if (savedRoles) {
        mod.roles.sindico = savedRoles.sindico ?? mod.roles.sindico;
        mod.roles.morador = savedRoles.morador ?? mod.roles.morador;
        mod.roles.porteiro = savedRoles.porteiro ?? mod.roles.porteiro;
      }
    }
    return base;
  }, [permDoc]);

  const [modulesState, setModulesState] = useState(mergedModules);

  useEffect(() => {
    setModulesState(mergedModules);
  }, [mergedModules]);

  const toggle = (moduleId: string, role: RoleKey, value: boolean) => {
    setModulesState((prev) =>
      prev.map((m) => {
        if (m.id !== moduleId) return m;
        return { ...m, roles: { ...m.roles, [role]: value } };
      })
    );
  };

  const onSave = async () => {
    if (!firestore || !condominioId) return;

    const payload: Record<string, Record<RoleKey, boolean>> = {};
    for (const m of modulesState) payload[m.id] = m.roles;

    await saveMenuPermissions({
      firestore,
      condominioId,
      modules: payload,
      updatedBy: claims?.user_id || "unknown",
    });
  };

  if (isClaimsLoading || !isSuperAdmin) {
    return (
      <AppLayout pageTitle="Acesso Negado">
        <div>Você não tem permissão para acessar esta página.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Administrador Global">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center gap-4">
            <div>
              <CardTitle>Gestão de Permissões de Menu</CardTitle>
              <CardDescription>
                Controle a visibilidade dos itens de menu por perfil e por condomínio.
              </CardDescription>
            </div>

            <div className="w-72">
              <Select value={condominioId} onValueChange={setCondominioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar Condomínio" />
                </SelectTrigger>
                <SelectContent>
                  {condominios?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome ?? c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoadingPermDoc && <div className="mb-4 text-sm">Carregando permissões...</div>}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[320px]">Módulo</TableHead>
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
              {modulesState.map((mod) => (
                <TableRow key={mod.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <mod.icon className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{mod.name}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <Switch
                      checked={mod.roles.sindico}
                      onCheckedChange={(v) => toggle(mod.id, "sindico", v)}
                      aria-label={`${mod.name} - Síndico`}
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Switch
                      checked={mod.roles.morador}
                      onCheckedChange={(v) => toggle(mod.id, "morador", v)}
                      aria-label={`${mod.name} - Morador`}
                    />
                  </TableCell>

                  <TableCell className="text-center">
                    <Switch
                      checked={mod.roles.porteiro}
                      onCheckedChange={(v) => toggle(mod.id, "porteiro", v)}
                      aria-label={`${mod.name} - Porteiro`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end mt-6">
            <Button onClick={onSave} disabled={!condominioId}>
              Salvar Alterações
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
