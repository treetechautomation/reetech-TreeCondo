/**
 * G1.7.1 — API de Licenciamento Global (Fundação) — Painel Global Treetech.
 *
 * GET  /api/global/licencas  → listagem paginada e ordenada.
 * POST /api/global/licencas  → cria GlobalLicenca (atômico com auditoria).
 *
 * Fundação apenas: sem PATCH, DELETE, histórico ou renovação. Sem cobrança,
 * planos, assinaturas, limites, recursos ou feature flags. Sem
 * relacionamento bidirecional — nem Empresa nem Produto passam a referenciar
 * a lista de licenças; a Licença é a única entidade que aponta para ambos
 * (empresaId, produtoId). Mesmo padrão arquitetural de /api/global/produtos
 * (G1.7):
 * - Sem índices compostos: filtros de igualdade (`empresaId`, `produtoId`,
 *   `status`) combinados com orderBy explícito exigiriam índice composto —
 *   não suportado nesta fase.
 * - Cursores estáveis: orderBy de campo de negócio com desempate explícito
 *   por FieldPath.documentId(); cursor opaco { value, id }.
 * - Auditoria atômica: criação do documento e do log (GLOBAL_LICENSE_CREATED)
 *   em um único WriteBatch, via writeGlobalAuditLog() reutilizado.
 *
 * Validações do POST (Etapa 7, nesta ordem): empresa existe (404) → produto
 * existe (404) → empresa ativa (409) → produto ativo (409) → não existe
 * licença ATIVA duplicada para o mesmo par Empresa+Produto (409, best effort
 * — mesma limitação estrutural documentada para Clientes/Empresas/Produtos).
 */
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { writeGlobalAuditLog } from "@/lib/globalAuditLog";
import type { GlobalEmpresa } from "@/types/global-empresas";
import type { GlobalProduto } from "@/types/global-produtos";
import type {
  GlobalLicenca,
  GlobalLicencaStatus,
  CreateGlobalLicencaInput,
} from "@/types/global-licencas";

const STATUS_VALUES: GlobalLicencaStatus[] = ["ATIVA", "SUSPENSA", "EXPIRADA"];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function isValidStatus(v: string): v is GlobalLicencaStatus {
  return (STATUS_VALUES as string[]).includes(v);
}

function serialize(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = (doc.data() || {}) as Partial<GlobalLicenca>;
  return {
    id: doc.id,
    empresaId: data.empresaId ?? null,
    produtoId: data.produtoId ?? null,
    status: data.status ?? null,
    inicioVigencia: data.inicioVigencia?.toDate?.().toISOString() ?? null,
    fimVigencia: data.fimVigencia?.toDate?.().toISOString() ?? null,
    version: data.version ?? 1,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
    createdByUid: data.createdByUid ?? null,
    updatedByUid: data.updatedByUid ?? null,
  };
}

type OrderMode = "recentes" | "antigos" | "docid";

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
    const empresaIdParam = (url.searchParams.get("empresaId") || "").trim();
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

    const hasEqualityFilters = Boolean(empresaIdParam || produtoIdParam || statusParam);

    if (hasEqualityFilters && orderByParam) {
      return jsonError("Não é possível ordenar os resultados quando filtros (empresaId, produtoId, status) estão ativos (exige índice composto).", 400);
    }

    const db = adminDb();
    const col = db.collection("globalLicencas");

    let q: FirebaseFirestore.Query = col;
    if (empresaIdParam) q = q.where("empresaId", "==", empresaIdParam);
    if (produtoIdParam) q = q.where("produtoId", "==", produtoIdParam);
    if (statusParam) q = q.where("status", "==", statusParam);

    let orderMode: OrderMode;
    if (hasEqualityFilters) {
      orderMode = "docid";
    } else if (orderByParam === "antigos") {
      orderMode = "antigos";
    } else {
      orderMode = "recentes";
    }

    switch (orderMode) {
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
      } else {
        const ts = Timestamp.fromDate(new Date(String(decoded.value)));
        q = q.startAfter(ts, decoded.id);
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
      nextCursor =
        orderMode === "docid"
          ? encodeCursor(lastDoc.id, lastDoc.id)
          : encodeCursor(lastDoc.get("createdAt"), lastDoc.id);
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

    const body = (await req.json().catch(() => null)) as CreateGlobalLicencaInput | null;
    if (!body || typeof body !== "object") return jsonError("Payload inválido.", 400);

    const empresaId = String(body.empresaId || "").trim();
    if (!empresaId) return jsonError("empresaId é obrigatório.", 400);

    const produtoId = String(body.produtoId || "").trim();
    if (!produtoId) return jsonError("produtoId é obrigatório.", 400);

    const status = body.status ? String(body.status).toUpperCase().trim() : "ATIVA";
    if (!isValidStatus(status)) {
      return jsonError(`status inválido. Use um de: ${STATUS_VALUES.join(", ")}`, 400);
    }

    const inicioVigenciaRaw = String(body.inicioVigencia || "").trim();
    if (!inicioVigenciaRaw) return jsonError("inicioVigencia é obrigatório.", 400);
    const inicioVigenciaDate = new Date(inicioVigenciaRaw);
    if (Number.isNaN(inicioVigenciaDate.getTime())) {
      return jsonError("inicioVigencia inválido. Use uma data ISO 8601.", 400);
    }

    let fimVigenciaDate: Date | null = null;
    if (body.fimVigencia) {
      fimVigenciaDate = new Date(String(body.fimVigencia).trim());
      if (Number.isNaN(fimVigenciaDate.getTime())) {
        return jsonError("fimVigencia inválido. Use uma data ISO 8601.", 400);
      }
    }

    const db = adminDb();

    // 1. Empresa existe
    const empresaSnap = await db.collection("globalEmpresas").doc(empresaId).get();
    if (!empresaSnap.exists) return jsonError("Empresa não encontrada.", 404);

    // 2. Produto existe
    const produtoSnap = await db.collection("globalProdutos").doc(produtoId).get();
    if (!produtoSnap.exists) return jsonError("Produto não encontrado.", 404);

    // 3. Empresa ativa
    const empresaData = empresaSnap.data() as Partial<GlobalEmpresa>;
    if (empresaData.status !== "ATIVO") {
      return jsonError("Empresa não está ativa — o licenciamento exige empresa e produto ativos.", 409);
    }

    // 4. Produto ativo
    const produtoData = produtoSnap.data() as Partial<GlobalProduto>;
    if (produtoData.status !== "ATIVO") {
      return jsonError("Produto não está ativo — o licenciamento exige empresa e produto ativos.", 409);
    }

    // 5. Sem licença ATIVA duplicada para o mesmo par Empresa+Produto — BEST
    // EFFORT, mesma limitação estrutural documentada para Clientes/Empresas/
    // Produtos (não é constraint absoluta do Firestore sem coleção/índice
    // dedicado de unicidade).
    const dupSnap = await db
      .collection("globalLicencas")
      .where("empresaId", "==", empresaId)
      .where("produtoId", "==", produtoId)
      .where("status", "==", "ATIVA")
      .limit(1)
      .get();
    if (!dupSnap.empty) {
      return jsonError("Já existe uma licença ATIVA para esta Empresa e Produto.", 409);
    }

    const now = FieldValue.serverTimestamp();
    const docData: Record<string, unknown> = {
      empresaId,
      produtoId,
      status,
      inicioVigencia: Timestamp.fromDate(inicioVigenciaDate),
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUid: ctx.uid,
      updatedByUid: ctx.uid,
    };
    if (fimVigenciaDate) docData.fimVigencia = Timestamp.fromDate(fimVigenciaDate);

    const afterSnapshot: Record<string, unknown> = {
      empresaId,
      produtoId,
      status,
      inicioVigencia: inicioVigenciaDate.toISOString(),
    };
    if (fimVigenciaDate) afterSnapshot.fimVigencia = fimVigenciaDate.toISOString();

    // Auditoria atômica: criação da licença e do log GLOBAL_LICENSE_CREATED
    // no mesmo WriteBatch (mesmo padrão de globalClientes/globalEmpresas/globalProdutos).
    const licencaRef = db.collection("globalLicencas").doc();
    const batch = db.batch();
    batch.set(licencaRef, docData);
    await writeGlobalAuditLog(
      {
        actorUid: ctx.uid,
        actorEmail: ctx.email || undefined,
        action: "GLOBAL_LICENSE_CREATED",
        entity: "GLOBAL_LICENSE",
        entityId: licencaRef.id,
        before: null,
        after: afterSnapshot,
        source: "API",
      },
      { batch }
    );
    await batch.commit();

    const created = await licencaRef.get();
    return NextResponse.json({ ok: true, data: serialize(created) }, { status: 201 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
