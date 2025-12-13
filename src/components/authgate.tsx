"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { useAuth } from "@/firebase";

const PUBLIC_ROUTES = ["/login", "/forgot-password"]; // Adicionado forgot-password para ser rota pública

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth(); // Usando o hook para obter a instância do auth
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Se for rota pública, permite o acesso e não faz a verificação
    if (PUBLIC_ROUTES.includes(pathname)) {
      setIsReady(true);
      return;
    }

    // Se não for rota pública, verifica o estado da autenticação
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Se não houver usuário logado, redireciona para a página de login
        router.replace("/login");
      } else {
        // Se houver usuário, permite o acesso à rota protegida
        setIsReady(true);
      }
    });

    // Limpa o listener quando o componente é desmontado
    return () => unsubscribe();
  }, [pathname, router, auth]);

  // Enquanto a verificação está em andamento, não renderiza nada (ou um loader)
  if (!isReady) {
    return null; 
  }

  // Renderiza o conteúdo da página se a verificação foi concluída
  return <>{children}</>;
}
