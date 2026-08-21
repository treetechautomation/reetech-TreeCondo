import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

type Vinculo = {
  condominioId: string;
  role: "MORADOR" | "PORTEIRO" | "SINDICO" | "ADMIN" | "ADMIN_CONDOMINIO";
  blocoId?: string | null;
  unidadeId?: string | null;
  status: "ATIVO" | "INATIVO";
};

export async function POST(req: Request) {
  try {
    const { conviteId } = (await req.json().catch(() => ({}))) as { conviteId?: string };
    if (!conviteId) return jsonError("conviteId é obrigatório", 400);

    const ctx = await apiGuard({ request: req, requireAuth: true });

    const email = ctx.email;
    if (!email) return jsonError("Usuário autenticado sem email", 401);

    const db = adminDb();

    const conviteRef = db.collection("convites").doc(conviteId);
    const conviteSnap = await conviteRef.get();
    if (!conviteSnap.exists) return jsonError("Convite não encontrado", 404);

    const convite = conviteSnap.data() as any;

    if ((convite.email || "").toLowerCase() !== email) {
      return jsonError("Email do convite não corresponde ao usuário logado", 403);
    }

    if (!convite.condominioId || !convite.tipo) {
      return jsonError("Convite inválido", 400);
    }

    const statusAtual = (convite.status || "PENDENTE").toUpperCase();
    if (statusAtual === "CONCLUIDO" || statusAtual === "ACEITO") {
      return NextResponse.json({ ok: true, alreadyAccepted: true, condominioId: convite.condominioId });
    }

    const condominioId = convite.condominioId;
    const role = convite.tipo;

    const userRef = db.collection("users").doc(ctx.uid);
    const membroRef = db.collection("condominios").doc(condominioId).collection("membros").doc(ctx.uid);

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

      tx.set(userRef, {
        email,
        displayName: convite.nome ?? userData.displayName ?? "",
        updatedAt: FieldValue.serverTimestamp(),
        activeCondominioId: condominioId,
        activeRole: role,
        activeBlocoId: convite.bloco ?? null,
        activeUnidadeId: convite.apartamento ?? null,
        vinculos: [...filtrados, novo],
      }, { merge: true });

      tx.set(membroRef, {
        nome: convite.nome ?? "",
        email: convite.email ?? email,
        role,
        bloco: convite.bloco ?? null,
        apartamento: convite.apartamento ?? null,
        status: "ATIVO",
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      tx.set(conviteRef, {
        status: "CONCLUIDO",
        processedAt: FieldValue.serverTimestamp(),
        uidGerado: convite.uidGerado ?? ctx.uid,
        acceptedByUid: ctx.uid,
        acceptedByEmail: email,
      }, { merge: true });
    });

    return NextResponse.json({ ok: true, condominioId, role });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error("[API accept convite] erro:", err);
    return jsonError(err?.message || "Erro inesperado", 500);
  }
}
