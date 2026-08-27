/**
 * G1.6.4 — API de Clientes Globais (CRUD base) — Painel Global Treetech.
 *
 * GET  /api/global/clientes  → listagem paginada e ordenada.
 * POST /api/global/clientes  → cria GlobalCliente (atômico com auditoria — ver globalAuditLog.ts).
 *
 * Restrições de G1.6.4 (Não criar índices compostos):
 * - Se `nome` for informado, o único orderBy permitido é `nome_asc` (nomeBusca), e não pode haver outros filtros.
 * - Se outros filtros (`status`, `cidade`, `uf`, `documento`) forem informados, o único orderBy permitido é o default (`docId`), que o Firestore chama de `__name__`.
 * - Sem filtros, pode usar orderBy livre (`nome_asc`, `nome_desc`, `recentes`, `antigos`).
 * Filtros combinados inválidos resultarão em erro 400.
 *
 * G1.6.4 — Revisão final (Ajuste 1): cursores estáveis. Toda ordenação por campo de
 * negócio (nomeBusca/createdAt) recebe desempate explícito por FieldPath.documentId(),
 * e o cursor passa a ser o par { value, id } (opaco, base64 na API pública), usado em
 * startAfter(value, id). Isso evita repetição/perda de páginas quando há nomes ou
 * timestamps duplicados.
 */
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { writeGlobalAuditLog } from "@/lib/globalAuditLog";
import type {
  GlobalCliente,
  GlobalClienteStatus,
  CreateGlobalClienteInput,
} from "@/types/global-clientes";

const STATUS_VALUES: GlobalClienteStatus[] = ["TRIAL", "ATIVO", "SUSPENSO", "CANCELADO"];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function isValidStatus(v: string): v is GlobalClienteStatus {
  return (STATUS_VALUES as string[]).includes(v);
}

const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeBusca(str: string): string {
  return str
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .toLowerCase()
    .trim();
}

function normalizeDoc(str: string): string {
  return str.replace(/[^\d]/g, "");
}

function serialize(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = (doc.data() || {}) as Partial<GlobalCliente>;
  return {
    id: doc.id,
    nome: data.nome ?? "",
    nomeBusca: data.nomeBusca ?? "",
    nomeFantasia: data.nomeFantasia ?? null,
    razaoSocial: data.razaoSocial ?? null,
    documento: data.documento ?? null,
    email: data.email ?? null,
    telefone: data.telefone ?? null,
    status: data.status ?? null,
    condominioIds: data.condominioIds ?? [],
    produtoIds: data.produtoIds ?? [],
    empresaId: data.empresaId ?? null,
    observacoes: data.observacoes ?? null,
    cidade: data.cidade ?? null,
    uf: data.uf ?? null,
    version: data.version ?? 1,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
    createdByUid: data.createdByUid ?? null,
    updatedByUid: data.updatedByUid ?? null,
  };
}

/**
 * Modo de ordenação resolvido para a requisição. "docid" cobre tanto o caso de
 * filtros de igualdade (status/cidade/uf/documento) quanto a ausência de qualquer
 * orderBy explícito — em ambos os casos o desempate por FieldPath.documentId() já é
 * a própria (e única) chave de ordenação.
 */
type OrderMode = "nome_asc" | "nome_desc" | "recentes" | "antigos" | "docid";

/** Cursor opaco G1.6.4: { value, id } codificado em base64url — ver Ajuste 1. */
function encodeCursor(value: unknown, id: string): string {
  const v = value instanceof Timestamp ? value.toDate().toISOString() : value;
  return Buffer.from(JSON.stringify({ value: v, id })).toString("base64url");
}

function decodeCursor(raw: string): { value: unknown; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || typeof parsed.id !== "string") return null;
    return parsed as { value: unknown; id: string };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    await apiGuard({
      request: req,
      requireSuperAdmin: true,
      rateLimit: { limit: 60, windowSec: 60 },
    });

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") || "").toUpperCase().trim();
    const nomeParam = (url.searchParams.get("nome") || "").trim();
    const cidadeParam = (url.searchParams.get("cidade") || "").trim();
    const ufParam = (url.searchParams.get("uf") || "").trim();
    const documentoParam = (url.searchParams.get("documento") || "").trim();
    const orderByParam = (url.searchParams.get("orderBy") || "").trim();
    const cursorParam = (url.searchParams.get("cursor") || "").trim();
    const limitRaw = Number(url.searchParams.get("limit") || DEFAULT_PAGE_SIZE);

    const pageSize =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.trunc(limitRaw), MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;

    if (statusParam && !isValidStatus(statusParam)) {
      return jsonError(`status inválido. Use um de: ${STATUS_VALUES.join(", ")}`, 400);
    }

    const hasEqualityFilters = Boolean(statusParam || cidadeParam || ufParam || documentoParam);

    // Validação de restrições do Firestore sem composite indexes (G1.6.4 strict mode)
    if (nomeParam) {
      if (hasEqualityFilters) {
        return jsonError("Filtro por nome não pode ser combinado com outros filtros (exige índice composto).", 400);
      }
      if (orderByParam && orderByParam !== "nome_asc") {
        return jsonError("Ao filtrar por nome, a ordenação deve ser obrigatoriamente 'nome_asc'.", 400);
      }
    }

    if (hasEqualityFilters && orderByParam) {
      return jsonError("Não é possível ordenar os resultados quando outros filtros (status, cidade, uf, documento) estão ativos (exige índice composto).", 400);
    }

    const db = adminDb();
    const col = db.collection("globalClientes");

    let q: FirebaseFirestore.Query = col;

    // Apply Equality Filters
    if (statusParam) q = q.where("status", "==", statusParam);
    if (documentoParam) q = q.where("documentoNorm", "==", normalizeDoc(documentoParam));
    if (cidadeParam) q = q.where("cidadeNorm", "==", normalizeBusca(cidadeParam));
    if (ufParam) q = q.where("ufNorm", "==", normalizeBusca(ufParam));

    // Resolve o modo de ordenação e aplica Range Filter (nome) quando houver.
    let orderMode: OrderMode;
    if (nomeParam) {
      const norm = normalizeBusca(nomeParam);
      // Truque padrão de prefixo no Firestore: '' é um ponto de código muito
      // alto, garantindo que o range cubra todos os valores que começam com `norm`.
      q = q.where("nomeBusca", ">=", norm).where("nomeBusca", "<", norm + "");
      orderMode = "nome_asc";
    } else if (hasEqualityFilters) {
      orderMode = "docid";
    } else if (orderByParam === "nome_desc") {
      orderMode = "nome_desc";
    } else if (orderByParam === "recentes") {
      orderMode = "recentes";
    } else if (orderByParam === "antigos") {
      orderMode = "antigos";
    } else {
      orderMode = "nome_asc"; // Default (sem filtros e sem orderBy explícito válido)
    }

    // AJUSTE 1 (G1.6.4 — revisão final): desempate obrigatório por documentId() em
    // toda ordenação de campo de negócio, garantindo paginação determinística mesmo
    // com nomes ou timestamps duplicados.
    switch (orderMode) {
      case "nome_asc":
        q = q.orderBy("nomeBusca", "asc").orderBy(FieldPath.documentId(), "asc");
        break;
      case "nome_desc":
        q = q.orderBy("nomeBusca", "desc").orderBy(FieldPath.documentId(), "desc");
        break;
      case "recentes":
        q = q.orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
        break;
      case "antigos":
        q = q.orderBy("createdAt", "asc").orderBy(FieldPath.documentId(), "asc");
        break;
      case "docid":
        q = q.orderBy(FieldPath.documentId(), "asc");
        break;
    }

    if (cursorParam) {
      const decoded = decodeCursor(cursorParam);
      if (!decoded) return jsonError("Cursor inválido.", 400);

      if (orderMode === "docid") {
        q = q.startAfter(decoded.id);
      } else if (orderMode === "recentes" || orderMode === "antigos") {
        const ts = Timestamp.fromDate(new Date(String(decoded.value)));
        q = q.startAfter(ts, decoded.id);
      } else {
        q = q.startAfter(decoded.value, decoded.id);
      }
    }

    const snap = await q.limit(pageSize + 1).get();
    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const page = docs.slice(0, pageSize);
    const items = page.map((d) => serialize(d));

    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const lastDoc = page[page.length - 1];
      if (orderMode === "docid") {
        nextCursor = encodeCursor(lastDoc.id, lastDoc.id);
      } else if (orderMode === "recentes" || orderMode === "antigos") {
        nextCursor = encodeCursor(lastDoc.get("createdAt"), lastDoc.id);
      } else {
        nextCursor = encodeCursor(lastDoc.get("nomeBusca"), lastDoc.id);
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        items,
        pageSize,
        hasMore,
        nextCursor,
      },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await apiGuard({
      request: req,
      requireSuperAdmin: true,
      rateLimit: { limit: 20, windowSec: 60 },
    });

    const body = (await req.json().catch(() => null)) as CreateGlobalClienteInput | null;
    if (!body || typeof body !== "object") return jsonError("Payload inválido.", 400);

    const nome = String(body.nome || "").trim();
    if (!nome) return jsonError("nome é obrigatório.", 400);

    const status = body.status ? String(body.status).toUpperCase().trim() : "TRIAL";
    if (!isValidStatus(status)) {
      return jsonError(`status inválido. Use um de: ${STATUS_VALUES.join(", ")}`, 400);
    }

    const documento = body.documento ? String(body.documento).trim() : undefined;
    const email = body.email ? String(body.email).trim() : undefined;
    const telefone = body.telefone ? String(body.telefone).trim() : undefined;
    const nomeFantasia = body.nomeFantasia ? String(body.nomeFantasia).trim() : undefined;
    const razaoSocial = body.razaoSocial ? String(body.razaoSocial).trim() : undefined;
    const observacoes = body.observacoes ? String(body.observacoes).trim() : undefined;
    const cidade = body.cidade ? String(body.cidade).trim() : undefined;
    const uf = body.uf ? String(body.uf).trim().toUpperCase() : undefined;

    const condominioIds = Array.isArray(body.condominioIds)
      ? body.condominioIds.map((v) => String(v).trim()).filter(Boolean)
      : [];
    const produtoIds = Array.isArray(body.produtoIds)
      ? body.produtoIds.map((v) => String(v).trim()).filter(Boolean)
      : [];

    const db = adminDb();
    const col = db.collection("globalClientes");

    // AJUSTE 3 (G1.6.4 — revisão final): esta checagem é uma validação BEST EFFORT,
    // não uma garantia estrutural de unicidade. Sem uma coleção/índice dedicado de
    // unicidade, duas criações concorrentes com o mesmo documento entre esta leitura
    // e a escrita abaixo ainda podem produzir duplicidade — limitação conhecida do
    // Firestore, não alterada nesta fase.
    const documentoNorm = documento ? normalizeDoc(documento) : undefined;
    if (documentoNorm) {
      const dupSnap = await col.where("documentoNorm", "==", documentoNorm).limit(1).get();
      if (!dupSnap.empty) {
        return jsonError("Já existe um Cliente com este documento.", 409);
      }
    }

    const nomeBusca = normalizeBusca(nome);
    const now = FieldValue.serverTimestamp();

    const docData: Record<string, unknown> = {
      nome,
      nomeBusca,
      status,
      condominioIds,
      produtoIds,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUid: ctx.uid,
      updatedByUid: ctx.uid,
    };
    if (nomeFantasia) docData.nomeFantasia = nomeFantasia;
    if (razaoSocial) docData.razaoSocial = razaoSocial;
    if (documento) docData.documento = documento;
    if (documentoNorm) docData.documentoNorm = documentoNorm;
    if (email) docData.email = email;
    if (telefone) docData.telefone = telefone;
    if (observacoes) docData.observacoes = observacoes;
    if (cidade) {
      docData.cidade = cidade;
      docData.cidadeNorm = normalizeBusca(cidade);
    }
    if (uf) {
      docData.uf = uf;
      docData.ufNorm = normalizeBusca(uf);
    }

    const afterSnapshot: Record<string, unknown> = { nome, status, condominioIds, produtoIds };
    if (documento) afterSnapshot.documento = documento;
    if (cidade) afterSnapshot.cidade = cidade;
    if (uf) afterSnapshot.uf = uf;

    // AJUSTE 2 (G1.6.4 — revisão final): criação do cliente e gravação do log de
    // auditoria ocorrem no mesmo WriteBatch. Nunca poderá existir cliente criado sem
    // o respectivo registro de auditoria — se o commit falhar, nada é persistido.
    const clienteRef = col.doc();
    const batch = db.batch();
    batch.set(clienteRef, docData);
    await writeGlobalAuditLog(
      {
        actorUid: ctx.uid,
        actorEmail: ctx.email || undefined,
        action: "GLOBAL_CLIENT_CREATED",
        entity: "GLOBAL_CLIENT",
        entityId: clienteRef.id,
        before: null,
        after: afterSnapshot,
        source: "API",
      },
      { batch }
    );
    await batch.commit();

    const created = await clienteRef.get();
    return NextResponse.json({ ok: true, data: serialize(created) }, { status: 201 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
