import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { FinanceiroStatus } from "@/lib/financeiroStatus";
import { checkReservaBlockTx } from "@/lib/reservas/bloqueios-helper";

export interface AceitarOfertaTxParams {
  db: ReturnType<typeof getFirestore>;
  condominioId: string;
  areaId: string;
  dateStr: string;
  uid: string;
  area: Record<string, any>;
  membro: Record<string, any>;
  fila: Record<string, any>;
  slotRef: any;
  filaDocRef: any;
  lockRef: any;
  reservasCol: any;
  modo: "ACEITA" | "OFERTADA";
}

export interface AceitarOfertaTxResult {
  reservaId: string;
  gerouFinanceiro: boolean;
}

export async function executeAceitarOfertaTx(
  tx: any,
  params: AceitarOfertaTxParams,
): Promise<AceitarOfertaTxResult> {
  const {
    db, condominioId, areaId, dateStr, uid,
    area, membro, fila,
    slotRef, filaDocRef, lockRef, reservasCol,
    modo,
  } = params;

  const reservaRef = reservasCol.doc();
  const reservaNovaId = reservaRef.id;
  const dt = new Date(`${dateStr}T12:00:00.000Z`);

  const valorCobrado = Number(fila.valorCobrado || 0) || 0;
  const opcaoId = String(fila.opcaoId || "base");
  const opcaoNome = String(fila.opcaoNome || "Base");
  const capacidadeMax =
    fila.capacidadeMax == null ? null : Number(fila.capacidadeMax);

  // R4.1: revalidar bloqueios administrativos com membership ATUAL (tx.get)
  {
    const blNorm = String(membro.blocoIdNorm || "").toLowerCase().trim();
    const unNorm = String(membro.unidadeIdNorm || "").toLowerCase().trim();
    if (blNorm && unNorm) {
      const blockCheck = await checkReservaBlockTx(tx, db, {
        condominioId, uid,
        unidadeIdNorm: unNorm, blocoIdNorm: blNorm,
        areaId, escopoOperacao: "RESERVA_PRIVATIVA",
      });
      if (blockCheck.blocked) {
        throw Object.assign(
          new Error(blockCheck.motivoPublico ?? "Esta unidade está temporariamente impedida de realizar reservas."),
          { status: 403 }
        );
      }
    }
  }

  tx.set(reservaRef, {
    areaId,
    condominioId,
    uid,
    criadoPorUid: uid,
    reservaManualPorOperador: false,
    status: "PENDENTE",
    precisaAprovacao: true,
    data: Timestamp.fromDate(dt),
    dateStr,
    valorCobrado,
    opcaoId,
    opcaoNome,
    capacidadeMax,
    criadoEm: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    origemFila: true,
    assumidaDeOferta: true,
    ofertadaEm: fila.ofertadaEm || null,
    ofertaReservaOrigemId: fila.ofertaReservaOrigemId || null,
  });

  let gerouFinanceiro = false;

  if (valorCobrado > 0) {
    const cobrancaRef = db
      .collection("condominios")
      .doc(condominioId)
      .collection("financeiro")
      .doc();

    const blocoId = String(membro.blocoId || membro.bloco || "");
    const blocoNome = String(membro.blocoNome || area.nomeBloco || blocoId);
    const unidadeIdRaw = String(membro.unidadeId || membro.apto || "");
    const numeroReserva =
      dateStr.replace(/-/g, "") +
      "-" +
      reservaRef.id.substring(0, 6).toUpperCase();
    const competenciaVal = dateStr.substring(0, 7);
    const unidadeNomeVal =
      [blocoNome, unidadeIdRaw].filter(Boolean).join(" - ") || unidadeIdRaw;

    tx.set(cobrancaRef, {
      tipo: "TAXA_RESERVA",
      reservaId: reservaRef.id,
      numeroReserva,
      moradorUid: uid,
      moradorNome: String(membro.nome || ""),
      blocoId,
      blocoIdNorm:
        membro.blocoIdNorm ||
        String(blocoId).toLowerCase().trim() ||
        "",
      blocoNome,
      unidadeId: unidadeIdRaw,
      unidadeIdNorm:
        membro.unidadeIdNorm ||
        String(unidadeIdRaw).toLowerCase().trim() ||
        "",
      unidadeNome: unidadeNomeVal,
      areaId,
      areaNome: String(area.nome || areaId),
      opcaoId,
      opcaoNome,
      valorCentavos: valorCobrado,
      competencia: competenciaVal,
      competenciaOriginal: competenciaVal,
      status: FinanceiroStatus.AGUARDANDO_ENVIO,
      descricao: `Taxa de Reserva — ${opcaoNome || "Área Comum"} (${dateStr})`,
      dataSolicitacao: FieldValue.serverTimestamp(),
      dataEvento: Timestamp.fromDate(dt),
      dataCriacaoLancamento: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      observacoes: "",
    });

    gerouFinanceiro = true;
  }

  // ── R2: com_campo — validar exclusividade e criar HOLD ──
  if (opcaoId === "com_campo") {
    // Re-resolver a opção atual da área
    const ops = Array.isArray(area.opcoes) ? area.opcoes : [];
    const opcaoAtual = ops.find((o: any) => String(o.id) === "com_campo");
    if (!opcaoAtual) {
      throw Object.assign(new Error("A opção com exclusividade do Campo não está mais disponível."), { status: 400 });
    }

    // Verificar campoAgenda — coordenador cross-domain
    const agendaRef = db.collection("condominios").doc(condominioId).collection("campoAgenda").doc(dateStr);
    const agendaSnap = await tx.get(agendaRef);
    const agenda = agendaSnap.exists ? (agendaSnap.data() || {}) : { dateStr, version: 0 };
    const existingExc = (agenda as any).exclusividade ?? null;

    if (existingExc) {
      const now = new Date();
      const isHolding = existingExc.status === "HOLD" && existingExc.expiresAt && existingExc.expiresAt.toDate() > now;
      if (isHolding || existingExc.status === "ATIVA") {
        throw Object.assign(new Error("Já existe exclusividade para esta data."), { status: 409 });
      }
    }

    // Verificar usoCampo conflitante
    const usosSnap = await tx.get(
      db.collection("condominios").doc(condominioId).collection("usoCampo")
        .where("dateStr", "==", dateStr).where("status", "==", "ATIVO")
    );

    const excInicioMin = 18 * 60;  // policy provides this — hardcoded fallback
    const excFimMin = 22 * 60;
    for (const usoDoc of usosSnap.docs) {
      const u = usoDoc.data();
      if (u.inicioMin < excFimMin && u.fimMin > excInicioMin) {
        throw Object.assign(
          new Error("Não foi possível confirmar a exclusividade. Existem usos do Campo no período de 18h às 22h."),
          { status: 409 }
        );
      }
    }

    // Calcular expiresAt do HOLD
    const holdMs = 24 * 3600_000;
    const evento18h = new Date(`${dateStr}T18:00:00-03:00`);
    const expiresAt = new Date(Math.min(Date.now() + holdMs, evento18h.getTime()));

    // Criar HOLD no campoAgenda
    tx.set(agendaRef, {
      dateStr,
      version: ((agenda as any).version ?? 0) + 1,
      exclusividade: {
        tipo: "EXCLUSIVIDADE_CHURRASQUEIRA_2",
        reservaId: reservaRef.id,
        unidadeIdNorm: String(membro.unidadeIdNorm || ""),
        blocoIdNorm: String(membro.blocoIdNorm || ""),
        unidadeNumero: String(membro.unidade || membro.unidadeId || membro.apto || ""),
        blocoNome: String(membro.blocoNome || membro.bloco || ""),
        inicioMin: excInicioMin,
        fimMin: excFimMin,
        status: "HOLD",
        expiresAt: Timestamp.fromDate(expiresAt),
        criadoEm: FieldValue.serverTimestamp(),
        liberadoEm: null,
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  tx.set(
    slotRef,
    {
      occupied: true,
      reservaId: reservaRef.id,
      pendingOfferUid: null,
      pendingOfferAt: null,
      pendingOfferExpiresAt: null,
      pendingOfferReservaOrigemId: null,
      filaCount: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  if (modo === "ACEITA") {
    tx.set(
      filaDocRef,
      {
        status: "ACEITA",
        aceitaEm: FieldValue.serverTimestamp(),
        aceitaPorUid: uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } else {
    tx.delete(filaDocRef);
  }

  tx.set(
    lockRef,
    {
      uid,
      tipo: "RESERVA",
      areaId,
      dateStr,
      reservaId: reservaRef.id,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { reservaId: reservaNovaId, gerouFinanceiro };
}
