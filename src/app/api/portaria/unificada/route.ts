/** FASE 16.18.2 / R6 — GET /api/portaria/unificada */
import { NextResponse } from "next/server"; export const runtime = "nodejs";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

const PORTER_ALLOWED = new Set(["SUPER_ADMIN","SINDICO","ADMIN","ADMIN_CONDOMINIO","PORTEIRO","SEGURANCA"]);
function jerr(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const condominioId = url.searchParams.get("condominioId") ?? "";
  const dateStr = url.searchParams.get("dateStr") ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (!condominioId) return jerr("condominioId required", 400);

  const auth = req.headers.get("authorization") ?? ""; const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  let d; try { d = await adminAuth().verifyIdToken(token); } catch { return jerr("Unauthorized", 401); }
  const uid = String(d.uid); const db = adminDb();
  const isSuper = (d as any)?.super_admin || (d as any)?.superAdmin;

  const mRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
  const mSnap = await mRef.get();
  const role = mSnap.exists ? String((mSnap.data() as any)?.role ?? "").toUpperCase() : "";
  if (!isSuper && !PORTER_ALLOWED.has(role)) return jerr("Sem permissão", 403);

  // Buscar usosCampo ATIVOS do dia
  const usosSnap = await db.collection("condominios").doc(condominioId)
    .collection("usoCampo").where("dateStr", "==", dateStr).where("status", "==", "ATIVO").get();

  const convidadosPendentes: any[] = [];
  for (const uDoc of usosSnap.docs) {
    const uso = uDoc.data();
    const convSnap = await uDoc.ref.collection("convidados").where("status", "==", "RESERVADO").get();
    for (const cDoc of convSnap.docs) {
      const c = cDoc.data();
      convidadosPendentes.push({
        origemTipo: "USO_CAMPO", origemId: uDoc.id, convidadoId: cDoc.id,
        area: "Campo / Quadra", dateStr: uso.dateStr, horaInicio: uso.horaInicio, horaFim: uso.horaFim,
        bloco: uso.blocoNome ?? uso.blocoIdNorm ?? "", unidade: uso.unidadeNumero ?? uso.unidadeIdNorm ?? "",
        nome: c.nome, status: "RESERVADO",
      });
    }
  }

  return NextResponse.json({ ok: true, convidadosUsoComum: convidadosPendentes });
}
