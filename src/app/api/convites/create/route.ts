import { NextResponse } from "next/server";

import { createHash, randomBytes } from "crypto";
export const runtime = "nodejs";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { normUnidade, normBloco } from "@/lib/normalization/location";

type Role = "MORADOR" | "SINDICO" | "PORTEIRO" | "FUNCIONARIO" | "ADMIN_CONDOMINIO" | "ZELADOR" | "ADMIN" | "SUPER_ADMIN";

import { buildMenuPermissions } from "@/lib/pessoas/menuPermissions";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function randomPassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
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
  const apiKeyLen = (process.env.RESEND_API_KEY || "").length;
  console.log(
    "[convites/create] RESEND_API_KEY presente?",
    Boolean(process.env.RESEND_API_KEY),
    "len=",
    apiKeyLen,
  );
  console.log(
    "[convites/create] RESEND_FROM=",
    process.env.RESEND_FROM || "(default)",
  );

  const fallbackFrom = "TreeCondo <no-reply@treetechautomation.com>";
  const rawFrom = (process.env.RESEND_FROM || "").trim();
  const isValidFrom =
    /^([^<>@\n]+\s<[^<>@\s\n]+@[^<>@\s\n]+\.[^<>@\s\n]+>|[^<>@\s\n]+@[^<>@\s\n]+\.[^<>@\s\n]+)$/.test(
      rawFrom,
    );
  const from = isValidFrom ? rawFrom : fallbackFrom;
  if (!apiKey)
    return { skipped: true, reason: "RESEND_API_KEY não configurada" };

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
    console.error("[convites/create] Resend erro", r.status, txt);
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
    if (!token)
      return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const decoded = await aauth.verifyIdToken(token);

    // Lê o corpo da requisição uma única vez
    const body = (await req.json().catch(() => ({}))) as any;

    const requesterUid = decoded.uid;
    const requesterEmail = (decoded.email || "").toLowerCase();

    // Permissão: SUPER_ADMIN global OU gestor (SINDICO/ADMIN) do condomínio ativo
    const isSuper =
      decoded.super_admin === true ||
      (decoded as any).superAdmin === true ||
      String((decoded as any).role || "").toUpperCase() === "SUPER_ADMIN" ||
      (Array.isArray((decoded as any).roles) &&
        (decoded as any).roles.includes("SUPER_ADMIN"));
    let requesterRole = "";
    // Se não for super, valida vínculo ATIVO no condomínio
    if (!isSuper) {
      const condominioIdPeek = String(body?.condominioId || "").trim();
      if (!condominioIdPeek)
        return jsonError("condominioId é obrigatório", 400);

      const vincRef = db
        .collection("userCondominios")
        .doc(requesterUid)
        .collection("vinculos")
        .doc(condominioIdPeek);

      const vincSnap = await vincRef.get();
      const role =
        (vincSnap.exists ? (vincSnap.data()?.role as string) : "") || "";
      const status =
        (vincSnap.exists ? (vincSnap.data()?.status as string) : "") || "";

      const canManage =
        status === "ATIVO" &&
        (role === "SINDICO" || role === "ADMIN" || role === "ADMIN_CONDOMINIO");

      if (!canManage)
        return jsonError("Sem permissão para criar convites.", 403);

      requesterRole = role.toUpperCase();
    } else {
      requesterRole = "SUPER_ADMIN";
    }

    const condominioId = body.condominioId?.trim();
    const nome = (body.nome || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const role = (body.role || "MORADOR") as Role;

    const targetRole = String(role).toUpperCase();

    const ALLOWED_TARGET_ROLES: Record<string, string[]> = {
      SUPER_ADMIN: ["SUPER_ADMIN", "ADMIN", "ADMIN_CONDOMINIO", "SINDICO", "MORADOR", "PORTEIRO", "ZELADOR", "FUNCIONARIO"],
      ADMIN_CONDOMINIO: ["SINDICO", "MORADOR", "PORTEIRO", "ZELADOR", "FUNCIONARIO"],
      ADMIN: ["SINDICO", "MORADOR", "PORTEIRO", "ZELADOR", "FUNCIONARIO"],
      SINDICO: ["MORADOR", "PORTEIRO", "ZELADOR", "FUNCIONARIO"],
    };

    const allowedTargets = ALLOWED_TARGET_ROLES[requesterRole];
    if (!allowedTargets || !allowedTargets.includes(targetRole)) {
      console.warn(
        `[API convites/create] Bloqueada tentativa de criação de convite: solicitante (UID: ${requesterUid.substring(0, 4)}***, papel solicitante: ${requesterRole}) tentou criar papel ${targetRole}.`
      );
      return jsonError("Você não tem privilégios para convidar um usuário com este papel.", 403);
    }
    const blocoId = (body as any).blocoId
      ? String((body as any).blocoId).trim()
      : (body as any).bloco
        ? String((body as any).bloco).trim()
        : null;

    const unidadeId = (body as any).unidadeId
      ? String((body as any).unidadeId).trim()
      : ((body as any).apartamento ?? (body as any).unidade)
        ? String((body as any).apartamento ?? (body as any).unidade).trim()
        : null;

    const unitDocId = (body as any).unitDocId
      ? String((body as any).unitDocId).trim()
      : null;
    // Regras por tipo:
    // - MORADOR: bloco + unidade obrigatórios
    // - SINDICO / ADMIN_CONDOMINIO / PORTEIRO / FUNCIONARIO: bloco opcional, unidade nula
    if (role === "MORADOR") {
      if (!blocoId) return jsonError("blocoId é obrigatório para morador", 400);
      if (!unidadeId && !unitDocId)
        return jsonError("unidadeId ou unitDocId é obrigatório para morador", 400);
    }

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!nome) return jsonError("nome é obrigatório", 400);
    if (!email) return jsonError("email é obrigatório", 400);

    // F.1.5 — Normalização de bloco/unidade
    const blocoIdNormVal = blocoId ? normBloco(blocoId) : null;

    // F.1.5 — Validação server-side: bloco pertence ao condomínio
    if (blocoId) {
      const blocoRef = db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId);
      const blocoSnap = await blocoRef.get();
      if (!blocoSnap.exists) {
        return jsonError("Bloco não pertence a este condomínio.", 400);
      }
    }

    // F.2.2 — Validação server-side: unitDocId pertence ao bloco
    let unidadeNumeroFromDoc: string | null = null;
    if (unitDocId && blocoId) {
      const unidadeRef = db
        .collection("condominios")
        .doc(condominioId)
        .collection("blocos")
        .doc(blocoId)
        .collection("unidades")
        .doc(unitDocId);
      const unidadeSnap = await unidadeRef.get();
      if (!unidadeSnap.exists) {
        return jsonError("Unidade não encontrada no bloco informado.", 400);
      }
      const unidadeData = unidadeSnap.data();
      unidadeNumeroFromDoc = unidadeData?.numero ?? null;
    }

    // F.2.2 — Se unitDocId foi fornecido, usa numero do doc; senão usa unidadeId legado
    const resolvedUnidadeId = unidadeNumeroFromDoc || unidadeId;
    const unidadeIdNormVal = resolvedUnidadeId ? normUnidade(resolvedUnidadeId) : null;

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
    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );
    // link para primeiro acesso (ajuste o BASE_URL em produção)
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:9002";

    const primeiroAcessoUrl = `${baseUrl}/primeiro-acesso?conviteId=${conviteId}`;

    // 3) grava convites + membro PENDENTE (transação com anti-duplicidade atômica)
    const membroRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("membros")
      .doc(uid);
    const userCondominioRootRef = db.collection("userCondominios").doc(uid);

    await db.runTransaction(async (tx) => {
      // FASE 1: TODAS AS LEITURAS (antes de qualquer escrita)
      // F.1.5 — Anti-duplicidade convite (mesmo email + mesmo condo + status PENDENTE)
      const convitesDuplicados = await tx.get(
        db.collection("convites")
          .where("email", "==", email)
          .where("condominioId", "==", condominioId)
          .where("status", "==", "PENDENTE")
          .limit(1)
      );
      if (!convitesDuplicados.empty) {
        throw new Error("Já existe um convite pendente para este e-mail neste condomínio.");
      }

      // Verifica se documento raiz do usuário existe em userCondominios
      const rootSnap = await tx.get(userCondominioRootRef);
      const rootExists = rootSnap.exists;

      // F.1.5 — Anti-duplicidade membership: membro ATIVO não pode ser recriado
      const membroSnap = await tx.get(membroRef);
      if (membroSnap.exists) {
        const membroData = membroSnap.data();
        const membroStatus = String(membroData?.status || "").toUpperCase();
        if (membroStatus === "ATIVO") {
          throw new Error("Este usuário já é membro ativo deste condomínio.");
        }
      }

      const isFuncionario = role === "FUNCIONARIO";
      const membroRole = isFuncionario ? "ZELADOR" : role;
      const membroTipo = isFuncionario ? "FUNCIONARIO" : null;
      const membroFuncionarioTipo = isFuncionario ? (body.funcionarioTipo || null) : null;

      // FASE 2: TODAS AS ESCRITAS (após todas as leituras)
      if (!rootExists) {
        tx.set(
          userCondominioRootRef,
          {
            email,
            nome,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            source: "convite-create",
          },
          { merge: true },
        );
      }

      tx.set(
        conviteRef,
        {
          codigoHash: inviteCodeHash,
          codigoLast4: inviteCodeLast4,
          expiresAt,
          tentativas: 0,
          nome,
          email,
          tipo: isFuncionario ? "FUNCIONARIO" : role,
          condominioId,
          blocoId,
          unidadeId: resolvedUnidadeId,
          unitDocId: unitDocId || null,
          unidadeIdNorm: unidadeIdNormVal,
          blocoIdNorm: blocoIdNormVal,
          bloco: blocoId ?? null,
          apartamento: resolvedUnidadeId ?? null,
          createdAt: FieldValue.serverTimestamp(),
          createdByUid: requesterUid,
          createdByEmail: requesterEmail,
          uidGerado: uid,
          status: "PENDENTE",
        },
        { merge: true },
      );

      tx.set(
        membroRef,
        {
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          nome,
          email,
          role: membroRole,
          tipo: membroTipo,
          funcionarioTipo: membroFuncionarioTipo,
          blocoId: blocoId ?? null,
          unidadeId: isFuncionario ? null : (role === "MORADOR" ? (resolvedUnidadeId ?? null) : null),
          unitDocId: isFuncionario ? null : (role === "MORADOR" ? (unitDocId ?? null) : null),
          blocoIdNorm: blocoIdNormVal,
          unidadeIdNorm: isFuncionario ? null : (role === "MORADOR" ? unidadeIdNormVal : null),
          personId: body.personId || null,
          status: "PENDENTE",
        },
        { merge: true },
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
    console.error("[API convites/create] erro:", err?.message ?? err);
    const msg = String(err?.message ?? err);
    if (msg.includes("Já existe um convite")) {
      return jsonError(msg, 409);
    }
    if (msg.includes("já é membro ativo")) {
      return jsonError(msg, 409);
    }
    return jsonError(msg || "Erro inesperado", 500);
  }
}
