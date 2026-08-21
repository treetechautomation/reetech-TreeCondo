/**
 * FASE 16.13 / R4 — POST /api/admin/reservas/bloqueios/criar
 * FASE 16.14 / R4.1 — transactional with coordinator touch.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { touchBlockCoordinators } from "@/lib/reservas/bloqueios-helper";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

import type { GuardRole } from "@/lib/apiGuard";
const ALLOWED_ROLES: GuardRole[] = ["ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];
const VALID_SCOPES = new Set(["TODAS_AS_AREAS", "RESERVAS_PRIVATIVAS", "USO_CAMPO", "AREA_ESPECIFICA"]);
const VALID_TARGETS = new Set(["UNIDADE", "UID"]);

export async function POST(req: Request) {
  try {
    let body: any;
    try { body = await req.json(); } catch { return jsonError("Body inválido.", 400); }

    const condominioId = String(body?.condominioId ?? "").trim();
    const tipoAlvo = String(body?.tipoAlvo ?? "").trim().toUpperCase();
    const escopo = String(body?.escopo ?? "").trim().toUpperCase();
    const motivoPublico = String(body?.motivoPublico ?? "").trim();
    const motivoInterno = String(body?.motivoInterno ?? "").trim() || null;
    const areaId = String(body?.areaId ?? "").trim() || null;

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ALLOWED_ROLES,
    });

    if (!VALID_TARGETS.has(tipoAlvo)) return jsonError("tipoAlvo inválido.", 400);
    if (!VALID_SCOPES.has(escopo)) return jsonError("escopo inválido.", 400);
    if (!motivoPublico) return jsonError("motivoPublico é obrigatório.", 400);

    let inicioEm: Date;
    try { inicioEm = new Date(body?.inicioEm); if (isNaN(inicioEm.getTime())) throw new Error(); }
    catch { inicioEm = new Date(); }

    let fimEm: Date | null = null;
    if (body?.fimEm) {
      try { fimEm = new Date(body.fimEm); if (isNaN(fimEm.getTime())) fimEm = null; }
      catch { fimEm = null; }
      if (fimEm && fimEm <= inicioEm) return jsonError("fimEm deve ser posterior a inicioEm.", 400);
    }

    let unidadeIdNorm: string | null = null;
    let blocoIdNorm: string | null = null;
    let targetUid: string | null = null;

    if (tipoAlvo === "UNIDADE") {
      unidadeIdNorm = String(body?.unidadeIdNorm ?? "").trim();
      blocoIdNorm = String(body?.blocoIdNorm ?? "").trim();
      if (!unidadeIdNorm || !blocoIdNorm) return jsonError("unidadeIdNorm e blocoIdNorm são obrigatórios.", 400);
    } else {
      targetUid = String(body?.uid ?? "").trim();
      if (!targetUid) return jsonError("uid é obrigatório.", 400);
    }

    if (escopo === "AREA_ESPECIFICA" && !areaId) return jsonError("areaId é obrigatório.", 400);

    const db = adminDb();
    const colRef = db.collection("condominios").doc(condominioId).collection("bloqueiosReservas");
    const docRef = colRef.doc();

    await db.runTransaction(async (tx: any) => {
      const ts = FieldValue.serverTimestamp();
      tx.set(docRef, {
        tipoAlvo, unidadeIdNorm, blocoIdNorm, uid: targetUid,
        escopo, areaId, ativo: true,
        motivoPublico, motivoInterno,
        inicioEm: Timestamp.fromDate(inicioEm),
        fimEm: fimEm ? Timestamp.fromDate(fimEm) : null,
        criadoEm: ts, criadoPorUid: ctx.uid,
        revogadoEm: null, revogadoPorUid: null, updatedAt: ts,
      });

      touchBlockCoordinators(tx, db, condominioId, targetUid, blocoIdNorm, unidadeIdNorm);
    });

    return NextResponse.json({ ok: true, bloqueioId: docRef.id });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
