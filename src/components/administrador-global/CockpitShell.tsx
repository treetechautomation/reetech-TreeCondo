"use client";

import * as React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { CockpitSidebar } from "./CockpitSidebar";
import { CockpitHeader } from "./CockpitHeader";
import { CockpitFooter } from "./CockpitFooter";

export function CockpitShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <CockpitSidebar />
      <SidebarInset className="flex min-h-svh flex-col bg-slate-50">
        <CockpitHeader />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        <CockpitFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}
