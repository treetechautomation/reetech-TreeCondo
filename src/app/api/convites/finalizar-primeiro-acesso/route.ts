import { NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

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

type Vinculo = {
  condominioId: string;
  role: "MORADOR" | "PORTEIRO" | "SINDICO" | "ADMIN";
  blocoId?: string | null;
  unidadeId?: string | null;
  status: "ATIVO" | "INATIVO";
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      code?: string;
      senha?: string;
    };

    const email = normalizeEmail(body.email);
    const code = normalizeCode(body.code);
    const senha = String(body.senha ?? "");

    if (!email) return jsonError("Email é obrigatório", 400);
    if (!code || !/^TC-[A-Z0-9]{8}$/.test(code)) {
      return jsonError("Código inválido. Use o formato: TC-XXXXXXXX", 400);
    }
    if (senha.length < 6) return jsonError("A senha precisa ter pelo menos 6 caracteres.", 400);

    const db = adminDb();
    const auth = adminAuth();

    const codigoHash = sha256Hex(code);

    const q = await db.collection("convites").where("codigoHash", "==", codigoHash).limit(1).get();
    if (q.empty) return jsonError("Código não encontrado ou inválido.", 404);

    const conviteDoc = q.docs[0];
    const convite = conviteDoc.data() as any;

    const conviteEmail = normalizeEmail(convite.email);
    if (conviteEmail !== email) return jsonError("Este código não pertence a este e-mail.", 403);

    const status = String(convite.status || "PENDENTE").toUpperCase();
    if (status === "CONCLUIDO" || status === "ACEITO") {
      // idempotente: se já concluiu, não quebra o usuário novo
      return NextResponse.json({ ok: true, alreadyDone: true });
    }

    const uid = String(convite.uidGerado || "").trim();
    const condominioId = String(convite.condominioId || "").trim();
    const role = String(convite.tipo || convite.role || "").toUpperCase();

    if (!uid) return jsonError("Convite inválido (uid ausente).", 500);
    if (!condominioId) return jsonError("Convite inválido (condominioId ausente).", 500);

    // 1) garante usuário com senha (SEM customToken)
    try {
      await auth.updateUser(uid, {
        email,
        password: senha,
        displayName: String(convite.nome || ""),
      });
    } catch (e: any) {
      // se não existir, cria
      if (String(e?.code || "").includes("auth/user-not-found")) {
        await auth.createUser({
          uid,
          email,
          password: senha,
          displayName: String(convite.nome || ""),
        });
      } else {
        throw e;
      }
    }

    const userRef = db.collection("users").doc(uid);
    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);

    // 2) transação: vinculo + membro ativo + convite concluído
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const userData = (userSnap.exists ? userSnap.data() : {}) as any;

      const atuais: Vinculo[] = Array.isArray(userData.vinculos) ? userData.vinculos : [];
      const filtrados = atuais.filter((v) => v?.condominioId !== condominioId);

      const novo: Vinculo = {
        condominioId,
        role: (role as any) || "MORADOR",
        blocoId: convite.bloco ?? convite.blocoId ?? null,
        unidadeId: convite.apartamento ?? convite.unidadeId ?? null,
        status: "ATIVO",
      };

      tx.set(
        userRef,
        {
          email,
          displayName: String(convite.nome || userData.displayName || ""),
          activeCondominioId: condominioId,
          updatedAt: FieldValue.serverTimestamp(),
          vinculos: [...filtrados, novo],
        },
        { merge: true }
      );

      tx.set(
        membroRef,
        {
          nome: String(convite.nome || ""),
          email,
          role: (role as any) || "MORADOR",
          blocoId: convite.bloco ?? convite.blocoId ?? null,
          unidadeId: convite.apartamento ?? convite.unidadeId ?? null,
          status: "ATIVO",
          menuPermissions: buildMenuPermissions(role),
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        conviteDoc.ref,
        {
          status: "CONCLUIDO",
          processedAt: FieldValue.serverTimestamp(),
          acceptedByUid: uid,
          acceptedByEmail: email,
        },
        { merge: true }
      );
    });

    // retorna ok pro front fazer login normal (email+senha)
    return NextResponse.json({
      ok: true,
      email,
      condominioId,
      uid,
      role,
    });
  } catch (err: any) {
    console.error("[API convites/finalizar-primeiro-acesso] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
