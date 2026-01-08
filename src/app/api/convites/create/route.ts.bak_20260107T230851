import { NextResponse } from "next/server";

import { createHash, randomBytes } from "crypto";
export const runtime = "nodejs";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

type Role = "MORADOR" | "SINDICO" | "PORTEIRO" | "FUNCIONARIO";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function randomPassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function generateInviteCode() {
  // 8 chars (sem ambíguos) + prefixo TreeCondo
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = randomBytes(8);
  for (let i = 0; i < 8; i++) out += chars[buf[i] % chars.length];
  return `TC-${out}`;
}

function hashInviteCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

async function sendEmailResend(params: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "TreeCondo <no-reply@treetechautomation.com>";
  if (!apiKey) return { skipped: true, reason: "RESEND_API_KEY não configurada" };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Resend erro: ${r.status} ${txt}`);
  }

  return { ok: true };
}

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const decoded = await aauth.verifyIdToken(token);
    const requesterUid = decoded.uid;
    const requesterEmail = (decoded.email || "").toLowerCase();

    // segurança mínima (ajuste depois com regra por condomínio)
    const isSuper = decoded.super_admin === true || requesterEmail === "treecommunity@treetechautomation.com";
    if (!isSuper) return jsonError("Sem permissão para criar convites.", 403);

    const body = (await req.json().catch(() => ({}))) as {
      condominioId?: string;
      nome?: string;
      email?: string;
      role?: Role;
      blocoId?: string | null;
      unidadeId?: string | null;
    };

    const condominioId = body.condominioId?.trim();
    const nome = (body.nome || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const role = (body.role || "MORADOR") as Role;
const blocoId = body.blocoId ? String(body.blocoId).trim() : null;
const unidadeId = body.unidadeId ? String(body.unidadeId).trim() : null;

// Regras por tipo:
// - MORADOR: bloco + unidade obrigatórios
// - SINDICO / PORTEIRO / FUNCIONARIO: bloco opcional, unidade nula
if (role === "MORADOR") {
  if (!blocoId) return jsonError("blocoId é obrigatório para morador", 400);
  if (!unidadeId) return jsonError("unidadeId é obrigatório para morador", 400);
}


    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!nome) return jsonError("nome é obrigatório", 400);
    if (!email) return jsonError("email é obrigatório", 400);
    // 1) cria/obtém usuário Auth
    let uid: string;
    let senhaTemporaria: string | null = null;

    try {
      const existing = await aauth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      senhaTemporaria = randomPassword(10);
      const created = await aauth.createUser({
        email,
        password: senhaTemporaria,
        displayName: nome,
        emailVerified: false,
        disabled: false,
      });
      uid = created.uid;
    }

    // 2) cria convite
    const conviteRef = db.collection("convites").doc();
    const conviteId = conviteRef.id;


    // Código de primeiro acesso (sem link obrigatório)
    const inviteCode = generateInviteCode();
    const inviteCodeHash = hashInviteCode(inviteCode);
    const inviteCodeLast4 = inviteCode.slice(-4);
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
    // link para primeiro acesso (ajuste o BASE_URL em produção)
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:9002";

    const primeiroAcessoUrl = `${baseUrl}/primeiro-acesso?conviteId=${conviteId}`;

    // 3) grava convites + membro PENDENTE
    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);

    await db.runTransaction(async (tx) => {
      tx.set(
        conviteRef,
        {
          codigoHash: inviteCodeHash,
          codigoLast4: inviteCodeLast4,
          expiresAt,
          tentativas: 0,
          nome,
          email,
          tipo: role === "FUNCIONARIO" ? "PORTEIRO" : role, // se quiser separar depois, ajusta
          condominioId,
          blocoId,
          unidadeId,
          bloco: blocoId ?? null,
          apartamento: unidadeId ?? null,
          createdAt: FieldValue.serverTimestamp(),
          createdByUid: requesterUid,
          createdByEmail: requesterEmail,
          uidGerado: uid,
          senhaTemporaria: senhaTemporaria, // se usuário já existia, fica null
          status: "PENDENTE",
        },
        { merge: true }
      );

      tx.set(
        membroRef,
        {
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          nome,
          email,
          role: role === "FUNCIONARIO" ? "FUNCIONARIO" : role,
          blocoId: blocoId ?? null,
          unidadeId: role === "MORADOR" ? (unidadeId ?? null) : null,
          status: "PENDENTE",
        },
        { merge: true }
      );
    });

    // 4) e-mail (se RESEND_API_KEY estiver configurada)
    const subject = "TreeCondo — Seu acesso ao condomínio";
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Bem-vindo ao TreeCondo</h2>
        <p>Olá <b>${nome}</b>, seu acesso foi criado.</p>
        <p><b>Seu código de primeiro acesso:</b></p>
        <p style="font-size:18px;letter-spacing:2px"><b>${inviteCode}</b></p>
        <p>Abra o TreeCondo e vá em <b>Primeiro acesso</b> para informar o código.</p>
        <p style="color:#666;font-size:12px">Opcional: se preferir link (pode não funcionar fora do ambiente local):</p>
        <p><a href="${primeiroAcessoUrl}" target="_blank">${primeiroAcessoUrl}</a></p>
        ${
          senhaTemporaria
            ? `<p><b>Senha temporária (para login inicial):</b> <code>${senhaTemporaria}</code></p>`
            : `<p>Seu e-mail já tinha conta. Use sua senha atual e depois conclua o primeiro acesso pelo link acima.</p>`
        }
        <p style="color:#666;font-size:12px">Se você não solicitou isso, ignore este e-mail.</p>
      </div>
    `;

    let emailInfo: any = { skipped: true };
    try {
      emailInfo = await sendEmailResend({ to: email, subject, html });
    } catch (e: any) {
      // não falha o fluxo se e-mail falhar; só retorna aviso
      emailInfo = { ok: false, error: e?.message || "Falha ao enviar email" };
    }

    return NextResponse.json({
      ok: true,
      conviteId,
      uidGerado: uid,
      emailInfo,
      primeiroAcessoUrl,
    });
  } catch (err: any) {
    console.error("[API convites/create] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
