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
import { useRouter } from "next/navigation";
import { useSessionCtx } from "@/contexts/SessionContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

type UserNavProps = {
  variant?: "header" | "sidebar";
}

export function UserNav({ variant = "header" }: UserNavProps) {
  const { session, isSessionLoading } = useSessionCtx();
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isSessionLoading || !session) {
    return null; 
  }

  const { user, superAdmin } = session;

  const activeVinculo = (session as any).activeVinculo ?? (session as any).vinculoAtivo ?? null;
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  
  const displayRole = superAdmin ? 'SUPER_ADMIN' : activeVinculo?.role;
  const nome = user?.displayName || "Usuário";
  const email = user?.email || "Nenhum e-mail";

  if (variant === "sidebar") {
     return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start text-left h-auto p-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/15">
                     <Avatar className="h-9 w-9">
                        <AvatarImage src={user?.photoURL || `https://picsum.photos/seed/user-${user?.uid}/40/40`} alt={user?.displayName || "Avatar do usuário"} data-ai-hint="person face" />
                        <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                    </Avatar>
                     <div className="ml-3 flex-1">
                        <p className="text-sm font-semibold leading-tight text-white">{nome}</p>
                        <p className="text-xs leading-tight text-white/70 truncate">{email}</p>
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start" side="right" sideOffset={10}>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{nome}</p>
                        <p className="text-xs leading-none text-muted-foreground">{email}</p>
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
            <p className="text-sm font-medium leading-none">{nome}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {email}
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
