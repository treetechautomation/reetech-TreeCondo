import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function upper(v: any) {
  return String(v || "").toUpperCase().trim();
}

function isOperatorRole(role: any) {
  const r = upper(role);
  return ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(r);
}

async function getActorInfo(db: any, condominioId: string, uid: string, decoded: any) {
  let nome = String(decoded?.name || decoded?.email || "Usuário").trim();
  let role: string | null = null;
  let status: string | null = null;

  try {
    const msnap = await db
      .collection("condominios")
      .doc(condominioId)
      .collection("membros")
      .doc(uid)
      .get();

    if (msnap.exists) {
      const md = msnap.data() || {};
      if (md?.nome) nome = String(md.nome).trim();
      if (md?.role) role = String(md.role).trim();
      if (md?.status) status = String(md.status).trim();
    }
  } catch (e: any) {
    console.warn("[reservas/fila-cancelar] getActorInfo falhou:", e?.message || String(e));
  }

  return { uid, nome, role, status };
}

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const decoded = await aauth.verifyIdToken(token);

    const body = await req.json().catch(() => ({}));
    const condominioId = String(body?.condominioId || "").trim();
    const areaId = String(body?.areaId || "").trim();
    const dateStr = String(body?.dateStr || "").trim();
    const targetUid = String(body?.targetUid || decoded.uid).trim();

    if (!condominioId || !areaId || !dateStr) {
      return jsonError("condominioId, areaId e dateStr são obrigatórios.", 400);
    }

    const actor = await getActorInfo(db, condominioId, decoded.uid, decoded);
    const isOperador =
      isOperatorRole(actor.role) ||
      (decoded as any)?.super_admin === true ||
      (decoded as any)?.superAdmin === true;

    if (!isOperador) {
      if (upper(actor.status) !== "ATIVO") {
        return jsonError("Membro inativo.", 403);
      }
    }

    if (!isOperador && targetUid !== decoded.uid) {
      return jsonError("Sem permissão para remover este usuário da fila.", 403);
    }

    const slotId = `${areaId}__${dateStr}`;
    const slotRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("reservasSlots")
      .doc(slotId);

    const filaRef = slotRef.collection("fila").doc(targetUid);
    const lockRef = slotRef.collection("reservasPorUid").doc(targetUid);

    await db.runTransaction(async (tx: any) => {
        const filaSnap = await tx.get(filaRef);
        if (!filaSnap.exists) {
          throw Object.assign(new Error("Fila não encontrada para este usuário."), { status: 404 });
        }

        const lockSnap = await tx.get(lockRef);

        tx.delete(filaRef);

        if (lockSnap.exists) {
          const ld = lockSnap.data() || {};
          if (String(ld.tipo || "").toUpperCase() === "FILA") {
            tx.delete(lockRef);
          }
        }

        tx.set(
          slotRef,
          {
            filaCount: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const status = Number(err?.status || 0) || 500;
    console.error("[API reservas/fila-cancelar] erro:", err);
    return jsonError(String(err?.message || "Erro inesperado"), status);
  }
}
