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
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\u200B-\u200D\uFEFF]/g, "")
    .replace(/[‐-‒–—−]/g, "-");
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

  if (r === "SINDICO" || r === "ADMIN" || r === "ADMIN_CONDOMINIO") {
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
    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
      email?: string;
      senha?: string;
    };

    const codeRaw = normalizeCode(body.code);
    const email = normalizeEmail(body.email);
    const senha = String(body.senha ?? "");

    const normalized = codeRaw.replace(/^TC[‐-‒–—−]/, "TC-");
    if (!normalized || !/^TC-[A-Z0-9]{8}$/.test(normalized)) {
      return jsonError("Código inválido. Use o formato: TC-XXXXXXXX", 400);
    }
    if (!email) return jsonError("Email é obrigatório", 400);
    if (senha.length < 6) return jsonError("A senha precisa ter pelo menos 6 caracteres.", 400);

    const db = adminDb();
    const aauth = adminAuth();

    const codigoHash = sha256Hex(normalized);
    const q = await db.collection("convites").where("codigoHash", "==", codigoHash).limit(1).get();
    if (q.empty) return jsonError("Código não encontrado ou inválido.", 404);

    const conviteDoc = q.docs[0];
    const convite = conviteDoc.data() as any;

    const conviteEmail = normalizeEmail(convite.email);
    if (conviteEmail !== email) return jsonError("Este código não pertence a este e-mail.", 403);

    const status = String(convite.status || "").toUpperCase();

    // Se já concluído, ainda deixamos entrar (idempotente): gera token e devolve
    const uid = String(convite.uidGerado || "").trim();
    const condominioId = String(convite.condominioId || "").trim();
    if (!uid) return jsonError("Convite inválido (uid ausente).", 500);
    if (!condominioId) return jsonError("Convite inválido (condominioId ausente).", 500);

    const role = String(convite.tipo || convite.role || "").toUpperCase() || "MORADOR";
    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);

    // 1) Se o convite ainda não foi concluído, aqui é o ponto crítico:
    //    - seta senha server-side (não depende do client)
    //    - marca convite como CONCLUIDO
    //    - garante membro ATIVO + perms
    if (status !== "CONCLUIDO" && status !== "ACEITO") {
      // seta senha no Auth (server-side)
      await aauth.updateUser(uid, { password: senha });

      await db.runTransaction(async (tx) => {
        tx.set(
          conviteDoc.ref,
          {
            status: "CONCLUIDO",
            processedAt: FieldValue.serverTimestamp(),
            processedEmail: conviteEmail,
          },
          { merge: true }
        );

        tx.set(
          membroRef,
          {
            status: "ATIVO",
            role,
            menuPermissions: buildMenuPermissions(role),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });
    }

    // 2) gera token para o front logar e redirecionar
    const customToken = await aauth.createCustomToken(uid, {
      condominioId,
      conviteId: conviteDoc.id,
    });

    return NextResponse.json({
      ok: true,
      uid,
      condominioId,
      conviteId: conviteDoc.id,
      customToken,
      email: conviteEmail,
      role,
    });
  } catch (err: any) {
    console.error("[API convites/finalizar-primeiro-acesso] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
