"use client";

import * as React from "react";
import { fetchGlobalDashboard, type GlobalDashboardData } from "@/services/globalDashboard";

type GlobalDashboardState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: GlobalDashboardData };

export function useGlobalDashboard() {
  const [state, setState] = React.useState<GlobalDashboardState>({ status: "loading" });

  const reload = React.useCallback(() => {
    setState({ status: "loading" });
    fetchGlobalDashboard()
      .then((data) => setState({ status: "success", data }))
      .catch((e: any) => setState({ status: "error", error: e?.message || "Erro ao carregar dados." }));
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
