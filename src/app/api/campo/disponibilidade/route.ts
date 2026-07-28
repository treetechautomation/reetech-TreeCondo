/**
 * FASE 16.6 / R1 — GET /api/campo/disponibilidade
 *
 * Lista usos do Campo para uma data.
 * Sanitiza resposta por perfil: MORADOR não vê nome/UID de outros.
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const condominioId = url.searchParams.get("condominioId") ?? "";
  const dateStr = url.searchParams.get("dateStr") ?? "";

  if (!condominioId) return jsonError("condominioId é obrigatório.", 400);
  if (!dateStr) return jsonError("dateStr é obrigatório.", 400);

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(token);
  } catch {
    return jsonError("Não autorizado.", 401);
  }

  const uid = String(decoded.uid);
  const isSuper = !!(decoded as any)?.super_admin || !!(decoded as any)?.superAdmin;

  // Verificar membro ativo
  const membroRef = adminDb().collection("condominios").doc(condominioId).collection("membros").doc(uid);
  const membroSnap = await membroRef.get();
  if (!membroSnap.exists && !isSuper) return jsonError("Membro não encontrado.", 403);

  const membro = membroSnap.data();
  const membroRole = String(membro?.role ?? "MORADOR").toUpperCase();
  const isGestor = ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO"].includes(membroRole);
  const isMorador = membroRole === "MORADOR";

  // Query usoCampo
  const snapshot = await adminDb()
    .collection("condominios")
    .doc(condominioId)
    .collection("usoCampo")
    .where("dateStr", "==", dateStr)
    .where("status", "==", "ATIVO")
    .orderBy("inicioMin", "asc")
    .get();

  const registros = snapshot.docs.map((doc) => {
    const d = doc.data();
    const base = {
      registroId: doc.id,
      dateStr: d.dateStr,
      horaInicio: d.horaInicio,
      horaFim: d.horaFim,
      bloco: d.blocoNome ?? d.blocoIdNorm ?? "",
      unidade: d.unidadeNumero ?? d.unidadeIdNorm ?? "",
      status: d.status,
    };

    // MORADOR: sanitizado
    if (isMorador) {
      return base;
    }

    // GESTOR: projeção completa
    return {
      ...base,
      uid: d.uid,
      nomeMorador: d.nomeMorador ?? "",
      inicioMin: d.inicioMin,
      fimMin: d.fimMin,
    };
  });

  // R2 — Buscar exclusividade do dia
  const agendaSnap = await adminDb()
    .collection("condominios")
    .doc(condominioId)
    .collection("campoAgenda")
    .doc(dateStr)
    .get();

  let exclusividades: any[] = [];
  if (agendaSnap.exists) {
    const exc = agendaSnap.data()?.exclusividade ?? null;
    if (exc) {
      const now = new Date();
      const isHolding = exc.status === "HOLD" && exc.expiresAt && exc.expiresAt.toDate() > now;
      const isAtivo = exc.status === "ATIVA";
      if (isHolding || isAtivo) {
        const horas = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
        exclusividades.push({
          tipo: "EXCLUSIVIDADE",
          inicio: horas(exc.inicioMin),
          fim: horas(exc.fimMin),
          status: exc.status,
          mensagem: "Uso exclusivo vinculado à reserva da Churrasqueira 2.",
        });
      }
    }
  }

  return jsonOk({ registros, total: registros.length, exclusividades }, 200);
}
