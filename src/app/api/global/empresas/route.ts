/**
 * G1.6.5 — API de Empresas Globais (Fundação) — Painel Global Treetech.
 *
 * GET  /api/global/empresas  → listagem paginada e ordenada.
 * POST /api/global/empresas  → cria GlobalEmpresa (atômico com auditoria).
 *
 * Fundação apenas: sem PATCH, sem histórico, sem qualquer vínculo com
 * Cliente/Condomínio/Produto. Mesmo padrão arquitetural estabelecido para
 * Clientes Globais (G1.6.2–G1.6.4):
 * - Restrições de índice (sem criar índices compostos): se `nome` for
 *   informado, único orderBy permitido é `nome_asc`, sem outros filtros. Se
 *   outros filtros (`status`, `cidade`, `uf`, `documento`) forem informados,
 *   único orderBy permitido é o default (`__name__`).
 * - Cursores estáveis: toda ordenação de campo de negócio tem desempate
 *   explícito por FieldPath.documentId(); cursor opaco { value, id }.
 * - Auditoria atômica: criação do documento e do log em um único WriteBatch.
 * - Verificação de duplicidade por documentoNormalizado é best effort (mesma
 *   limitação estrutural documentada para Clientes — ver G1.6.4).
 */
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { writeGlobalAuditLog } from "@/lib/globalAuditLog";
import type {
  GlobalEmpresa,
  GlobalEmpresaStatus,
  CreateGlobalEmpresaInput,
} from "@/types/global-empresas";

const STATUS_VALUES: GlobalEmpresaStatus[] = ["TRIAL", "ATIVO", "SUSPENSO", "CANCELADO"];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function isValidStatus(v: string): v is GlobalEmpresaStatus {
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
  const data = (doc.data() || {}) as Partial<GlobalEmpresa>;
  return {
    id: doc.id,
    nome: data.nome ?? "",
    nomeBusca: data.nomeBusca ?? "",
    documento: data.documento ?? null,
    cidade: data.cidade ?? null,
    uf: data.uf ?? null,
    status: data.status ?? null,
    version: data.version ?? 1,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
    createdByUid: data.createdByUid ?? null,
    updatedByUid: data.updatedByUid ?? null,
  };
}

type OrderMode = "nome_asc" | "nome_desc" | "recentes" | "antigos" | "docid";

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
    const col = db.collection("globalEmpresas");

    let q: FirebaseFirestore.Query = col;

    if (statusParam) q = q.where("status", "==", statusParam);
    if (documentoParam) q = q.where("documentoNormalizado", "==", normalizeDoc(documentoParam));
    if (cidadeParam) q = q.where("cidadeBusca", "==", normalizeBusca(cidadeParam));
    if (ufParam) q = q.where("uf", "==", ufParam.toUpperCase());

    let orderMode: OrderMode;
    if (nomeParam) {
      const norm = normalizeBusca(nomeParam);
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
      orderMode = "nome_asc";
    }

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

    const body = (await req.json().catch(() => null)) as CreateGlobalEmpresaInput | null;
    if (!body || typeof body !== "object") return jsonError("Payload inválido.", 400);

    const nome = String(body.nome || "").trim();
    if (!nome) return jsonError("nome é obrigatório.", 400);

    const status = body.status ? String(body.status).toUpperCase().trim() : "TRIAL";
    if (!isValidStatus(status)) {
      return jsonError(`status inválido. Use um de: ${STATUS_VALUES.join(", ")}`, 400);
    }

    const documento = body.documento ? String(body.documento).trim() : undefined;
    const cidade = body.cidade ? String(body.cidade).trim() : undefined;
    const uf = body.uf ? String(body.uf).trim().toUpperCase() : undefined;

    const db = adminDb();
    const col = db.collection("globalEmpresas");

    // Verificação BEST EFFORT de unicidade — mesma limitação estrutural
    // documentada para Clientes (G1.6.4, Ajuste 3): não é constraint absoluta.
    const documentoNormalizado = documento ? normalizeDoc(documento) : undefined;
    if (documentoNormalizado) {
      const dupSnap = await col.where("documentoNormalizado", "==", documentoNormalizado).limit(1).get();
      if (!dupSnap.empty) {
        return jsonError("Já existe uma Empresa com este documento.", 409);
      }
    }

    const nomeBusca = normalizeBusca(nome);
    const now = FieldValue.serverTimestamp();

    const docData: Record<string, unknown> = {
      nome,
      nomeBusca,
      status,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUid: ctx.uid,
      updatedByUid: ctx.uid,
    };
    if (documento) docData.documento = documento;
    if (documentoNormalizado) docData.documentoNormalizado = documentoNormalizado;
    if (cidade) {
      docData.cidade = cidade;
      docData.cidadeBusca = normalizeBusca(cidade);
    }
    if (uf) docData.uf = uf;

    const afterSnapshot: Record<string, unknown> = { nome, status };
    if (documento) afterSnapshot.documento = documento;
    if (cidade) afterSnapshot.cidade = cidade;
    if (uf) afterSnapshot.uf = uf;

    // Auditoria atômica: criação da empresa e do log no mesmo WriteBatch
    // (mesmo padrão de globalClientes — G1.6.4, Ajuste 2).
    const empresaRef = col.doc();
    const batch = db.batch();
    batch.set(empresaRef, docData);
    await writeGlobalAuditLog(
      {
        actorUid: ctx.uid,
        actorEmail: ctx.email || undefined,
        action: "GLOBAL_EMPRESA_CREATED",
        entity: "GLOBAL_EMPRESA",
        entityId: empresaRef.id,
        before: null,
        after: afterSnapshot,
        source: "API",
      },
      { batch }
    );
    await batch.commit();

    const created = await empresaRef.get();
    return NextResponse.json({ ok: true, data: serialize(created) }, { status: 201 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
