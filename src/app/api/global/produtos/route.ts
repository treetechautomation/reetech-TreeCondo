/**
 * G1.7 — API de Produtos Globais (Fundação) — Painel Global Treetech.
 *
 * GET  /api/global/produtos  → listagem paginada e ordenada.
 * POST /api/global/produtos  → cria GlobalProduto (atômico com auditoria).
 *
 * Fundação apenas: sem PATCH, DELETE ou histórico. Sem qualquer vínculo com
 * Empresa/Cliente/Condomínio. Sem licenciamento, planos, assinaturas,
 * recursos ou feature flags. Mesmo padrão arquitetural estabelecido para
 * Empresas Globais (G1.6.5):
 * - Restrições de índice (sem criar índices compostos): filtros de igualdade
 *   (`status`, `categoria`) combinados com orderBy explícito exigiriam índice
 *   composto — não suportado nesta fase (único orderBy permitido com filtros
 *   é o default por documentId()).
 * - Cursores estáveis: toda ordenação de campo de negócio tem desempate
 *   explícito por FieldPath.documentId(); cursor opaco { value, id }.
 * - Auditoria atômica: criação do documento e do log (GLOBAL_PRODUTO_CREATED)
 *   em um único WriteBatch, via writeGlobalAuditLog() reutilizado.
 * - Verificação de duplicidade por `codigo` é best effort (mesma limitação
 *   estrutural documentada para Clientes/Empresas — ver G1.6.4/G1.6.5).
 *
 * Sem campo `nomeBusca`: o tipo GlobalProduto não inclui esse campo (fora do
 * conjunto de campos autorizado nesta fase), portanto não há busca textual
 * por nome — apenas ordenação direta por `codigo` ou `createdAt`.
 */
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { writeGlobalAuditLog } from "@/lib/globalAuditLog";
import type {
  GlobalProduto,
  GlobalProdutoStatus,
  GlobalProdutoCategoria,
  CreateGlobalProdutoInput,
} from "@/types/global-produtos";

const STATUS_VALUES: GlobalProdutoStatus[] = ["ATIVO", "INATIVO"];
const CATEGORIA_VALUES: GlobalProdutoCategoria[] = [
  "CONDOMINIO",
  "MIDIA",
  "FINANCEIRO",
  "SAUDE",
  "ESPORTE",
  "OUTRO",
];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function isValidStatus(v: string): v is GlobalProdutoStatus {
  return (STATUS_VALUES as string[]).includes(v);
}

function isValidCategoria(v: string): v is GlobalProdutoCategoria {
  return (CATEGORIA_VALUES as string[]).includes(v);
}

function serialize(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = (doc.data() || {}) as Partial<GlobalProduto>;
  return {
    id: doc.id,
    codigo: data.codigo ?? "",
    nome: data.nome ?? "",
    descricao: data.descricao ?? null,
    status: data.status ?? null,
    categoria: data.categoria ?? null,
    versaoAtual: data.versaoAtual ?? null,
    version: data.version ?? 1,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
    createdByUid: data.createdByUid ?? null,
    updatedByUid: data.updatedByUid ?? null,
  };
}

type OrderMode = "codigo_asc" | "codigo_desc" | "recentes" | "antigos" | "docid";

/** Cursor opaco { value, id } codificado em base64url — mesmo padrão de G1.6.4/Ajuste 1. */
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
    const categoriaParam = (url.searchParams.get("categoria") || "").toUpperCase().trim();
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
    if (categoriaParam && !isValidCategoria(categoriaParam)) {
      return jsonError(`categoria inválida. Use um de: ${CATEGORIA_VALUES.join(", ")}`, 400);
    }

    const hasEqualityFilters = Boolean(statusParam || categoriaParam);

    if (hasEqualityFilters && orderByParam) {
      return jsonError("Não é possível ordenar os resultados quando filtros (status, categoria) estão ativos (exige índice composto).", 400);
    }

    const db = adminDb();
    const col = db.collection("globalProdutos");

    let q: FirebaseFirestore.Query = col;
    if (statusParam) q = q.where("status", "==", statusParam);
    if (categoriaParam) q = q.where("categoria", "==", categoriaParam);

    let orderMode: OrderMode;
    if (hasEqualityFilters) {
      orderMode = "docid";
    } else if (orderByParam === "codigo_desc") {
      orderMode = "codigo_desc";
    } else if (orderByParam === "recentes") {
      orderMode = "recentes";
    } else if (orderByParam === "antigos") {
      orderMode = "antigos";
    } else {
      orderMode = "codigo_asc";
    }

    switch (orderMode) {
      case "codigo_asc":
        q = q.orderBy("codigo", "asc").orderBy(FieldPath.documentId(), "asc");
        break;
      case "codigo_desc":
        q = q.orderBy("codigo", "desc").orderBy(FieldPath.documentId(), "desc");
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
        nextCursor = encodeCursor(lastDoc.get("codigo"), lastDoc.id);
      }
    }

    return NextResponse.json({
      ok: true,
      data: { items, pageSize, hasMore, nextCursor },
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

    const body = (await req.json().catch(() => null)) as CreateGlobalProdutoInput | null;
    if (!body || typeof body !== "object") return jsonError("Payload inválido.", 400);

    const codigo = String(body.codigo || "").trim().toUpperCase();
    if (!codigo) return jsonError("codigo é obrigatório.", 400);

    const nome = String(body.nome || "").trim();
    if (!nome) return jsonError("nome é obrigatório.", 400);

    const categoria = String(body.categoria || "").toUpperCase().trim();
    if (!categoria || !isValidCategoria(categoria)) {
      return jsonError(`categoria é obrigatória. Use um de: ${CATEGORIA_VALUES.join(", ")}`, 400);
    }

    const status = body.status ? String(body.status).toUpperCase().trim() : "ATIVO";
    if (!isValidStatus(status)) {
      return jsonError(`status inválido. Use um de: ${STATUS_VALUES.join(", ")}`, 400);
    }

    const descricao = body.descricao ? String(body.descricao).trim() : undefined;
    const versaoAtual = body.versaoAtual ? String(body.versaoAtual).trim() : undefined;

    const db = adminDb();
    const col = db.collection("globalProdutos");

    // Verificação BEST EFFORT de unicidade de `codigo` — mesma limitação
    // estrutural documentada para Clientes/Empresas (G1.6.4/G1.6.5): não é
    // constraint absoluta do Firestore sem coleção/índice dedicado.
    const dupSnap = await col.where("codigo", "==", codigo).limit(1).get();
    if (!dupSnap.empty) {
      return jsonError("Já existe um Produto com este código.", 409);
    }

    const now = FieldValue.serverTimestamp();
    const docData: Record<string, unknown> = {
      codigo,
      nome,
      status,
      categoria,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUid: ctx.uid,
      updatedByUid: ctx.uid,
    };
    if (descricao) docData.descricao = descricao;
    if (versaoAtual) docData.versaoAtual = versaoAtual;

    const afterSnapshot: Record<string, unknown> = { codigo, nome, status, categoria };
    if (versaoAtual) afterSnapshot.versaoAtual = versaoAtual;

    // Auditoria atômica: criação do produto e do log GLOBAL_PRODUTO_CREATED
    // no mesmo WriteBatch (mesmo padrão de globalClientes/globalEmpresas).
    const produtoRef = col.doc();
    const batch = db.batch();
    batch.set(produtoRef, docData);
    await writeGlobalAuditLog(
      {
        actorUid: ctx.uid,
        actorEmail: ctx.email || undefined,
        action: "GLOBAL_PRODUTO_CREATED",
        entity: "GLOBAL_PRODUTO",
        entityId: produtoRef.id,
        before: null,
        after: afterSnapshot,
        source: "API",
      },
      { batch }
    );
    await batch.commit();

    const created = await produtoRef.get();
    return NextResponse.json({ ok: true, data: serialize(created) }, { status: 201 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
