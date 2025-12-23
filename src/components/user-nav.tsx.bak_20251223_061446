"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link";
import { useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useSessionCtx } from "@/contexts/SessionContext";
import { Badge } from "@/components/ui/badge";

const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN_CONDOMINIO: "Admin do Condomínio",
    SINDICO: "Síndico",
    SUB_SINDICO: "Sub-síndico",
    MORADOR: "Morador",
    PORTEIRO: "Porteiro",
    FUNCIONARIO: "Funcionário",
};

function formatRole(role: string) {
    return ROLE_LABELS[role] || role;
}


export function UserNav() {
  const { session, isSessionLoading } = useSessionCtx();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (isSessionLoading || !session) {
    // Pode mostrar um skeleton/loading state aqui se preferir
    return null; 
  }

  const { user, isSuperAdmin, activeVinculo } = session;

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  
  const displayRole = isSuperAdmin ? 'SUPER_ADMIN' : activeVinculo?.role;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.photoURL || `https://picsum.photos/seed/user-${user?.uid}/40/40`} alt={user?.displayName || "Avatar do usuário"} data-ai-hint="person face" />
            <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.displayName || "Usuário"}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email || "Nenhum e-mail"}
            </p>
            {displayRole && (
                 <p className="text-xs font-medium leading-none text-primary pt-1">
                    {formatRole(displayRole)}
                </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            Perfil
          </DropdownMenuItem>
          <DropdownMenuItem>
            Faturamento
          </DropdownMenuItem>
          <DropdownMenuItem>
            Configurações
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
