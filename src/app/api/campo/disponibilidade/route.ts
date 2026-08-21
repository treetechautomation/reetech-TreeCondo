/**
 * FASE 16.6 / R1 — GET /api/campo/disponibilidade
 *
 * Lista usos do Campo para uma data.
 * Sanitiza resposta por perfil: MORADOR não vê nome/UID de outros.
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const condominioId = url.searchParams.get("condominioId") ?? "";
    const dateStr = url.searchParams.get("dateStr") ?? "";

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);
    if (!dateStr) return jsonError("dateStr é obrigatório.", 400);

    const ctx = await apiGuard({
      request,
      condominioId,
    });

    const membroRole = ctx.isSuperAdmin ? "SUPER_ADMIN" : String(ctx.membroData?.role ?? "MORADOR").toUpperCase();
    const isGestor = ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO"].includes(membroRole) || ctx.isSuperAdmin;
    const isMorador = membroRole === "MORADOR";

    const db = adminDb();
    const snapshot = await db
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

      if (isMorador) {
        return base;
      }

      return {
        ...base,
        uid: d.uid,
        nomeMorador: d.nomeMorador ?? "",
        inicioMin: d.inicioMin,
        fimMin: d.fimMin,
      };
    });

    const agendaSnap = await db
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

    return NextResponse.json({ registros, total: registros.length, exclusividades });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
