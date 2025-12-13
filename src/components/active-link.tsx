"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarMenuButton } from "@/components/ui/sidebar";

type ActiveLinkProps = {
  href: string;
  children: React.ReactNode;
};

export function ActiveLink({ href, children }: ActiveLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <SidebarMenuButton asChild isActive={isActive}>
      <Link href={href}>
        {children}
      </Link>
    </SidebarMenuButton>
  );
}
