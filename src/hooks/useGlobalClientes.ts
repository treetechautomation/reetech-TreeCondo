"use client";

import * as React from "react";
import {
  fetchGlobalClientes,
  createGlobalCliente,
  updateGlobalCliente,
  fetchGlobalClienteById,
  fetchGlobalClienteHistory,
  type GlobalClienteItem,
  type GlobalClientesResponse,
  type CreateGlobalClientePayload,
  type UpdateGlobalClientePayload,
} from "@/services/globalClientes";

type GlobalClientesState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: GlobalClientesResponse; cursors: string[] };

export function useGlobalClientes() {
  const [state, setState] = React.useState<GlobalClientesState>({ status: "loading" });
  
  // Filters
  const [filtroNome, setFiltroNome] = React.useState("");
  const [filtroDocumento, setFiltroDocumento] = React.useState("");
  const [filtroCidade, setFiltroCidade] = React.useState("");
  const [filtroUf, setFiltroUf] = React.useState("");
  const [filtroStatus, setFiltroStatus] = React.useState("");
  const [orderBy, setOrderBy] = React.useState("");
  
  // Pagination
  const [limit, setLimit] = React.useState(20);
  const [pageIndex, setPageIndex] = React.useState(0);
  // cursors array stores the nextCursor string to reach page N. 
  // page 0 doesn't need a cursor (undefined). page 1 needs cursors[0], page 2 needs cursors[1], etc.
  const [cursors, setCursors] = React.useState<string[]>([]);

  const reload = React.useCallback(
    (
      params: { 
        nome?: string; 
        documento?: string; 
        cidade?: string; 
        uf?: string; 
        status?: string; 
        orderBy?: string; 
        limit?: number; 
        cursor?: string 
      },
      newCursors?: string[],
      newPageIndex?: number
    ) => {
      setState((prev) => (prev.status === "success" ? { ...prev, status: "loading" } : { status: "loading" }));
      fetchGlobalClientes({
        nome: params.nome || undefined,
        documento: params.documento || undefined,
        cidade: params.cidade || undefined,
        uf: params.uf || undefined,
        status: params.status || undefined,
        orderBy: params.orderBy || undefined,
        limit: params.limit || 20,
        cursor: params.cursor || undefined,
      })
        .then((data) => {
          setState({ 
            status: "success", 
            data, 
            cursors: newCursors || [] 
          });
          if (newPageIndex !== undefined) setPageIndex(newPageIndex);
        })
        .catch((e: any) =>
          setState({ status: "error", error: e?.message || "Erro ao carregar clientes." })
        );
    },
    []
  );

  // Initial load
  React.useEffect(() => {
    reload({ limit });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarFiltros = React.useCallback(
    (novos: { nome?: string; documento?: string; cidade?: string; uf?: string; status?: string; orderBy?: string; limit?: number }) => {
      const pNome = novos.nome ?? filtroNome;
      const pDoc = novos.documento ?? filtroDocumento;
      const pCid = novos.cidade ?? filtroCidade;
      const pUf = novos.uf ?? filtroUf;
      const pStatus = novos.status ?? filtroStatus;
      const pOrd = novos.orderBy ?? orderBy;
      const pLim = novos.limit ?? limit;

      setFiltroNome(pNome);
      setFiltroDocumento(pDoc);
      setFiltroCidade(pCid);
      setFiltroUf(pUf);
      setFiltroStatus(pStatus);
      setOrderBy(pOrd);
      setLimit(pLim);
      setPageIndex(0);
      setCursors([]);

      reload({
        nome: pNome,
        documento: pDoc,
        cidade: pCid,
        uf: pUf,
        status: pStatus,
        orderBy: pOrd,
        limit: pLim
      }, [], 0);
    },
    [filtroNome, filtroDocumento, filtroCidade, filtroUf, filtroStatus, orderBy, limit, reload]
  );

  const nextPage = React.useCallback(() => {
    if (state.status !== "success" || !state.data.hasMore || !state.data.nextCursor) return;
    
    const newCursors = [...state.cursors, state.data.nextCursor];
    const newPageIndex = pageIndex + 1;
    
    reload({
      nome: filtroNome,
      documento: filtroDocumento,
      cidade: filtroCidade,
      uf: filtroUf,
      status: filtroStatus,
      orderBy,
      limit,
      cursor: state.data.nextCursor
    }, newCursors, newPageIndex);
  }, [state, filtroNome, filtroDocumento, filtroCidade, filtroUf, filtroStatus, orderBy, limit, pageIndex, reload]);

  const prevPage = React.useCallback(() => {
    if (state.status !== "success" || pageIndex === 0) return;
    
    const newCursors = [...state.cursors];
    newCursors.pop(); // remove last cursor
    const newPageIndex = pageIndex - 1;
    const cursor = newPageIndex > 0 ? newCursors[newPageIndex - 1] : undefined;

    reload({
      nome: filtroNome,
      documento: filtroDocumento,
      cidade: filtroCidade,
      uf: filtroUf,
      status: filtroStatus,
      orderBy,
      limit,
      cursor
    }, newCursors, newPageIndex);
  }, [state, filtroNome, filtroDocumento, filtroCidade, filtroUf, filtroStatus, orderBy, limit, pageIndex, reload]);


  const criar = React.useCallback(
    async (payload: CreateGlobalClientePayload): Promise<GlobalClienteItem> => {
      const item = await createGlobalCliente(payload);
      aplicarFiltros({}); // Recarrega mantendo os filtros atuais e resetando paginação
      return item;
    },
    [aplicarFiltros]
  );

  const editar = React.useCallback(
    async (id: string, payload: UpdateGlobalClientePayload): Promise<GlobalClienteItem> => {
      const item = await updateGlobalCliente(id, payload);
      
      // Update in memory if possible to avoid full reload
      setState(prev => {
        if (prev.status !== "success") return prev;
        const newItems = prev.data.items.map(i => i.id === id ? item : i);
        return { ...prev, data: { ...prev.data, items: newItems } };
      });
      return item;
    },
    []
  );

  return { 
    ...state, 
    pageIndex,
    limit,
    filtroNome,
    filtroDocumento,
    filtroCidade,
    filtroUf,
    filtroStatus,
    orderBy,
    aplicarFiltros,
    nextPage, 
    prevPage, 
    criar, 
    editar,
    fetchGlobalClienteById,
    fetchGlobalClienteHistory
  };
}
