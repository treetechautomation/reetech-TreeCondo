import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { isOfferExpired } from "@/lib/reservasOfertaPrazo";
import { promoverFilaAposCancelamento } from "@/lib/reservasPromocaoFila";
import { notifyReservasUid } from "@/lib/reservasNotificacoes";

// Placeholder para notificações (R5+).
// async function notifyOfferExpired(params: {
//   condominioId: string; uid: string; areaId: string; dateStr: string; reservaOrigemId: string;
// }) {
//   // Notificações ainda não implementadas.
// }

export interface ExpiracaoResultado {
  expiradas: number;
  promovidas: string[];
}

export async function expirarOfertas(
  condominioId: string,
  now: Date,
): Promise<ExpiracaoResultado> {
  const db = adminDb();
  const nowTimestamp = Timestamp.fromDate(now);

  const slotsRef = db
    .collection("condominios")
    .doc(condominioId)
    .collection("reservasSlots");

  const q = slotsRef.where("pendingOfferExpiresAt", "<", nowTimestamp);
  const snap = await q.get();

  const expiredSlots = snap.docs.filter((doc) => {
    const data = doc.data() || {};
    const pendingOfferUid = String(data.pendingOfferUid || "").trim();
    return pendingOfferUid !== "";
  });

  const promovidas: string[] = [];
  let expiradas = 0;

  for (const doc of expiredSlots) {
    const slotId = doc.id;
    const slotRef = doc.ref;

    const parts = slotId.split("__");
    const dateStr = parts.slice(1).join("__");

    const result = await expirarOfertaUnica(
      db,
      condominioId,
      slotRef,
      slotId,
      dateStr,
      now,
      nowTimestamp,
    );

    if (result.expirada) {
      expiradas++;

      if (result.promovidoUid) {
        promovidas.push(result.promovidoUid);
      }
    }
  }

  return { expiradas, promovidas };
}

interface ExpiracaoInterna {
  expirada: boolean;
  promovidoUid: string | null;
}

async function expirarOfertaUnica(
  db: any,
  condominioId: string,
  slotRef: any,
  slotId: string,
  dateStr: string,
  now: Date,
  nowTimestamp: any,
): Promise<ExpiracaoInterna> {
  const parts = slotId.split("__");
  const resourceId = parts[0];

  try {
    const txResult = await db.runTransaction(async (tx: any) => {
      // 1. Reler slot
      const ss = await tx.get(slotRef);
      if (!ss.exists) return null;

      const slotData = ss.data() || {};
      const pendingOfferUid = String(slotData.pendingOfferUid || "").trim();

      // 2. Confirmar pendingOfferUid continua igual
      if (!pendingOfferUid) return null;

      // 3. Confirmar pendingOfferExpiresAt continua vencido
      const expiresAt = slotData.pendingOfferExpiresAt;
      if (!expiresAt) return null;
      if (!isOfferExpired(expiresAt)) return null;

      // 4. Ler fila
      const filaRef = slotRef.collection("fila").doc(pendingOfferUid);
      const fe = await tx.get(filaRef);
      if (!fe.exists) return null;

      const feData = fe.data() || {};
      const feStatus = String(feData.status || "");

      // 5. Confirmar status == OFERTA_PENDENTE
      if (feStatus !== "OFERTA_PENDENTE") return null;

      const areaId = String(slotData.areaId || resourceId);
      const reservaOrigemId = String(
        slotData.pendingOfferReservaOrigemId || "",
      );

      // 6. Atualizar fila → EXPIRADA
      tx.set(
        filaRef,
        {
          status: "EXPIRADA",
          expiradaEm: FieldValue.serverTimestamp(),
          expiradaPor: "SCHEDULER",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      // 7. Limpar slot
      tx.set(
        slotRef,
        {
          pendingOfferUid: FieldValue.delete(),
          pendingOfferAt: FieldValue.delete(),
          pendingOfferExpiresAt: FieldValue.delete(),
          pendingOfferReservaOrigemId: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return { areaId, resourceId, dateStr, reservaOrigemId, pendingOfferUid };
    });

    if (!txResult) {
      return { expirada: false, promovidoUid: null };
    }

    // Auditoria
    console.log(
      `[reservasOfertaExpirada] OFERTA EXPIRADA | slot=${slotId} | area=${txResult.areaId} | date=${dateStr} | uidExpirado=${txResult.pendingOfferUid} | reservaOrigem=${txResult.reservaOrigemId}`,
    );

    // Notificações — expiração
    notifyReservasUid(db, {
      condominioId,
      targetUid: txResult.pendingOfferUid,
      tipo: "OFERTA_EXPIRADA",
      title: "Prazo encerrado",
      message: "O prazo para aceitar a reserva terminou.",
      areaId: txResult.areaId,
      dateStr,
    }).catch(() => {});

    // APÓS COMMIT: promover próximo da fila
    let promovidoUid: string | null = null;
    try {
      promovidoUid = await promoverFilaAposCancelamento(db, {
        condominioId,
        areaId: txResult.areaId,
        dateStr: txResult.dateStr,
        resourceId: txResult.resourceId,
        reservaId: txResult.reservaOrigemId,
        isComposite: false,
      });
    } catch (e: any) {
      console.error(
        `[reservasOfertaExpirada] Falha ao promover fila: slot=${slotId}`,
        e?.message || e,
      );
    }

    return { expirada: true, promovidoUid };
  } catch (e: any) {
    console.error(
      `[reservasOfertaExpirada] Falha na transação: slot=${slotId}`,
      e?.message || e,
    );
    return { expirada: false, promovidoUid: null };
  }
}
