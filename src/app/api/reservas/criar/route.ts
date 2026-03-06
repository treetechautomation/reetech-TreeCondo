import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isValidISODate(dateStr: string) {
  // YYYY-MM-DD simples
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function isSundayISO(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.getDay() === 0;
}

function isHolidayISO(dateStr: string) {
  // Natal e Ano Novo
  const mmdd = dateStr.slice(5);
  return mmdd === "12-25" || mmdd === "01-01";
}

function isoNoonUTC(dateStr: string) {
  // evita “virar o dia” por fuso do servidor
  return new Date(`${dateStr}T12:00:00.000Z`);
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

    const opcaoId = body?.opcaoId != null ? String(body.opcaoId) : "base";
    const opcaoNome = body?.opcaoNome != null ? String(body.opcaoNome) : "Base";
    const valorCobrado = Number(body?.valorCobrado || 0) || 0;
    const capacidadeMax = (body?.capacidadeMax == null) ? null : Number(body.capacidadeMax);

    // Se quiser manter compat com seu client:
    const precisaAprovacao = Boolean(body?.precisaAprovacao ?? true);
    const statusInicial = body?.statusInicial ? String(body.statusInicial) : "PENDENTE";

    if (!condominioId || !areaId || !dateStr) {
      return jsonError("condominioId, areaId e dateStr são obrigatórios.", 400);
    }
    if (!isValidISODate(dateStr)) {
      return jsonError("dateStr inválido. Use YYYY-MM-DD.", 400);
    }

    // Bloqueios globais
    if (isSundayISO(dateStr)) return jsonError("❌ Não é permitido fazer reservas aos domingos.", 403);
    if (isHolidayISO(dateStr)) return jsonError("❌ Não é permitido fazer reservas nesta data (feriado).", 403);

    const uid = String(decoded.uid);
    const slotId = `${areaId}__${dateStr}`;

    const slotRef = db.collection("condominios").doc(condominioId).collection("reservasSlots").doc(slotId);
    const lockRef = slotRef.collection("reservasPorUid").doc(uid);
    const filaDocRef = slotRef.collection("fila").doc(uid);

    const reservasCol = db.collection("condominios").doc(condominioId).collection("reservas");

    const result = await db.runTransaction(async (tx: any) => {
      const lockSnap = await tx.get(lockRef);
      if (lockSnap.exists) {
        const t = (lockSnap.data() || {}).tipo || "LOCK";
        throw Object.assign(new Error(`Você já tem ${t === "FILA" ? "fila" : "reserva"} neste dia/área.`), { status: 409 });
      }

      const slotSnap = await tx.get(slotRef);
      let slot = slotSnap.exists ? (slotSnap.data() || {}) : null;

      const occupied = Boolean(slot?.occupied === true);
      const filaCount = Number(slot?.filaCount || 0) || 0;

      // garante doc base
      if (!slotSnap.exists) {
        tx.set(slotRef, {
          areaId,
          dateStr,
          occupied: false,
          reservaId: null,
          filaCount: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        slot = { areaId, dateStr, occupied: false, reservaId: null, filaCount: 0 };
      }

      if (occupied) {
        // Vai pra fila (limite 3)
        if (filaCount >= 3) {
          throw Object.assign(new Error("❌ Fila cheia (limite de 3)."), { status: 409 });
        }

        tx.set(filaDocRef, {
          uid,
          status: "AGUARDANDO",
          opcaoId,
          opcaoNome,
          valorCobrado,
          capacidadeMax: Number.isFinite(Number(capacidadeMax)) ? Number(capacidadeMax) : null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        tx.set(lockRef, {
          uid,
          tipo: "FILA",
          areaId,
          dateStr,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        tx.set(slotRef, {
          filaCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        return { mode: "FILA", slotId, filaCount: filaCount + 1 };
      }

      // Slot livre -> cria reserva e ocupa
      const reservaRef = reservasCol.doc();
      const dt = isoNoonUTC(dateStr);

      tx.set(reservaRef, {
        areaId,
        condominioId,
        uid,
        status: statusInicial || "PENDENTE",
        precisaAprovacao,
        data: Timestamp.fromDate(dt),
        dateStr,
        valorCobrado,
        opcaoId,
        opcaoNome,
        capacidadeMax: Number.isFinite(Number(capacidadeMax)) ? Number(capacidadeMax) : null,
        criadoEm: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.set(slotRef, {
        areaId,
        dateStr,
        occupied: true,
        reservaId: reservaRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      tx.set(lockRef, {
        uid,
        tipo: "RESERVA",
        areaId,
        dateStr,
        reservaId: reservaRef.id,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      return { mode: "RESERVA", slotId, reservaId: reservaRef.id };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    const status = Number(err?.status || 0) || 500;
    const msg = String(err?.message || "Erro inesperado");
    console.error("[API reservas/criar] erro:", err);
    return jsonError(msg, status);
  }
}
