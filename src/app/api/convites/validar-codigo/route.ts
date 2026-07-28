import { NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rateLimiter";

const MAX_ATTEMPTS = 10;
const ERROR_PUBLIC = "Código ou email inválido.";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

import { normEmail } from "@/lib/onboarding/service";
import { normalizeInviteCode, isValidInviteCode } from "@/lib/normalization/code";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { code?: string; email?: string };

    const email = normEmail(body.email);
    const code = normalizeInviteCode(body.code);

    if (!email) return jsonError("Email é obrigatório", 400);
    if (!code || !isValidInviteCode(code)) {
      return jsonError("Código inválido. Use o formato: TC-XXXXXXXX", 400);
    }

    // Rate limit — 5 tentativas/min por IP
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rl = checkRateLimit({
      key: rateLimitKey(null, ip, "convites:validar-codigo"),
      limit: 5,
      windowSec: 60,
    });
    if (!rl.allowed) return rateLimitResponse(rl);

    const db = adminDb();
    const codigoHash = sha256Hex(code);

    const q = await db.collection("convites").where("codigoHash", "==", codigoHash).limit(1).get();
    if (q.empty) {
      console.log("[convites/validar-codigo] hash não encontrado");
      return jsonError(ERROR_PUBLIC, 400);
    }

    const conviteDoc = q.docs[0];
    const convite = conviteDoc.data() as any;

    const conviteEmail = normEmail(convite.email);
    if (conviteEmail !== email) {
      console.log("[convites/validar-codigo] email mismatch");
      return jsonError(ERROR_PUBLIC, 400);
    }

    // P1-01: verifica expiração do convite
    const expiresAt: Timestamp | null = convite.expiresAt ?? null;
    if (expiresAt && expiresAt.toMillis() < Date.now()) {
      console.log("[convites/validar-codigo] convite expirado");
      // Incrementa tentativas mesmo em expirado (auditoria)
      await conviteDoc.ref.update({
        tentativas: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return jsonError("Este convite expirou. Solicite um novo código ao administrador do condomínio.", 410);
    }

    // P1-02: verifica limite de tentativas
    const tentativas = Number(convite.tentativas ?? 0);
    if (tentativas >= MAX_ATTEMPTS) {
      console.log("[convites/validar-codigo] limite de tentativas excedido");
      return jsonError("Número máximo de tentativas excedido. Solicite um novo código ao administrador.", 429);
    }

    const status = String(convite.status || "PENDENTE").toUpperCase();
    if (status === "CONCLUIDO" || status === "ACEITO") {
      console.log("[convites/validar-codigo] convite já usado");
      return jsonError(ERROR_PUBLIC, 409);
    }
    if (status === "BLOQUEADO") {
      return jsonError("Este convite está bloqueado. Solicite um novo código ao administrador.", 423);
    }

    const uid = String(convite.uidGerado || "").trim();
    const condominioId = String(convite.condominioId || "").trim();
    if (!uid) return jsonError("Convite inválido (uid ausente).", 500);
    if (!condominioId) return jsonError("Convite inválido (condominioId ausente).", 500);

    // P1-03: validação não ativa o membro — apenas marca convite como VALIDADO
    // A ativação do membro ocorre em finalizar-primeiro-acesso
    await db.runTransaction(async (tx) => {
      tx.set(
        conviteDoc.ref,
        {
          status: "VALIDADO",
          validatedAt: FieldValue.serverTimestamp(),
          validatedEmail: conviteEmail,
          tentativas: FieldValue.increment(1),
        },
        { merge: true }
      );
    });

    return NextResponse.json({
      ok: true,
      uid,
      condominioId,
      conviteId: conviteDoc.id,
      email: conviteEmail,
      nome: String(convite.nome || ""),
      role: String(convite.tipo || convite.role || ""),
      status: "VALIDADO",
    });
  } catch (err: any) {
    console.error("[API convites/validar-codigo] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
