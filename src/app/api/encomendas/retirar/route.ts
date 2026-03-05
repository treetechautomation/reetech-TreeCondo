
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { createHash } from "crypto";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function sha256(v: string) {
  return createHash("sha256").update(v, "utf8").digest("hex");
}

function normUnidade(v: any) {
  return String(v || "")
    .toLowerCase()
    .replace(/\b(apto|apt|apartamento|unidade)\b/gi, "")
    .replace(/[^0-9a-z]/gi, "")
    .trim();
}

function normBloco(v: any) {
  return String(v || "").toLowerCase().trim();
}

async function getActorInfo(db: any, params: { condominioId: string; uid: string; decoded: any }) {
  const { condominioId, uid, decoded } = params;
  const email = String(decoded?.email || "").toLowerCase();
  let nome = String(decoded?.name || decoded?.email || "Operador").trim();
  let role: string | null = null;

  try {
    const mref = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);
    const msnap = await mref.get();
    if (msnap.exists) {
      const md = msnap.data() || {};
      if (md?.nome) nome = String(md.nome).trim();
      if (md?.role) role = String(md.role).trim();
    }
  } catch (e: any) {
    console.warn("[encomendas/retirar] getActorInfo falhou:", e?.message || String(e));
  }

  return { uid, email, nome, role };
}

async function notifyUnidade(db: any, params: {
  condominioId: string;
  unidadeId: string;
  blocoId?: string | null;
  tipo: string;
  title: string;
  message: string;
  encomendaId: string;
}) {
  const condId = params.condominioId;
  const unidadeId = String(params.unidadeId || "").trim();
  if (!condId || !unidadeId) return;

  const alvoUn = normUnidade(unidadeId);
  const alvoBl = (params.blocoId ?? null) ? normBloco(params.blocoId) : null;
  
  const membrosRef = db.collection("condominios").doc(condId).collection("membros");
  
  let q = membrosRef.where("unidadeIdNorm", "==", alvoUn);
  if (alvoBl) {
    q = q.where("blocoIdNorm", "==", alvoBl);
  }

  const snap = await q.get();

  const membros = snap.docs
    .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((m: any) => {
      const st = String(m.status || "").toUpperCase();
      return st === "ATIVO" || st === "PENDENTE";
    });

  if (membros.length === 0) {
    console.log("[encomendas/retirar] Nenhum morador (ATIVO/PENDENTE) para unidade:", unidadeId, "bloco:", (params.blocoId ?? null));
    return;
  }

  const batch = db.batch();
  membros.forEach((m: any) => {
    const uid = m.id;
    const ref = db.collection("condominios").doc(condId).collection("notificacoes").doc();

    batch.set(ref, {
      tipo: params.tipo,
      title: params.title,
      message: params.message,
      titulo: params.title,
      mensagem: params.message,
      targetUid: uid,
      condominioId: condId,
      encomendaId: params.encomendaId,
      unidadeId: params.unidadeId,
      blocoId: params.blocoId ?? null,
      lida: false,
      arquivada: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  await batch.commit();
  console.log("[encomendas/retirar] Notificações criadas para", membros.length, "moradores da unidade", unidadeId);
}

export async function POST(req: Request) {
  const db = adminDb();
  const aauth = adminAuth();

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const decoded = await aauth.verifyIdToken(token);
    const body = (await req.json().catch(() => ({}))) as any;

    const condominioId = String(body?.condominioId || "").trim();
    const encomendaId = String(body?.encomendaId || "").trim();
    
    const codigo = body?.codigo ? String(body.codigo).trim() : "";
    
    const moradorUid = body?.moradorUid ? String(body.moradorUid).trim() : "";
    const pinMorador = body?.pinMorador ? String(body.pinMorador).trim() : "";
    const recebedorNome = body?.recebedorNome ? String(body.recebedorNome).trim() : "";
    const recebedorCpf = body?.recebedorCpf ? String(body.recebedorCpf).trim() : "";
    const recebedorParentesco = body?.recebedorParentesco ? String(body.recebedorParentesco).trim() : "";

    if (!condominioId) return jsonError("condominioId é obrigatório", 400);
      if (!encomendaId) return jsonError("encomendaId é obrigatório", 400);

      const actor = await getActorInfo(db, { condominioId, uid: decoded.uid, decoded });
    
    const ref = db.collection("condominios").doc(condominioId).collection("encomendas").doc(encomendaId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Encomenda não encontrada.", 404);

    const data = snap.data() as any;
    if (String(data?.status || "") === "RETIRADA") {
      return jsonError("Essa encomenda já foi retirada.", 400);
    }
    
    // Modo SEM Celular (PIN)
    if (moradorUid && pinMorador) {
        const pinDigits = pinMorador.replace(/\D/g, "");
        if (pinDigits.length < 4) return jsonError("PIN inválido.", 400);
        if (!recebedorNome) return jsonError("O nome de quem retira é obrigatório.", 400);

        const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(moradorUid);
        const membroSnap = await membroRef.get();
        if (!membroSnap.exists) return jsonError("Morador selecionado não encontrado.", 404);

        const membroData = membroSnap.data() as any;
        const failedAttempts = membroData.encomendaPinFailedAttempts || 0;

        if (failedAttempts >= 6) {
            return jsonError("PIN bloqueado por excesso de tentativas. O morador precisa redefinir o PIN na tela de Configurações.", 429);
        }

        const pinHash = sha256(pinDigits);
        if (pinHash !== membroData.encomendaPinHash) {
            const newAttempts = failedAttempts + 1;
            await membroRef.update({ encomendaPinFailedAttempts: newAttempts });
            const attemptsLeft = 6 - newAttempts;
            const errorMsg = attemptsLeft > 0
                ? `PIN inválido. Você tem mais ${attemptsLeft} tentativas.`
                : "PIN inválido. Seu PIN foi bloqueado.";
            return jsonError(errorMsg, 403);
        }

        // PIN correto, prossegue
        await db.runTransaction(async (tx) => {
            if (failedAttempts > 0) {
                tx.update(membroRef, { encomendaPinFailedAttempts: 0 });
            }
            tx.update(ref, {
                status: "RETIRADA",
                retiradaEm: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                registradoPorUid: decoded.uid,
                  registradoPorNome: (decoded.name || decoded.email || "Porteiro").toString(),

                  // quem confirmou a retirada (porteiro/operador)
                  retiradoPorUid: actor.uid,
                  retiradoPorNome: actor.nome,
                  retiradoPorEmail: actor.email,
                  retiradoPorRole: actor.role,
                retiradaRecebedorNome: recebedorNome,
                retiradaRecebedorCpfHash: recebedorCpf ? sha256(recebedorCpf.replace(/\D/g, "")) : null,
                retiradaRecebedorCpfLast4: recebedorCpf ? recebedorCpf.replace(/\D/g, "").slice(-4) : null,
                retiradaRecebedorParentesco: recebedorParentesco || "Não informado",
            });
        });

    // Modo COM Celular (Código/QR)
    } else if (codigo) {
        if (sha256(codigo) !== String(data?.codigoRetiradaHash || "")) {
            return jsonError("Código de retirada inválido.", 403);
        }
        await ref.update({
            status: "RETIRADA",
            retiradaEm: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            registradoPorUid: decoded.uid,
                  registradoPorNome: (decoded.name || decoded.email || "Porteiro").toString(),

                  // quem confirmou a retirada (porteiro/operador)
                  retiradoPorUid: actor.uid,
                  retiradoPorNome: actor.nome,
                  retiradoPorEmail: actor.email,
                  retiradoPorRole: actor.role,
            retiradaRecebedorNome: recebedorNome || "Próprio morador",
        });
    } else {
        return jsonError("Informe o código da encomenda (PKG-...) ou use o modo 'Sem Celular' com PIN do morador.", 400);
    }
    
    // Notificação de retirada
    try {
      await notifyUnidade(db, {
        condominioId,
        unidadeId: String(data?.unidadeId || ""),
        blocoId: data?.blocoId ?? null,
        tipo: "ENCOMENDA_RETIRADA",
        title: "✅ Encomenda retirada",
        message: `Sua encomenda da ${data?.transportadora || "transportadora"} foi retirada por ${recebedorNome || "você"}.`,
        encomendaId,
      });
    } catch (e: any) {
      console.error("[encomendas/retirar] falha ao notificar:", e?.message || e);
    }
    
    return NextResponse.json({ ok: true });

  } catch (err: any) {
    console.error("[API encomendas/retirar] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
