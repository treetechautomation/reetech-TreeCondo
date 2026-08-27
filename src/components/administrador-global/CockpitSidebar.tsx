"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { COCKPIT_NAV_GROUPS } from "./nav-config";

function DisabledNavRow({ label, icon: Icon, tag }: { label: string; icon: React.ElementType; tag: string }) {
  return (
    <div
      className="flex cursor-not-allowed items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/30"
      aria-disabled="true"
      title="Ainda não implementado"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      <Badge variant="outline" className="border-white/10 px-1.5 py-0 text-[10px] font-medium text-white/40">
        {tag}
      </Badge>
    </div>
  );
}

export function CockpitSidebar() {
  const pathname = usePathname();

  const fixedGroups = COCKPIT_NAV_GROUPS.filter((g) => !g.collapsible);
  const collapsibleGroups = COCKPIT_NAV_GROUPS.filter((g) => g.collapsible);

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-sm font-bold text-cyan-300">
            TT
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Treetech</div>
            <div className="text-xs text-white/50">Painel Global</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {fixedGroups.map((group) => (
          <SidebarGroup key={group.key}>
            <SidebarGroupLabel className="text-white/40">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;

                  if (!item.enabled) {
                    return (
                      <SidebarMenuItem key={item.key}>
                        <DisabledNavRow label={item.label} icon={Icon} tag="Em breve" />
                      </SidebarMenuItem>
                    );
                  }

                  const active = pathname === item.href || pathname?.startsWith(item.href + "/");

                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className={cn(
                          "text-white/80 hover:bg-white/10 hover:text-white",
                          active && "bg-emerald-400/15 text-white"
                        )}
                      >
                        <Link href={item.href}>
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {collapsibleGroups.map((group) => (
          <Collapsible key={group.key} defaultOpen={group.defaultOpen} className="group/collapsible">
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="flex cursor-pointer items-center justify-between text-white/40 hover:text-white/70">
                  {group.label}
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.key}>
                        <DisabledNavRow label={item.label} icon={item.icon} tag="G2+" />
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
