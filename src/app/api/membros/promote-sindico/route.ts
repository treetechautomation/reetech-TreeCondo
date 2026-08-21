/**
 * F.1.3 — PROMOTE-SINDICO (server-side via Admin SDK)
 *
 * POST /api/membros/promote-sindico
 *
 * Promove um membro a SINDICO, rebaixando o síndico atual a MORADOR.
 * Opera atomicamente sobre membros/{uid} (AUTHORITATIVE) e
 * userCondominios/{uid}/vinculos/{cid} (DERIVED).
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

import type { GuardRole } from "@/lib/apiGuard";
const ALLOWED_ROLES: GuardRole[] = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

export async function POST(req: Request) {
  try {
    let body: { condominioId?: string; novoUid?: string };
    try {
      body = await req.json();
    } catch {
      return jsonError("Corpo da requisição inválido.", 400);
    }

    const { condominioId, novoUid } = body;
    if (!condominioId || typeof condominioId !== "string") {
      return jsonError("condominioId é obrigatório.", 400);
    }
    if (!novoUid || typeof novoUid !== "string") {
      return jsonError("novoUid é obrigatório.", 400);
    }

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ALLOWED_ROLES,
    });

    if (novoUid === ctx.uid) {
      return jsonError("Auto-promoção não é permitida via este endpoint.", 403);
    }

    const db = adminDb();

    const targetMembroRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("membros")
      .doc(novoUid);
    const targetMembroSnap = await targetMembroRef.get();

    if (!targetMembroSnap.exists) {
      return jsonError("Usuário alvo não é membro deste condomínio.", 404);
    }

    const targetData = targetMembroSnap.data();
    const targetStatus = String(targetData?.status || "").toUpperCase();

    if (targetStatus !== "ATIVO") {
      return jsonError("O membro alvo não está ativo neste condomínio.", 400);
    }

    const targetRole = String(targetData?.role || "").toUpperCase();
    if (targetRole === "SINDICO") {
      return jsonError("O membro alvo já é o síndico deste condomínio.", 409);
    }

    try {
      await db.runTransaction(async (tx) => {
        const allMembrosRef = db.collection(`condominios/${condominioId}/membros`);
        const allMembrosSnap = await tx.get(allMembrosRef);

        let sindicoAtualUid: string | null = null;

        for (const doc of allMembrosSnap.docs) {
          const d = doc.data();
          if (String(d?.role || "").toUpperCase() === "SINDICO" && String(d?.status || "").toUpperCase() === "ATIVO") {
            sindicoAtualUid = doc.id;
            break;
          }
        }

        if (sindicoAtualUid && sindicoAtualUid !== novoUid) {
          const atualMembroRef = db
            .collection("condominios")
            .doc(condominioId)
            .collection("membros")
            .doc(sindicoAtualUid);
          tx.set(atualMembroRef, { role: "MORADOR" }, { merge: true });

          const atualVinculoRef = db
            .collection("userCondominios")
            .doc(sindicoAtualUid)
            .collection("vinculos")
            .doc(condominioId);
          tx.set(atualVinculoRef, { role: "MORADOR" }, { merge: true });
        }

        tx.set(targetMembroRef, { role: "SINDICO" }, { merge: true });

        const targetVinculoRef = db
          .collection("userCondominios")
          .doc(novoUid)
          .collection("vinculos")
          .doc(condominioId);
        tx.set(targetVinculoRef, { role: "SINDICO", status: "ATIVO" }, { merge: true });

        const mandatoRef = db.collection(`condominios/${condominioId}/mandatos`).doc();
        tx.set(mandatoRef, {
          sindicoUid: novoUid,
          anteriorUid: sindicoAtualUid || null,
          promovidoPor: ctx.uid,
          criadoEm: new Date(),
        });
      });

      return NextResponse.json({ ok: true, novoUid });
    } catch (err: any) {
      if (err instanceof Response) return err;
      console.error("[promote-sindico] Erro na transação:", err);
      return jsonError(err?.message || "Erro interno ao promover síndico.", 500);
    }
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("[promote-sindico] Erro:", e);
    return jsonError(e?.message || "Erro interno.", 500);
  }
}
