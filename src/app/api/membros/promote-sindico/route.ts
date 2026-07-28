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

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function jsonOk(data: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...data });
}

interface DecodedToken {
  uid: string;
  email?: string;
  super_admin?: boolean;
  superAdmin?: boolean;
}

async function verifyToken(req: Request): Promise<{ decoded: DecodedToken | null; error: string | null; status?: number }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { decoded: null, error: "Token ausente.", status: 401 };
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return { decoded: decoded as unknown as DecodedToken, error: null };
  } catch {
    return { decoded: null, error: "Token inválido ou expirado.", status: 401 };
  }
}

function isSuperAdmin(decoded: DecodedToken): boolean {
  return decoded.super_admin === true || decoded.superAdmin === true;
}

const ROLES_AUTORIZADAS = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];

async function verifyAuthorization(
  uid: string,
  condominioId: string,
  isSuper: boolean,
): Promise<{ authorized: boolean; actorRole: string; error: string }> {
  if (isSuper) return { authorized: true, actorRole: "SUPER_ADMIN", error: "" };

  const db = adminDb();
  const membroRef = db
    .collection("condominios")
    .doc(condominioId)
    .collection("membros")
    .doc(uid);
  const membroSnap = await membroRef.get();

  if (!membroSnap.exists) {
    return { authorized: false, actorRole: "", error: "Você não é membro deste condomínio." };
  }

  const data = membroSnap.data();
  const role = String(data?.role || "").toUpperCase();
  const status = String(data?.status || "").toUpperCase();

  if (status !== "ATIVO") {
    return { authorized: false, actorRole: role, error: "Seu vínculo neste condomínio não está ativo." };
  }

  if (!ROLES_AUTORIZADAS.includes(role)) {
    return { authorized: false, actorRole: role, error: "Perfil sem permissão para promover síndico." };
  }

  return { authorized: true, actorRole: role, error: "" };
}

export async function POST(req: Request) {
  const { decoded, error } = await verifyToken(req);
  if (error) return jsonError(error, 401);
  if (!decoded) return jsonError("Token inválido.", 401);

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

  if (novoUid === decoded.uid) {
    return jsonError("Auto-promoção não é permitida via este endpoint.", 403);
  }

  const isSuper = isSuperAdmin(decoded);

  const authz = await verifyAuthorization(decoded.uid, condominioId, isSuper);
  if (!authz.authorized) {
    return jsonError(authz.error, 403);
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
        promovidoPor: decoded.uid,
        criadoEm: new Date(),
      });
    });

    return jsonOk({ novoUid });
  } catch (err: any) {
    console.error("[promote-sindico] Erro na transação:", err);
    return jsonError(err?.message || "Erro interno ao promover síndico.", 500);
  }
}
