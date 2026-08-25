/**
 * FEATURE.ANUNCIOS.1 — ANEXO DE ANÚNCIO (server-side, admin SDK)
 *
 * POST   /api/anuncios/[anuncioId]/attachment  (multipart/form-data: condominioId, file)
 *   → substitui (ou cria) o anexo do anúncio.
 * DELETE /api/anuncios/[anuncioId]/attachment?condominioId=...
 *   → remove o anexo do anúncio (sem apagar o anúncio em si).
 *
 * Path do Storage é sempre derivado no servidor (condominioId autenticado
 * via apiGuard + anuncioId cujo doc precisa existir sob esse condominioId —
 * doc inexistente = 404, o que já garante isolamento cross-tenant). O
 * cliente nunca escolhe/envia um storagePath.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import type { GuardRole } from "@/lib/apiGuard";
import {
  ATTACHMENT_ALLOWED_TYPES,
  ATTACHMENT_MAX_BYTES,
  isAllowedAttachmentType,
  buildAttachmentStoragePath,
} from "@/lib/anuncios/attachment";

const MANAGERS: GuardRole[] = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

/** Idempotente: "objeto já ausente" não é uma falha. */
async function deleteStorageObjectIfExists(storagePath: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await adminStorage().file(storagePath).delete({ ignoreNotFound: true });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha ao remover arquivo do Storage." };
  }
}

export async function POST(req: Request, ctx: { params: { anuncioId: string } }) {
  try {
    const { anuncioId } = ctx.params;
    const form = await req.formData().catch(() => null);
    if (!form) return jsonError("Formulário inválido.", 400);

    const condominioId = String(form.get("condominioId") || "").trim();
    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("Arquivo obrigatório.", 400);

    const contentType = file.type || "application/octet-stream";
    if (!isAllowedAttachmentType(contentType)) {
      return jsonError(`Tipo de arquivo não permitido. Aceitos: ${ATTACHMENT_ALLOWED_TYPES.join(", ")}`, 400);
    }
    if (file.size <= 0) return jsonError("Arquivo vazio.", 400);
    if (file.size > ATTACHMENT_MAX_BYTES) {
      return jsonError(`Arquivo excede o tamanho máximo de ${Math.floor(ATTACHMENT_MAX_BYTES / (1024 * 1024))}MB.`, 400);
    }

    const authCtx = await apiGuard({ request: req, condominioId, allowedRoles: MANAGERS });

    const db = adminDb();
    const ref = db.collection("condominios").doc(condominioId).collection("anuncios").doc(anuncioId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Anúncio não encontrado.", 404);

    const current = snap.data() || {};
    const previousStoragePath: string | null = current.attachment?.storagePath || null;

    const storagePath = buildAttachmentStoragePath(condominioId, anuncioId, file.name || "arquivo");
    const buffer = Buffer.from(await file.arrayBuffer());

    // 1) Upload do novo arquivo primeiro — se falhar, nada foi persistido e o
    //    anexo anterior (se houver) continua intacto.
    try {
      await adminStorage().file(storagePath).save(buffer, {
        contentType,
        metadata: { cacheControl: "private, max-age=0" },
      });
    } catch (e: any) {
      return jsonError(e?.message || "Falha ao enviar arquivo para o Storage.", 502);
    }

    // 2) Persistir o ponteiro no Firestore. Se falhar, tenta reverter o
    //    upload (rollback) para não deixar binário órfão sem referência.
    const attachment = {
      storagePath,
      fileName: String(file.name || "arquivo"),
      contentType,
      size: file.size,
      uploadedAt: Timestamp.now(),
      removedAt: null,
    };
    try {
      await ref.update({ attachment, updatedAt: FieldValue.serverTimestamp(), updatedByUid: authCtx.uid });
    } catch (e: any) {
      await deleteStorageObjectIfExists(storagePath);
      return jsonError(e?.message || "Falha ao salvar metadados do anexo.", 500);
    }

    // 3) Só agora, com o novo anexo já persistido como ativo, remove o
    //    anterior (best-effort — falha aqui não invalida a operação: o
    //    anúncio já aponta corretamente para o novo arquivo).
    let previousCleanup: "NONE" | "OK" | "FAILED" = "NONE";
    if (previousStoragePath && previousStoragePath !== storagePath) {
      const result = await deleteStorageObjectIfExists(previousStoragePath);
      previousCleanup = result.ok ? "OK" : "FAILED";
      if (!result.ok) {
        console.error("[FEATURE.ANUNCIOS.1] Falha ao remover anexo anterior:", previousStoragePath, (result as any).error);
      }
    }

    return NextResponse.json({ ok: true, anuncioId, attachment: { ...attachment, uploadedAt: undefined }, previousCleanup });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}

export async function DELETE(req: Request, ctx: { params: { anuncioId: string } }) {
  try {
    const { anuncioId } = ctx.params;
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";
    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    const authCtx = await apiGuard({ request: req, condominioId, allowedRoles: MANAGERS });

    const db = adminDb();
    const ref = db.collection("condominios").doc(condominioId).collection("anuncios").doc(anuncioId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Anúncio não encontrado.", 404);

    const current = snap.data() || {};
    const storagePath: string | null = current.attachment?.storagePath || null;

    if (!storagePath) {
      // Idempotente: nada para remover.
      return NextResponse.json({ ok: true, anuncioId, removed: false });
    }

    const result = await deleteStorageObjectIfExists(storagePath);
    if (!result.ok) {
      return jsonError((result as any).error || "Falha ao remover arquivo do Storage.", 502);
    }

    await ref.update({
      attachment: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: authCtx.uid,
    });

    return NextResponse.json({ ok: true, anuncioId, removed: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
