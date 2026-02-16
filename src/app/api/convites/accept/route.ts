import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

type InviteDoc = {
  email: string;
  nome?: string;
  tipo: "MORADOR" | "PORTEIRO" | "SINDICO" | "ADMIN";
  condominioId: string;
  bloco?: string | null;
  apartamento?: string | null;
  uidGerado?: string | null;
  status?: string;
};

type Vinculo = {
  condominioId: string;
  role: "MORADOR" | "PORTEIRO" | "SINDICO" | "ADMIN";
  blocoId?: string | null;
  unidadeId?: string | null;
  status: "ATIVO" | "INATIVO";
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return jsonError("Token ausente (Authorization: Bearer ...)", 401);

    const { conviteId } = (await req.json().catch(() => ({}))) as { conviteId?: string };
    if (!conviteId) return jsonError("conviteId é obrigatório", 400);

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;
    const email = (decoded.email || "").toLowerCase();
    if (!email) return jsonError("Usuário autenticado sem email", 401);

    const db = adminDb();

    const conviteRef = db.collection("convites").doc(conviteId);
    const conviteSnap = await conviteRef.get();
    if (!conviteSnap.exists) return jsonError("Convite não encontrado", 404);

    const convite = conviteSnap.data() as InviteDoc;

    if ((convite.email || "").toLowerCase() !== email) {
      return jsonError("Email do convite não corresponde ao usuário logado", 403);
    }

    if (!convite.condominioId || !convite.tipo) {
      return jsonError("Convite inválido (faltando condominioId/tipo)", 400);
    }

    const statusAtual = (convite.status || "PENDENTE").toUpperCase();
    if (statusAtual === "CONCLUIDO" || statusAtual === "ACEITO") {
      return NextResponse.json({ ok: true, alreadyAccepted: true, condominioId: convite.condominioId });
    }

    const condominioId = convite.condominioId;
    const role = convite.tipo;

    const userRef = db.collection("users").doc(uid);
    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(uid);

    // Atualiza users/{uid}.vinculos[] sem duplicar condominioId
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const userData = (userSnap.exists ? userSnap.data() : {}) as any;

      const atuais: Vinculo[] = Array.isArray(userData.vinculos) ? userData.vinculos : [];
      const filtrados = atuais.filter((v) => v?.condominioId !== condominioId);

      const novo: Vinculo = {
        condominioId,
        role,
        blocoId: convite.bloco ?? null,
        unidadeId: convite.apartamento ?? null,
        status: "ATIVO",
      };

      tx.set(
        userRef,
        {
          email,
          displayName: convite.nome ?? userData.displayName ?? "",
          updatedAt: FieldValue.serverTimestamp(),
            activeCondominioId: condominioId,
            activeRole: role,
            activeBlocoId: convite.bloco ?? null,
            activeUnidadeId: convite.apartamento ?? null,
          vinculos: [...filtrados, novo],
        },
        { merge: true }
      );

      // Marca membro como ATIVO (e garante dados mínimos)
      tx.set(
        membroRef,
        {
          nome: convite.nome ?? "",
          email: convite.email ?? email,
          role,
          bloco: convite.bloco ?? null,
          apartamento: convite.apartamento ?? null,
          status: "ATIVO",
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Atualiza convite: concluído/aceito
      tx.set(
        conviteRef,
        {
          status: "CONCLUIDO",
          processedAt: FieldValue.serverTimestamp(),
          uidGerado: convite.uidGerado ?? uid,
          acceptedByUid: uid,
          acceptedByEmail: email,
        },
        { merge: true }
      );
    });

    return NextResponse.json({ ok: true, condominioId, role });
  } catch (err: any) {
    console.error("[API accept convite] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
