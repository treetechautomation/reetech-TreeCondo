import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { writeGlobalAuditLog } from "@/lib/globalAuditLog";
import type {
  GlobalCliente,
  GlobalClienteStatus,
  UpdateGlobalClienteInput,
} from "@/types/global-clientes";

const STATUS_VALUES: GlobalClienteStatus[] = ["TRIAL", "ATIVO", "SUSPENSO", "CANCELADO"];

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

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await apiGuard({
      request: req,
      requireSuperAdmin: true,
      rateLimit: { limit: 60, windowSec: 60 },
    });

    const id = params.id;
    const db = adminDb();
    const snap = await db.collection("globalClientes").doc(id).get();

    if (!snap.exists) {
      return jsonError("Cliente não encontrado.", 404);
    }

    return NextResponse.json({ ok: true, data: serialize(snap) });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await apiGuard({
      request: req,
      requireSuperAdmin: true,
      rateLimit: { limit: 20, windowSec: 60 },
    });

    const id = params.id;
    const body = (await req.json().catch(() => null)) as UpdateGlobalClienteInput & { version: number } | null;
    if (!body || typeof body !== "object") return jsonError("Payload inválido.", 400);

    const version = Number(body.version);
    if (!Number.isFinite(version) || version < 1) {
      return jsonError("A 'version' atual é obrigatória para o controle de concorrência.", 400);
    }

    const db = adminDb();
    const docRef = db.collection("globalClientes").doc(id);
    
    // AJUSTE 3 (G1.6.4 — revisão final): checagem BEST EFFORT de unicidade — não é
    // uma constraint estrutural do Firestore. Sem coleção/índice dedicado de
    // unicidade, concorrência extrema entre esta leitura e o commit da transaction
    // abaixo ainda pode produzir duplicidade. Limitação conhecida, não alterada
    // nesta fase.
    let documentoNorm: string | undefined;
    if (body.documento !== undefined) {
      documentoNorm = body.documento ? normalizeDoc(body.documento) : "";
      if (documentoNorm) {
        const dupSnap = await db.collection("globalClientes")
          .where("documentoNorm", "==", documentoNorm)
          .limit(1)
          .get();
        if (!dupSnap.empty && dupSnap.docs[0].id !== id) {
          return jsonError("Já existe outro Cliente com este documento.", 409);
        }
      }
    }

    await db.runTransaction(async (t) => {
      const snap = await t.get(docRef);
      if (!snap.exists) throw new Error("NOT_FOUND");
      
      const currentData = snap.data() as Partial<GlobalCliente>;
      const currentVersion = currentData.version ?? 1;

      if (currentVersion !== version) {
        throw new Error("CONCURRENCY_ERROR");
      }

      const updates: Record<string, unknown> = {};
      const afterSnapshot: Record<string, unknown> = {};
      const beforeSnapshot: Record<string, unknown> = {};

      if (body.nome !== undefined) {
        const nome = String(body.nome).trim();
        if (!nome) throw new Error("VALIDATION_ERROR: nome é obrigatório");
        updates.nome = nome;
        updates.nomeBusca = normalizeBusca(nome);
        beforeSnapshot.nome = currentData.nome;
        afterSnapshot.nome = updates.nome;
      }

      if (body.status !== undefined) {
        const status = String(body.status).toUpperCase().trim();
        if (!isValidStatus(status)) throw new Error("VALIDATION_ERROR: status inválido");
        updates.status = status;
        beforeSnapshot.status = currentData.status;
        afterSnapshot.status = updates.status;
      }

      if (body.documento !== undefined) {
        updates.documento = String(body.documento).trim() || null;
        updates.documentoNorm = updates.documento ? normalizeDoc(updates.documento as string) : null;
        beforeSnapshot.documento = currentData.documento;
        afterSnapshot.documento = updates.documento;
      }

      if (body.cidade !== undefined) {
        updates.cidade = String(body.cidade).trim() || null;
        updates.cidadeNorm = updates.cidade ? normalizeBusca(updates.cidade as string) : null;
        beforeSnapshot.cidade = currentData.cidade;
        afterSnapshot.cidade = updates.cidade;
      }

      if (body.uf !== undefined) {
        updates.uf = String(body.uf).trim().toUpperCase() || null;
        updates.ufNorm = updates.uf ? normalizeBusca(updates.uf as string) : null;
        beforeSnapshot.uf = currentData.uf;
        afterSnapshot.uf = updates.uf;
      }

      if (body.nomeFantasia !== undefined) updates.nomeFantasia = String(body.nomeFantasia).trim() || null;
      if (body.razaoSocial !== undefined) updates.razaoSocial = String(body.razaoSocial).trim() || null;
      if (body.email !== undefined) updates.email = String(body.email).trim() || null;
      if (body.telefone !== undefined) updates.telefone = String(body.telefone).trim() || null;
      if (body.observacoes !== undefined) updates.observacoes = String(body.observacoes).trim() || null;

      if (Object.keys(updates).length === 0) {
        throw new Error("NO_CHANGES");
      }

      updates.version = currentVersion + 1;
      updates.updatedAt = FieldValue.serverTimestamp();
      updates.updatedByUid = ctx.uid;

      t.update(docRef, updates);

      // AJUSTE 2 (G1.6.4 — revisão final): auditoria atômica via helper único,
      // reaproveitado do POST — grava dentro da mesma Transaction (t.set), nunca
      // isoladamente. Se o commit falhar, nem a mutação nem o log são persistidos.
      await writeGlobalAuditLog(
        {
          actorUid: ctx.uid,
          actorEmail: ctx.email || undefined,
          action: "GLOBAL_CLIENT_UPDATED",
          entity: "GLOBAL_CLIENT",
          entityId: id,
          before: beforeSnapshot,
          after: afterSnapshot,
          source: "API",
        },
        { transaction: t }
      );
    });

    // Mock a snap object so we can serialize it properly
    const updatedSnap = await docRef.get();
    return NextResponse.json({ ok: true, data: serialize(updatedSnap) });

  } catch (e: any) {
    if (e instanceof Response) return e;
    if (e?.message === "NOT_FOUND") return jsonError("Cliente não encontrado.", 404);
    if (e?.message === "CONCURRENCY_ERROR") return jsonError("O cliente foi modificado por outro usuário. Recarregue os dados e tente novamente.", 409);
    if (e?.message === "NO_CHANGES") return jsonError("Nenhuma alteração enviada.", 400);
    if (e?.message?.startsWith("VALIDATION_ERROR:")) return jsonError(e.message.split(":")[1].trim(), 400);
    
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
