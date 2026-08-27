/**
 * G1.7.2 — API de Planos Globais (Fundação) — Painel Global Treetech.
 *
 * GET  /api/global/planos  → listagem paginada e ordenada.
 * POST /api/global/planos  → cria GlobalPlano (atômico com auditoria).
 *
 * Fundação apenas: sem PATCH, DELETE, histórico, assinaturas, recursos,
 * limites, cobrança, preços, trial, upgrade/downgrade ou feature flags. Sem
 * relacionamento bidirecional — Produto não passa a referenciar a lista de
 * Planos; o Plano é a única entidade que aponta para o Produto (produtoId).
 * Mesmo padrão arquitetural de /api/global/produtos (G1.7):
 * - Sem índices compostos: filtros de igualdade (`produtoId`, `status`)
 *   combinados com orderBy explícito exigiriam índice composto — não
 *   suportado nesta fase.
 * - Cursores estáveis: orderBy de campo de negócio com desempate explícito
 *   por FieldPath.documentId(); cursor opaco { value, id }.
 * - Auditoria atômica: criação do documento e do log (GLOBAL_PLAN_CREATED)
 *   em um único WriteBatch, via writeGlobalAuditLog() reutilizado.
 *
 * Validações do POST (Etapa 7): payload (`codigo`, `nome`, `ordem`
 * obrigatórios) → produto existe (404) → produto ATIVO (409) → não existe
 * outro plano ATIVO com o mesmo `codigo` dentro do mesmo `produtoId` (409,
 * best effort — mesma limitação estrutural documentada para Clientes/
 * Empresas/Produtos/Licenciamento).
 *
 * Nenhum seed automático: nenhum plano padrão (Starter/Professional/...) é
 * gravado por esta rota ou durante o build.
 */
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { writeGlobalAuditLog } from "@/lib/globalAuditLog";
import type { GlobalProduto } from "@/types/global-produtos";
import type {
  GlobalPlano,
  GlobalPlanoStatus,
  CreateGlobalPlanoInput,
} from "@/types/global-planos";

const STATUS_VALUES: GlobalPlanoStatus[] = ["ATIVO", "INATIVO"];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function isValidStatus(v: string): v is GlobalPlanoStatus {
  return (STATUS_VALUES as string[]).includes(v);
}

function serialize(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = (doc.data() || {}) as Partial<GlobalPlano>;
  return {
    id: doc.id,
    produtoId: data.produtoId ?? null,
    codigo: data.codigo ?? "",
    nome: data.nome ?? "",
    descricao: data.descricao ?? null,
    status: data.status ?? null,
    ordem: data.ordem ?? null,
    version: data.version ?? 1,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
    createdByUid: data.createdByUid ?? null,
    updatedByUid: data.updatedByUid ?? null,
  };
}

type OrderMode = "ordem_asc" | "recentes" | "antigos" | "docid";

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
    const produtoIdParam = (url.searchParams.get("produtoId") || "").trim();
    const statusParam = (url.searchParams.get("status") || "").toUpperCase().trim();
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

    const hasEqualityFilters = Boolean(produtoIdParam || statusParam);

    if (hasEqualityFilters && orderByParam) {
      return jsonError("Não é possível ordenar os resultados quando filtros (produtoId, status) estão ativos (exige índice composto).", 400);
    }

    const db = adminDb();
    const col = db.collection("globalPlanos");

    let q: FirebaseFirestore.Query = col;
    if (produtoIdParam) q = q.where("produtoId", "==", produtoIdParam);
    if (statusParam) q = q.where("status", "==", statusParam);

    let orderMode: OrderMode;
    if (hasEqualityFilters) {
      orderMode = "docid";
    } else if (orderByParam === "recentes") {
      orderMode = "recentes";
    } else if (orderByParam === "antigos") {
      orderMode = "antigos";
    } else {
      orderMode = "ordem_asc";
    }

    switch (orderMode) {
      case "ordem_asc":
        q = q.orderBy("ordem", "asc").orderBy(FieldPath.documentId(), "asc");
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
        nextCursor = encodeCursor(lastDoc.get("ordem"), lastDoc.id);
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

    const body = (await req.json().catch(() => null)) as CreateGlobalPlanoInput | null;
    if (!body || typeof body !== "object") return jsonError("Payload inválido.", 400);

    const produtoId = String(body.produtoId || "").trim();
    if (!produtoId) return jsonError("produtoId é obrigatório.", 400);

    const codigo = String(body.codigo || "").trim().toUpperCase();
    if (!codigo) return jsonError("codigo é obrigatório.", 400);

    const nome = String(body.nome || "").trim();
    if (!nome) return jsonError("nome é obrigatório.", 400);

    const ordem = Number(body.ordem);
    if (body.ordem === undefined || body.ordem === null || !Number.isFinite(ordem)) {
      return jsonError("ordem é obrigatória.", 400);
    }

    const status = body.status ? String(body.status).toUpperCase().trim() : "ATIVO";
    if (!isValidStatus(status)) {
      return jsonError(`status inválido. Use um de: ${STATUS_VALUES.join(", ")}`, 400);
    }

    const descricao = body.descricao ? String(body.descricao).trim() : undefined;

    const db = adminDb();

    // Produto existe
    const produtoSnap = await db.collection("globalProdutos").doc(produtoId).get();
    if (!produtoSnap.exists) return jsonError("Produto não encontrado.", 404);

    // Produto ATIVO
    const produtoData = produtoSnap.data() as Partial<GlobalProduto>;
    if (produtoData.status !== "ATIVO") {
      return jsonError("Produto não está ATIVO — não é possível criar planos para um produto inativo.", 409);
    }

    // Sem outro plano ATIVO com o mesmo codigo dentro do mesmo produto —
    // BEST EFFORT, mesma limitação estrutural documentada para Clientes/
    // Empresas/Produtos/Licenciamento.
    const dupSnap = await db
      .collection("globalPlanos")
      .where("produtoId", "==", produtoId)
      .where("codigo", "==", codigo)
      .where("status", "==", "ATIVO")
      .limit(1)
      .get();
    if (!dupSnap.empty) {
      return jsonError("Já existe um Plano ATIVO com este código para este Produto.", 409);
    }

    const now = FieldValue.serverTimestamp();
    const docData: Record<string, unknown> = {
      produtoId,
      codigo,
      nome,
      status,
      ordem,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUid: ctx.uid,
      updatedByUid: ctx.uid,
    };
    if (descricao) docData.descricao = descricao;

    const afterSnapshot: Record<string, unknown> = { produtoId, codigo, nome, status, ordem };

    // Auditoria atômica: criação do plano e do log GLOBAL_PLAN_CREATED no
    // mesmo WriteBatch (mesmo padrão de globalClientes/globalEmpresas/globalProdutos/globalLicencas).
    const planoRef = db.collection("globalPlanos").doc();
    const batch = db.batch();
    batch.set(planoRef, docData);
    await writeGlobalAuditLog(
      {
        actorUid: ctx.uid,
        actorEmail: ctx.email || undefined,
        action: "GLOBAL_PLAN_CREATED",
        entity: "GLOBAL_PLAN",
        entityId: planoRef.id,
        before: null,
        after: afterSnapshot,
        source: "API",
      },
      { batch }
    );
    await batch.commit();

    const created = await planoRef.get();
    return NextResponse.json({ ok: true, data: serialize(created) }, { status: 201 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
