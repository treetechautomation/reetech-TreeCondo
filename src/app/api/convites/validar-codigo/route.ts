import { NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function normalizeCode(v: any) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\u200B-\u200D\uFEFF]/g, "")
    .replace(/[‐-‒–—−]/g, "-")
    .replace(/^TC[‐-‒–—−]/, "TC-");
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function buildMenuPermissions(role: string) {
  const r = String(role || "").toUpperCase();
  const base: Record<string, boolean> = { dashboard: true };

  if (r === "MORADOR") {
    return {
      ...base,
      acesso: true,
      anuncios: true,
      documentos: true,
      enquetes: true,
      reservas: true,
      encomendas: true,
      reunioes: true,
      cadastros: false,
      configuracoes: false,
      condominios: false,
      administradorGlobal: false,
      incidentes: false,
    };
  }

  if (r === "PORTEIRO") {
    return {
      ...base,
      acesso: true,
      encomendas: true,
      incidentes: true,
      anuncios: true,
      documentos: true,
      administradorGlobal: false,
      cadastros: false,
      configuracoes: false,
      condominios: false,
      reservas: false,
      enquetes: false,
      reunioes: false,
    };
  }

  if (r === "SINDICO") {
    return {
      dashboard: true,
      condominios: true,
      cadastros: true,
      configuracoes: true,
      anuncios: true,
      documentos: true,
      enquetes: true,
      reservas: true,
      encomendas: true,
      incidentes: true,
      reunioes: true,
      acesso: true,
      administradorGlobal: false,
    };
  }

  return { ...base };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { code?: string; email?: string };

    const email = normalizeEmail(body.email);
    const code = normalizeCode(body.code);

    if (!email) return jsonError("Email é obrigatório", 400);
    if (!code || !/^TC-[A-Z0-9]{8}$/.test(code)) {
      return jsonError("Código inválido. Use o formato: TC-XXXXXXXX", 400);
    }

    const db = adminDb();
    const codigoHash = sha256Hex(code);

    const q = await db.collection("convites").where("codigoHash", "==", codigoHash).limit(1).get();
    if (q.empty) return jsonError("Código não encontrado ou inválido.", 404);

    const conviteDoc = q.docs[0];
    const convite = conviteDoc.data() as any;

    const conviteEmail = normalizeEmail(convite.email);
    if (conviteEmail !== email) return jsonError("Este código não pertence a este e-mail.", 403);

    const status = String(convite.status || "PENDENTE").toUpperCase();
    if (status === "CONCLUIDO" || status === "ACEITO") {
      return jsonError("Este código já foi usado.", 409);
    }

    const uid = String(convite.uidGerado || "").trim();
    const condominioId = String(convite.condominioId || "").trim();
    if (!uid) return jsonError("Convite inválido (uid ausente).", 500);
    if (!condominioId) return jsonError("Convite inválido (condominioId ausente).", 500);

    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);

    // marca como VALIDADO (não consome); o consumo fica no finalizar-primeiro-acesso
    await db.runTransaction(async (tx) => {
      tx.set(
        conviteDoc.ref,
        {
          status: "VALIDADO",
          validatedAt: FieldValue.serverTimestamp(),
          validatedEmail: conviteEmail,
        },
        { merge: true }
      );

      tx.set(
        membroRef,
        {
          status: "ATIVO",
          menuPermissions: buildMenuPermissions(String(convite.tipo || convite.role || "")),
          updatedAt: FieldValue.serverTimestamp(),
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
