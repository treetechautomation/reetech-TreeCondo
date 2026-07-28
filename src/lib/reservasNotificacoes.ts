import { FieldValue } from "firebase-admin/firestore";

export interface NotifyReservasParams {
  condominioId: string;
  targetUid: string;
  tipo: string;
  title: string;
  message: string;
  reservaId?: string | null;
  areaId?: string | null;
  dateStr?: string | null;
  offerExpiresAt?: string | null;
}

export async function notifyReservasUid(
  db: any,
  params: NotifyReservasParams,
): Promise<void> {
  const { condominioId, targetUid } = params;
  if (!condominioId || !targetUid) return;

  try {
    const ref = db
      .collection("condominios")
      .doc(condominioId)
      .collection("notificacoes")
      .doc();

    await ref.set(
      {
        tipo: params.tipo,
        title: params.title,
        message: params.message,
        titulo: params.title,
        mensagem: params.message,
        targetUid,
        condominioId,
        reservaId: params.reservaId || null,
        areaId: params.areaId || null,
        dateStr: params.dateStr || null,
        offerExpiresAt: params.offerExpiresAt || null,
        lida: false,
        arquivada: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e: any) {
    console.error(
      "[reservasNotificacoes] notifyReservasUid falhou:",
      e?.message || e,
    );
  }
}

function upper(v: any): string {
  return String(v || "").toUpperCase().trim();
}

function isOperatorRole(role: any): boolean {
  return ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(
    upper(role),
  );
}

export async function notifyReservasOperadores(
  db: any,
  params: {
    condominioId: string;
    tipo: string;
    title: string;
    message: string;
    reservaId?: string | null;
    areaId?: string | null;
    dateStr?: string | null;
  },
): Promise<void> {
  const condId = params.condominioId;
  if (!condId) return;

  try {
    const membrosRef = db
      .collection("condominios")
      .doc(condId)
      .collection("membros");

    const snap = await membrosRef
      .where("status", "in", ["ATIVO", "PENDENTE"])
      .get();

    const ops = snap.docs
      .map((d: any) => ({ id: d.id, ...(d.data() || {}) }))
      .filter((m: any) => isOperatorRole(m.role));

    if (!ops.length) return;

    const batch = db.batch();
    for (const m of ops) {
      const ref = db
        .collection("condominios")
        .doc(condId)
        .collection("notificacoes")
        .doc();
      batch.set(
        ref,
        {
          tipo: params.tipo,
          title: params.title,
          message: params.message,
          titulo: params.title,
          mensagem: params.message,
          targetUid: m.id,
          condominioId: condId,
          reservaId: params.reservaId || null,
          areaId: params.areaId || null,
          dateStr: params.dateStr || null,
          lida: false,
          arquivada: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    await batch.commit();
  } catch (e: any) {
    console.error(
      "[reservasNotificacoes] notifyReservasOperadores falhou:",
      e?.message || e,
    );
  }
}
