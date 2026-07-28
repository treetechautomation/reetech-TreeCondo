/**
 * UN.6D.1 — API SERVER-SIDE DE INCIDENTES
 *
 * GET /api/incidentes?condominioId=...
 *
 * Substitui leitura direta do Firestore pelo client.
 * Resolve visibilidade via VinculoUnidade para MORADOR.
 * Retorna SOMENTE incidentes autorizados.
 */

import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const condominioId = url.searchParams.get("condominioId") || "";

    if (!condominioId) return jsonError("condominioId obrigatório", 400);

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente.", 401);

    let decoded: any;
    try { decoded = await adminAuth().verifyIdToken(token); }
    catch { return jsonError("Token inválido.", 401); }

    const uid = decoded.uid;
    const isSuper = decoded.super_admin === true || (decoded as any).superAdmin === true;
    const db = adminDb();

    // Check Membership
    const membroSnap = await db.collection("condominios").doc(condominioId)
      .collection("membros").doc(uid).get();
    if (!membroSnap.exists) return jsonError("Usuário não é membro deste condomínio.", 403);

    const md = membroSnap.data() || {};
    const role = String(md.role || "").toUpperCase();
    const status = String(md.status || "").toUpperCase();
    const pessoaId = String(md.pessoaId || "");

    // Super admin bypass (não precisa de status ATIVO)
    if (!isSuper && status !== "ATIVO") return jsonError("Membership inativo.", 403);

    const OPERATORS = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO", "PORTEIRO", "ZELADOR"];
    const isOperator = isSuper || OPERATORS.includes(role);

    // For operators: return all incidents
    if (isOperator) {
      const snap = await db.collection("condominios").doc(condominioId)
        .collection("incidentes").orderBy("updatedAt", "desc").get();

      const incidents = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      return NextResponse.json({ ok: true, incidents, role, isOperator: true });
    }

    // For MORADOR: resolve unidades via VinculoUnidade
    if (!pessoaId) {
      // Fallback legacy: only own incidents by criadoPorUid
      const snap = await db.collection("condominios").doc(condominioId)
        .collection("incidentes")
        .where("criadoPorUid", "==", uid)
        .orderBy("updatedAt", "desc").get();

      const incidents = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      return NextResponse.json({ ok: true, incidents, role, isOperator: false, fallback: "legacy_owner" });
    }

    // Resolve residências via VinculoUnidade
    const vincSnap = await db.collection("condominios").doc(condominioId)
      .collection("vinculosUnidades")
      .where("pessoaId", "==", pessoaId)
      .where("status", "==", "ATIVO")
      .where("resideNaUnidade", "==", true)
      .get();

    const unitDocIds = vincSnap.docs.map(d => d.data().unitDocId).filter(Boolean);
    if (unitDocIds.length === 0) {
      // No residences linked: fallback to own incidents only
      const snap = await db.collection("condominios").doc(condominioId)
        .collection("incidentes")
        .where("criadoPorUid", "==", uid)
        .orderBy("updatedAt", "desc").get();

      const incidents = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      return NextResponse.json({ ok: true, incidents, role, isOperator: false, residences: 0 });
    }

    // Query incidents matching residences + área comum + own legacy
    const allIncidents: any[] = [];
    const seen = new Set<string>();

    // 1. Incidents matching unitDocId (criadoPor or localUnitDocId)
    for (const uidoc of unitDocIds) {
      const snap = await db.collection("condominios").doc(condominioId)
        .collection("incidentes")
        .where("criadoPorUnitDocId", "==", uidoc)
        .orderBy("updatedAt", "desc").get();
      snap.docs.forEach(d => { if (!seen.has(d.id)) { seen.add(d.id); allIncidents.push({ id: d.id, ...(d.data() || {}) }); } });

      const snap2 = await db.collection("condominios").doc(condominioId)
        .collection("incidentes")
        .where("localUnitDocId", "==", uidoc)
        .orderBy("updatedAt", "desc").get();
      snap2.docs.forEach(d => { if (!seen.has(d.id)) { seen.add(d.id); allIncidents.push({ id: d.id, ...(d.data() || {}) }); } });
    }

    // 2. Área comum incidents (localUnitDocId = null, localTipo = AREA_COMUM)
    const areaComumSnap = await db.collection("condominios").doc(condominioId)
      .collection("incidentes")
      .where("localTipo", "==", "AREA_COMUM")
      .orderBy("updatedAt", "desc").get();
    areaComumSnap.docs.forEach(d => { if (!seen.has(d.id)) { seen.add(d.id); allIncidents.push({ id: d.id, ...(d.data() || {}) }); } });

    // 3. Fallback: own legacy incidents (sem criadoPorUnitDocId)
    const legacySnap = await db.collection("condominios").doc(condominioId)
      .collection("incidentes")
      .where("criadoPorUid", "==", uid)
      .orderBy("updatedAt", "desc").get();
    legacySnap.docs.forEach(d => { if (!seen.has(d.id)) { seen.add(d.id); allIncidents.push({ id: d.id, ...(d.data() || {}) }); } });

    allIncidents.sort((a: any, b: any) => {
      const da = a.updatedAt?.toMillis?.() || a.updatedAt?._seconds * 1000 || 0;
      const db = b.updatedAt?.toMillis?.() || b.updatedAt?._seconds * 1000 || 0;
      return db - da;
    });

    return NextResponse.json({ ok: true, incidents: allIncidents, role, isOperator: false, residences: unitDocIds.length });
  } catch (e: any) {
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
