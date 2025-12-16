"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/firebase";

const PUBLIC_ROUTES = ["/login", "/forgot-password"];

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();

  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  useEffect(() => {
    if (isUserLoading) return;

    if (!user && !isPublic) {
      router.replace("/login");
    }
  }, [user, isUserLoading, isPublic, router]);

  if (isUserLoading) return null;
  if (!user && !isPublic) return null;

  return <>{children}</>;
}
