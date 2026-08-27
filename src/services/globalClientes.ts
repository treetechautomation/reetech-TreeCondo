import { initializeFirebase } from "@/firebase";

export type GlobalClienteItem = {
  id: string;
  nome: string;
  nomeBusca: string;
  nomeFantasia: string | null;
  razaoSocial: string | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  status: "TRIAL" | "ATIVO" | "SUSPENSO" | "CANCELADO";
  condominioIds: string[];
  produtoIds: string[];
  observacoes: string | null;
  cidade: string | null;
  uf: string | null;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
  createdByUid: string | null;
  updatedByUid: string | null;
};

export type GlobalClientesResponse = {
  items: GlobalClienteItem[];
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
};

export type CreateGlobalClientePayload = {
  nome: string;
  nomeFantasia?: string;
  razaoSocial?: string;
  documento?: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  uf?: string;
  status?: string;
  condominioIds?: string[];
  produtoIds?: string[];
  observacoes?: string;
};

export type UpdateGlobalClientePayload = Partial<CreateGlobalClientePayload> & { version: number };

export type GlobalAuditLogItem = {
  id: string;
  action: string;
  actorUid: string;
  actorEmail: string | null;
  source: string;
  createdAt: string | null;
  before: any;
  after: any;
};

/**
 * G1.6.4 (Ajuste 4 — revisão final): quando `indexRequired` é true, o Firestore
 * exige um índice composto que não foi criado nesta fase — `items` vem vazio e
 * `message` explica a limitação. Não é um erro; é um estado a ser exibido.
 */
export type GlobalClienteHistoryResult = {
  items: GlobalAuditLogItem[];
  indexRequired: boolean;
  message: string | null;
};

async function getToken(): Promise<string> {
  const { auth } = initializeFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error("Sem usuário autenticado.");
  return user.getIdToken();
}

export async function fetchGlobalClientes(params?: {
  status?: string;
  nome?: string;
  cidade?: string;
  uf?: string;
  documento?: string;
  orderBy?: string;
  cursor?: string;
  limit?: number;
}): Promise<GlobalClientesResponse> {
  const token = await getToken();
  const url = new URL("/api/global/clientes", window.location.origin);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.nome) url.searchParams.set("nome", params.nome);
  if (params?.cidade) url.searchParams.set("cidade", params.cidade);
  if (params?.uf) url.searchParams.set("uf", params.uf);
  if (params?.documento) url.searchParams.set("documento", params.documento);
  if (params?.orderBy) url.searchParams.set("orderBy", params.orderBy);
  if (params?.cursor) url.searchParams.set("cursor", params.cursor);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Falha ao carregar clientes.");
  }

  return json.data as GlobalClientesResponse;
}

export async function fetchGlobalClienteById(id: string): Promise<GlobalClienteItem> {
  const token = await getToken();
  const res = await fetch(`/api/global/clientes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Falha ao carregar cliente.");
  }
  return json.data as GlobalClienteItem;
}

export async function createGlobalCliente(
  payload: CreateGlobalClientePayload
): Promise<GlobalClienteItem> {
  const token = await getToken();
  const res = await fetch("/api/global/clientes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Falha ao criar cliente.");
  }

  return json.data as GlobalClienteItem;
}

export async function updateGlobalCliente(
  id: string,
  payload: UpdateGlobalClientePayload
): Promise<GlobalClienteItem> {
  const token = await getToken();
  const res = await fetch(`/api/global/clientes/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Falha ao atualizar cliente.");
  }

  return json.data as GlobalClienteItem;
}

export async function fetchGlobalClienteHistory(id: string): Promise<GlobalClienteHistoryResult> {
  const token = await getToken();
  const res = await fetch(`/api/global/clientes/${id}/historico`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Falha ao carregar histórico.");
  }

  return {
    items: (json.data as GlobalAuditLogItem[]) || [],
    indexRequired: Boolean(json.indexRequired),
    message: json.message || null,
  };
}
