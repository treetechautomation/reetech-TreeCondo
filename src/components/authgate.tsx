"use client";

import { ReactNode, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessionCtx } from "@/contexts/SessionContext";

const PUBLIC_ROUTES = [
  "/login",
  "/primeiro-acesso",
  "/definir-senha",
  "/acesso",
];

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isSessionLoading } = useSessionCtx();

  const isPublic = useMemo(() => {
    if (!pathname) return false;
    return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
  }, [pathname]);

  useEffect(() => {
    if (isPublic) return;
    if (isSessionLoading) return;

    // não autenticado -> manda para login
    if (!session?.user) {
      router.replace("/login");
      return;
    }
  }, [isPublic, isSessionLoading, session?.user, router]);

  // rotas públicas sempre liberadas
  if (isPublic) return <>{children}</>;

  // enquanto carrega sessão, não renderiza nada (evita piscar)
  if (isSessionLoading) return null;

  // se não tem sessão, vai redirecionar no effect
  if (!session?.user) return null;

  return <>{children}</>;
}
