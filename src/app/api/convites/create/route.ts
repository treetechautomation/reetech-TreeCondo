import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
export const runtime = "nodejs";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { normUnidade, normBloco } from "@/lib/normalization/location";
import { buildMenuPermissions } from "@/lib/pessoas/menuPermissions";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

type Role = "MORADOR" | "SINDICO" | "PORTEIRO" | "FUNCIONARIO" | "ADMIN_CONDOMINIO" | "ZELADOR" | "ADMIN" | "SUPER_ADMIN";

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

async function sendEmailResend(params: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { skipped: true, reason: "RESEND_API_KEY não configurada" };

  const fallbackFrom = "TreeCondo <no-reply@treetechautomation.com>";
  const rawFrom = (process.env.RESEND_FROM || "").trim();
  const isValidFrom = /^([^<>@\n]+\s<[^<>@\s\n]+@[^<>@\s\n]+\.[^<>@\s\n]+>|[^<>@\s\n]+@[^<>@\s\n]+\.[^<>@\s\n]+>)$/.test(rawFrom) ||
    /^[^<>@\s\n]+@[^<>@\s\n]+\.[^<>@\s\n]+$/.test(rawFrom);
  const from = isValidFrom ? rawFrom : fallbackFrom;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: params.to, subject: params.subject, html: params.html }),
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
    const body = (await req.json().catch(() => ({}))) as any;

    const condominioId = String(body.condominioId || "").trim();
    const nome = (body.nome || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const role = (body.role || "MORADOR") as Role;
    const targetRole = String(role).toUpperCase();

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
    if (!nome) return jsonError("nome é obrigatório", 400);
    if (!email) return jsonError("email é obrigatório", 400);

    // UNIT A reconciliation — auth/tenant/role check consolidated via apiGuard
    // (replaces the previous inline vínculo lookup; apiGuard also falls back
    // to the membros collection, which the inline version did not).
    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"],
    });

    const requesterUid = ctx.uid;
    const requesterEmail = ctx.email;
    const requesterRole = ctx.isSuperAdmin ? "SUPER_ADMIN" : (ctx.role || "").toUpperCase();

    // Role hierarchy: who can create what roles
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

    const blocoId = (body as any).blocoId ? String((body as any).blocoId).trim() : (body as any).bloco ? String((body as any).bloco).trim() : null;
    const unidadeId = (body as any).unidadeId ? String((body as any).unidadeId).trim() : ((body as any).apartamento ?? (body as any).unidade) ? String((body as any).apartamento ?? (body as any).unidade).trim() : null;
    const unitDocId = (body as any).unitDocId ? String((body as any).unitDocId).trim() : null;

    // Regras por tipo:
    // - MORADOR: bloco + unidade obrigatórios
    // - SINDICO / ADMIN_CONDOMINIO / PORTEIRO / FUNCIONARIO: bloco opcional, unidade nula
    if (role === "MORADOR") {
      if (!blocoId) return jsonError("blocoId é obrigatório para morador", 400);
      if (!unidadeId && !unitDocId) return jsonError("unidadeId ou unitDocId é obrigatório para morador", 400);
    }

    // F.1.5 — Normalização de bloco/unidade
    const blocoIdNormVal = blocoId ? normBloco(blocoId) : null;

    // F.1.5 — Validação server-side: bloco pertence ao condomínio
    if (blocoId) {
      const blocoRef = db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId);
      const blocoSnap = await blocoRef.get();
      if (!blocoSnap.exists) return jsonError("Bloco não pertence a este condomínio.", 400);
    }

    // F.2.2 — Validação server-side: unitDocId pertence ao bloco
    let unidadeNumeroFromDoc: string | null = null;
    if (unitDocId && blocoId) {
      const unidadeRef = db.collection("condominios").doc(condominioId).collection("blocos").doc(blocoId).collection("unidades").doc(unitDocId);
      const unidadeSnap = await unidadeRef.get();
      if (!unidadeSnap.exists) return jsonError("Unidade não encontrada no bloco informado.", 400);
      unidadeNumeroFromDoc = (unidadeSnap.data() || {}).numero ?? null;
    }

    // F.2.2 — Se unitDocId foi fornecido, usa numero do doc; senão usa unidadeId legado
    const resolvedUnidadeId = unidadeNumeroFromDoc || unidadeId;
    const unidadeIdNormVal = resolvedUnidadeId ? normUnidade(resolvedUnidadeId) : null;

    // P1.0 — Etapa 7B (P1-2): personId NUNCA é aceito do client (body.personId era ignorado
    // sem validação). É derivado pelo backend buscando uma Pessoa canônica já existente
    // neste condomínio por e-mail — mesmo padrão já usado em pessoas/create-or-update.
    // Se não existir, permanece null — nunca inventamos uma Pessoa aqui.
    let resolvedPersonId: string | null = null;
    if (email) {
      const pessoaByEmail = await db.collection("condominios").doc(condominioId)
        .collection("pessoas")
        .where("emailNorm", "==", email)
        .where("status", "==", "ATIVO")
        .limit(1)
        .get();
      if (!pessoaByEmail.empty) {
        resolvedPersonId = pessoaByEmail.docs[0].id;
      }
    }

    // 1) cria/obtém usuário Auth
    //
    // ADMIN_CONDOMINIO.1C-R2 — decisão arquitetural: para ADMIN_CONDOMINIO e
    // SINDICO, o primeiro acesso acontece EXCLUSIVAMENTE pelo link/código de
    // convite (finalizar-primeiro-acesso). Não há necessidade técnica de
    // senha alguma no momento da criação — createUser aceita `password`
    // como campo opcional (firebase-admin@12.7.0, CreateRequest extends
    // UpdateRequest, `password?: string`). Para esses dois perfis, o Auth
    // user é criado SEM senha: fica literalmente impossível autenticar via
    // signInWithEmailAndPassword antes de concluir o primeiro acesso, o que
    // fecha o bypass na origem (não apenas por interceptação pós-login).
    // Para os demais perfis (MORADOR, PORTEIRO, ZELADOR, FUNCIONARIO, ADMIN)
    // o comportamento permanece exatamente como no gate 1C.
    //
    // UNIT A RECONCILIATION NOTE (SECURITY.P0.11): this gate MUST NOT be
    // removed. See src/app/api/convites/__tests__/first-access-link-flow.test.ts.
    const isLinkOnlyRole = targetRole === "ADMIN_CONDOMINIO" || targetRole === "SINDICO";

    let uid: string;
    let senhaTemporaria: string | null = null;
    let existingAccountReused = false;

    try {
      const existing = await aauth.getUserByEmail(email);
      uid = existing.uid;
      existingAccountReused = true;
    } catch {
      if (isLinkOnlyRole) {
        const created = await aauth.createUser({
          email,
          displayName: nome,
          emailVerified: false,
          disabled: false,
        });
        uid = created.uid;
      } else {
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
    }

    const conviteRef = db.collection("convites").doc();
    const conviteId = conviteRef.id;

    // Código de primeiro acesso (sem link obrigatório)
    const inviteCode = generateInviteCode();
    const inviteCodeHash = hashInviteCode(inviteCode);
    const inviteCodeLast4 = inviteCode.slice(-4);
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:9002";

    // ADMIN_CONDOMINIO.1C-R2 — a página /primeiro-acesso lê o parâmetro
    // `code` (pré-preenche o campo do código), não `conviteId`. O parâmetro
    // `conviteId` não é consumido pela página, o que tornaria o link do
    // e-mail não-funcional na prática. `conviteId` não é usado na URL
    // porque o código em texto puro (necessário para pré-preencher o
    // formulário) só existe neste momento — nunca é persistido (apenas seu
    // hash SHA-256, em codigoHash).
    const primeiroAcessoUrl = `${baseUrl}/primeiro-acesso?code=${encodeURIComponent(inviteCode)}`;

    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
    const userCondominioRootRef = db.collection("userCondominios").doc(uid);

    await db.runTransaction(async (tx) => {
      // FASE 1: TODAS AS LEITURAS (antes de qualquer escrita)
      const convitesDuplicados = await tx.get(
        db.collection("convites").where("email", "==", email).where("condominioId", "==", condominioId).where("status", "==", "PENDENTE").limit(1)
      );
      if (!convitesDuplicados.empty) throw new Error("Já existe um convite pendente para este e-mail neste condomínio.");

      const rootSnap = await tx.get(userCondominioRootRef);
      const rootExists = rootSnap.exists;

      const membroSnap = await tx.get(membroRef);
      if (membroSnap.exists) {
        const membroData = membroSnap.data();
        if (String(membroData?.status || "").toUpperCase() === "ATIVO") {
          throw new Error("Este usuário já é membro ativo deste condomínio.");
        }
      }

      const isFuncionario = role === "FUNCIONARIO";
      const membroRole = isFuncionario ? "ZELADOR" : role;
      const membroTipo = isFuncionario ? "FUNCIONARIO" : null;
      const membroFuncionarioTipo = isFuncionario ? (body.funcionarioTipo || null) : null;

      // FASE 2: TODAS AS ESCRITAS (após todas as leituras)
      if (!rootExists) {
        tx.set(userCondominioRootRef, { email, nome, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), source: "convite-create" }, { merge: true });
      }

      tx.set(conviteRef, {
        codigoHash: inviteCodeHash, codigoLast4: inviteCodeLast4, expiresAt, tentativas: 0,
        nome, email, tipo: isFuncionario ? "FUNCIONARIO" : role, condominioId,
        blocoId, unidadeId: resolvedUnidadeId, unitDocId: unitDocId || null,
        unidadeIdNorm: unidadeIdNormVal, blocoIdNorm: blocoIdNormVal,
        bloco: blocoId ?? null, apartamento: resolvedUnidadeId ?? null,
        createdAt: FieldValue.serverTimestamp(), createdByUid: requesterUid, createdByEmail: requesterEmail,
        uidGerado: uid, status: "PENDENTE",
      }, { merge: true });

      tx.set(membroRef, {
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        nome, email, role: membroRole, tipo: membroTipo, funcionarioTipo: membroFuncionarioTipo,
        blocoId: blocoId ?? null,
        unidadeId: isFuncionario ? null : (role === "MORADOR" ? (resolvedUnidadeId ?? null) : null),
        unitDocId: isFuncionario ? null : (role === "MORADOR" ? (unitDocId ?? null) : null),
        blocoIdNorm: blocoIdNormVal,
        unidadeIdNorm: isFuncionario ? null : (role === "MORADOR" ? unidadeIdNormVal : null),
        personId: resolvedPersonId, status: "PENDENTE",
      }, { merge: true });
    });

    // 4) e-mail (se RESEND_API_KEY estiver configurada)
    const subject = "TreeCondo — Seu acesso ao condomínio";
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Bem-vindo ao TreeCondo</h2>
        <p>Olá <b>${nome}</b>, seu acesso foi criado.</p>
        <p><a href="${primeiroAcessoUrl}" target="_blank" style="display:inline-block;background:#00D0E6;color:#04222b;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Concluir meu primeiro acesso</a></p>
        <p style="color:#666;font-size:12px">Ou, se preferir, abra o TreeCondo e informe o código abaixo em <b>Primeiro acesso</b>:</p>
        <p style="font-size:18px;letter-spacing:2px"><b>${inviteCode}</b></p>
        ${
          isLinkOnlyRole
            ? `<p>Ao abrir o link ou informar o código, você define sua própria senha para concluir o cadastro${
                existingAccountReused ? " neste condomínio" : ""
              }.</p>`
            : senhaTemporaria
              ? `<p>Use o código acima na tela de <b>Primeiro acesso</b> para criar sua própria senha e concluir seu cadastro.</p>`
              : `<p>Seu e-mail já tinha conta. Use o código acima na tela de <b>Primeiro acesso</b> para concluir seu cadastro neste condomínio.</p>`
        }
        <p style="color:#666;font-size:12px">Se você não solicitou isso, ignore este e-mail.</p>
      </div>
    `;

    let emailInfo: any = { skipped: true };
    try {
      emailInfo = await sendEmailResend({ to: email, subject, html });
    } catch (e: any) {
      emailInfo = { ok: false, error: e?.message || "Falha ao enviar email" };
    }

    return NextResponse.json({ ok: true, conviteId, uidGerado: uid, emailInfo, primeiroAcessoUrl });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("[API convites/create] erro:", err?.message ?? err);
    const msg = String(err?.message ?? err);
    if (msg.includes("Já existe um convite")) return jsonError(msg, 409);
    if (msg.includes("já é membro ativo")) return jsonError(msg, 409);
    return jsonError(msg || "Erro inesperado", 500);
  }
}
