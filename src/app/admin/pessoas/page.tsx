"use client";

import React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSessionCtx } from "@/contexts/SessionContext";

export default function PessoasAdminPage() {
  const { session, isSessionLoading, setActiveCondominioId } = useSessionCtx();
  
  const canSwitchCondo = session?.superAdmin || session?.role === "SINDICO" || session?.role === "ADMIN";

  return (
    <AppLayout pageTitle="Pessoas (Admin)">
      <Card>
        <CardHeader>
          <CardTitle>Pessoas (Visão Admin Antiga)</CardTitle>
          <CardDescription>
            Esta página foi descontinuada e suas funcionalidades foram movidas para{" "}
            <code className="font-semibold text-primary">/cadastros/pessoas</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-600">
            A nova página de gestão de pessoas agora usa uma arquitetura mais robusta e centralizada.
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
