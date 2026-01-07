import { NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function normalizeCode(v: any) {
  // remove espaços + caracteres invisíveis e normaliza “traços” para "-"
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\u200B-\u200D\uFEFF]/g, "")
    .replace(/[‐-‒–—−]/g, "-"); // traços unicode -> hífen normal
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { code?: string; email?: string };

    const code = normalizeCode(body.code);
    const email = normalizeEmail(body.email);

    // aceita TC-XXXXXXXX e também TC–XXXXXXXX (qualquer traço), mas NORMALIZA pra hífen "-"
    const okFormat = /^TC-[A-Z0-9]{8}$/.test(code) || /^TC[‐-‒–—−][A-Z0-9]{8}$/.test(code);
    const normalized = code.replace(/^TC[‐-‒–—−]/, "TC-");

    if (!normalized || !/^TC-[A-Z0-9]{8}$/.test(normalized)) {
      return jsonError("Código inválido. Use o formato: TC-XXXXXXXX", 400);
    }
    if (!email) return jsonError("Email é obrigatório", 400);

    const db = adminDb();
    const aauth = adminAuth();

    const codigoHash = sha256Hex(normalized);

    // busca por hash (sem índice composto)
    const q = await db.collection("convites").where("codigoHash", "==", codigoHash).limit(1).get();
    if (q.empty) return jsonError("Código não encontrado ou inválido.", 404);

    const conviteDoc = q.docs[0];
    const convite = conviteDoc.data() as any;

    const conviteEmail = normalizeEmail(convite.email);
    if (conviteEmail !== email) return jsonError("Este código não pertence a este e-mail.", 403);

    const status = String(convite.status || "").toUpperCase();
    if (status === "PROCESSADO") return jsonError("Este código já foi usado.", 409);

    const uid = String(convite.uidGerado || "").trim();
    const condominioId = String(convite.condominioId || "").trim();
    if (!uid) return jsonError("Convite inválido (uid ausente).", 500);
    if (!condominioId) return jsonError("Convite inválido (condominioId ausente).", 500);

    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);

    // marca PROCESSADO + ativa membro
    await db.runTransaction(async (tx) => {
      tx.set(
        conviteDoc.ref,
        {
          status: "PROCESSADO",
          processedAt: FieldValue.serverTimestamp(),
          processedEmail: email,
        },
        { merge: true }
      );

      tx.set(
        membroRef,
        {
          status: "ATIVO",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    // cria custom token para o front fazer signInWithCustomToken e então updatePassword funcionar
    const customToken = await aauth.createCustomToken(uid, {
      condominioId,
      conviteId: conviteDoc.id,
    });

    return NextResponse.json({ ok: true, uid, condominioId, customToken });
  } catch (err: any) {
    console.error("[API convites/validar-codigo] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
