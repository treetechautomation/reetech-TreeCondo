import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

function upper(v: any) {
  return String(v || "").toUpperCase().trim();
}

function isOperatorRole(role: any) {
  const r = upper(role);
  return ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(r);
}

export async function POST(req: Request) {
  const db = adminDb();

  try {
    const body = await req.json().catch(() => ({}));
    const condominioId = String(body?.condominioId || "").trim();
    const areaId = String(body?.areaId || "").trim();
    const dateStr = String(body?.dateStr || "").trim();

    if (!condominioId || !areaId || !dateStr) {
      return jsonError("condominioId, areaId e dateStr são obrigatórios.", 400);
    }

    const ctx = await apiGuard({ request: req, condominioId });

    const targetUid = String(body?.targetUid || ctx.uid).trim();
    const isOperador = isOperatorRole(ctx.role) || ctx.isSuperAdmin;

    if (!isOperador && targetUid !== ctx.uid) {
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
    if (err instanceof Response) return err;
    const status = Number(err?.status || 0) || 500;
    console.error("[API reservas/fila-cancelar] erro:", err);
    return jsonError(String(err?.message || "Erro inesperado"), status);
  }
}
