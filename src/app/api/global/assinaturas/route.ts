/**
 * G1.7.3 — API de Assinaturas Globais (Fundação) — Painel Global Treetech.
 *
 * GET  /api/global/assinaturas  → listagem paginada e ordenada.
 * POST /api/global/assinaturas  → cria GlobalAssinatura (atômico com auditoria).
 *
 * Conecta comercialmente Empresa → Assinatura → Plano → Produto, SEM
 * substituir globalLicencas. Licença ("esta Empresa está autorizada a usar
 * este Produto?") ≠ Assinatura ("qual Plano desse Produto a Empresa
 * contratou e durante qual período?"). POST não escreve em globalLicencas —
 * apenas lê, para validar compatibilidade.
 *
 * Fundação apenas: sem PATCH, DELETE, histórico, renovação, troca de plano,
 * cancelamento, suspensão operacional, cobrança, preços, desconto, cupom,
 * moeda, periodicidade, limite, recurso, feature flag, trial ou UI. Sem
 * relacionamento bidirecional — nenhuma das quatro entidades relacionadas
 * (Empresa/Produto/Plano/Licença) passa a referenciar a lista de
 * assinaturas.
 *
 * Mesmo padrão arquitetural das demais APIs globais homologadas:
 * - Sem índices compostos: filtros de igualdade (`empresaId`, `produtoId`,
 *   `planoId`, `status`) combinados com orderBy explícito exigiriam índice
 *   composto — não suportado nesta fase (400).
 * - Cursores estáveis: orderBy de campo de negócio com desempate explícito
 *   por FieldPath.documentId(); cursor opaco { value, id }. Nunca filtra uma
 *   página em memória e a apresenta como resultado global.
 * - Auditoria atômica: criação do documento e do log
 *   (GLOBAL_SUBSCRIPTION_CREATED) em um único WriteBatch, via
 *   writeGlobalAuditLog() reutilizado.
 *
 * Validações do POST (Etapa 7, nesta ordem): Empresa (existe → 404; ATIVO →
 * 409) → Produto (existe → 404; ATIVO → 409) → Plano (existe → 404; ATIVO →
 * 409; plano.produtoId === produtoId → 409) → Licença (existe → 404; ATIVA →
 * 409; licenca.empresaId === empresaId → 409; licenca.produtoId ===
 * produtoId → 409) → vigência (Etapa 8) → duplicidade (Etapa 9, best effort).
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
import type { GlobalPlano } from "@/types/global-planos";
import type { GlobalLicenca } from "@/types/global-licencas";
import type {
  GlobalAssinatura,
  GlobalAssinaturaStatus,
  CreateGlobalAssinaturaInput,
} from "@/types/global-assinaturas";

const STATUS_VALUES: GlobalAssinaturaStatus[] = ["ATIVA", "SUSPENSA", "ENCERRADA"];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function isValidStatus(v: string): v is GlobalAssinaturaStatus {
  return (STATUS_VALUES as string[]).includes(v);
}

function serialize(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = (doc.data() || {}) as Partial<GlobalAssinatura>;
  return {
    id: doc.id,
    empresaId: data.empresaId ?? null,
    produtoId: data.produtoId ?? null,
    planoId: data.planoId ?? null,
    licencaId: data.licencaId ?? null,
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
    const planoIdParam = (url.searchParams.get("planoId") || "").trim();
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

    const hasEqualityFilters = Boolean(empresaIdParam || produtoIdParam || planoIdParam || statusParam);

    if (hasEqualityFilters && orderByParam) {
      return jsonError("Não é possível ordenar os resultados quando filtros (empresaId, produtoId, planoId, status) estão ativos (exige índice composto).", 400);
    }

    const db = adminDb();
    const col = db.collection("globalAssinaturas");

    let q: FirebaseFirestore.Query = col;
    if (empresaIdParam) q = q.where("empresaId", "==", empresaIdParam);
    if (produtoIdParam) q = q.where("produtoId", "==", produtoIdParam);
    if (planoIdParam) q = q.where("planoId", "==", planoIdParam);
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

    const body = (await req.json().catch(() => null)) as CreateGlobalAssinaturaInput | null;
    if (!body || typeof body !== "object") return jsonError("Payload inválido.", 400);

    const empresaId = String(body.empresaId || "").trim();
    if (!empresaId) return jsonError("empresaId é obrigatório.", 400);

    const produtoId = String(body.produtoId || "").trim();
    if (!produtoId) return jsonError("produtoId é obrigatório.", 400);

    const planoId = String(body.planoId || "").trim();
    if (!planoId) return jsonError("planoId é obrigatório.", 400);

    const licencaId = String(body.licencaId || "").trim();
    if (!licencaId) return jsonError("licencaId é obrigatório.", 400);

    const status = body.status ? String(body.status).toUpperCase().trim() : "ATIVA";
    if (!isValidStatus(status)) {
      return jsonError(`status inválido. Use um de: ${STATUS_VALUES.join(", ")}`, 400);
    }

    const db = adminDb();

    // ── Etapa 7.1 — Empresa ──
    const empresaSnap = await db.collection("globalEmpresas").doc(empresaId).get();
    if (!empresaSnap.exists) return jsonError("Empresa não encontrada.", 404);
    const empresaData = empresaSnap.data() as Partial<GlobalEmpresa>;
    if (empresaData.status !== "ATIVO") {
      return jsonError("Empresa não está ATIVA.", 409);
    }

    // ── Etapa 7.2 — Produto ──
    const produtoSnap = await db.collection("globalProdutos").doc(produtoId).get();
    if (!produtoSnap.exists) return jsonError("Produto não encontrado.", 404);
    const produtoData = produtoSnap.data() as Partial<GlobalProduto>;
    if (produtoData.status !== "ATIVO") {
      return jsonError("Produto não está ATIVO.", 409);
    }

    // ── Etapa 7.3 — Plano ──
    const planoSnap = await db.collection("globalPlanos").doc(planoId).get();
    if (!planoSnap.exists) return jsonError("Plano não encontrado.", 404);
    const planoData = planoSnap.data() as Partial<GlobalPlano>;
    if (planoData.status !== "ATIVO") {
      return jsonError("Plano não está ATIVO.", 409);
    }
    if (planoData.produtoId !== produtoId) {
      return jsonError("O Plano informado não pertence ao Produto informado.", 409);
    }

    // ── Etapa 7.4 — Licença ──
    const licencaSnap = await db.collection("globalLicencas").doc(licencaId).get();
    if (!licencaSnap.exists) return jsonError("Licença não encontrada.", 404);
    const licencaData = licencaSnap.data() as Partial<GlobalLicenca>;
    if (licencaData.status !== "ATIVA") {
      return jsonError("Licença não está ATIVA.", 409);
    }
    if (licencaData.empresaId !== empresaId) {
      return jsonError("A Licença informada não pertence à Empresa informada.", 409);
    }
    if (licencaData.produtoId !== produtoId) {
      return jsonError("A Licença informada não pertence ao Produto informado.", 409);
    }

    // ── Etapa 8 — Vigência ──
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
      if (fimVigenciaDate.getTime() <= inicioVigenciaDate.getTime()) {
        return jsonError("fimVigencia deve ser posterior a inicioVigencia.", 400);
      }
    }

    // ── Etapa 9 — Duplicidade (BEST EFFORT) ──
    // Não permite outra Assinatura ATIVA para o mesmo par empresaId+produtoId,
    // mesmo com Plano diferente — uma Empresa só deve possuir um Plano ativo
    // por Produto neste estágio da arquitetura. Mesma limitação estrutural
    // documentada para Clientes/Empresas/Produtos/Licenciamento/Planos: não é
    // uma constraint absoluta do Firestore sem coleção/índice dedicado de
    // unicidade — concorrência extrema entre esta leitura e o commit abaixo
    // ainda pode produzir duplicidade.
    const dupSnap = await db
      .collection("globalAssinaturas")
      .where("empresaId", "==", empresaId)
      .where("produtoId", "==", produtoId)
      .where("status", "==", "ATIVA")
      .limit(1)
      .get();
    if (!dupSnap.empty) {
      return jsonError("Já existe uma Assinatura ATIVA para esta Empresa e Produto.", 409);
    }

    const now = FieldValue.serverTimestamp();
    const docData: Record<string, unknown> = {
      empresaId,
      produtoId,
      planoId,
      licencaId,
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
      planoId,
      licencaId,
      status,
      inicioVigencia: inicioVigenciaDate.toISOString(),
    };
    if (fimVigenciaDate) afterSnapshot.fimVigencia = fimVigenciaDate.toISOString();

    // Auditoria atômica: criação da assinatura e do log
    // GLOBAL_SUBSCRIPTION_CREATED no mesmo WriteBatch. Não escreve em
    // globalLicencas — Etapa 11 (não atualizar, não alterar status, não
    // criar licença automaticamente).
    const assinaturaRef = db.collection("globalAssinaturas").doc();
    const batch = db.batch();
    batch.set(assinaturaRef, docData);
    await writeGlobalAuditLog(
      {
        actorUid: ctx.uid,
        actorEmail: ctx.email || undefined,
        action: "GLOBAL_SUBSCRIPTION_CREATED",
        entity: "GLOBAL_SUBSCRIPTION",
        entityId: assinaturaRef.id,
        before: null,
        after: afterSnapshot,
        source: "API",
      },
      { batch }
    );
    await batch.commit();

    const created = await assinaturaRef.get();
    return NextResponse.json({ ok: true, data: serialize(created) }, { status: 201 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
