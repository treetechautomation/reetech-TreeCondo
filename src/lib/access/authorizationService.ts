/**
 * ACCESS.4 — SERVIÇO DE AUTORIZAÇÃO DO MORADOR.
 *
 * Lógica de orquestração pura de Firestore (Admin SDK) — testável
 * diretamente contra o emulador, sem precisar subir o Next.js. As
 * rotas em `src/app/api/acesso-controle/**` são wrappers HTTP finos que
 * chamam estas funções depois do `apiGuard`.
 *
 * Princípio central (ACCESS.4 §2): MORADOR AUTORIZA, PORTEIRO/SEGURANCA
 * NUNCA. `createAuthorization` recusa esses dois papéis antes de
 * qualquer outra validação.
 */

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { AccessApiError } from "./apiErrors";
import { validateVisitorSnapshot } from "./validation";
import { ACCESS_TYPES, type AccessType, type AccessAuthorization } from "./types";
import { getCondominioTimezone, computeVisitDateWindow } from "./timezone";
import { resolveAccessPolicy } from "./policy";
import { resolveEligibleUnits, selectUnit } from "./unitResolution";
import { generateQrCredential } from "./credential";
import { issueNonCollidingPin } from "./pinIssuance";
import { loadPinHmacKey, PinHmacKeyMissingError } from "./hmacKey";
import { deriveAuthorizationStatus } from "./derived";

type GuardRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "ADMIN_CONDOMINIO"
  | "SINDICO"
  | "PORTEIRO"
  | "SEGURANCA"
  | "ZELADOR"
  | "MORADOR";

export interface AuthorizationActorContext {
  uid: string;
  role: GuardRole | null;
  isSuperAdmin: boolean;
  condominioId: string;
  membroData: Record<string, any> | null;
}

const OPERATOR_ROLES: GuardRole[] = ["ADMIN", "ADMIN_CONDOMINIO", "SINDICO"];

function isOperatorActor(ctx: AuthorizationActorContext): boolean {
  return ctx.isSuperAdmin || (!!ctx.role && OPERATOR_ROLES.includes(ctx.role));
}

export interface CreateAuthorizationInput {
  accessType: unknown;
  nome: unknown;
  telefone?: unknown;
  placa?: unknown;
  observacao?: unknown;
  visitDate: unknown;
  expectedEntryAt?: unknown;
  expectedExitAt?: unknown;
  /** Só é considerado para MORADOR com >1 unidade elegível, ou para atores administrativos (obrigatório nesse caso). */
  unitId?: unknown;
  /** Obrigatório junto de `unitId` para atores administrativos (a unidade vive em `blocos/{blocoId}/unidades/{unitId}`). */
  blocoId?: unknown;
}

export interface CreateAuthorizationResult {
  authorization: Omit<AccessAuthorization, never>;
  credential: {
    qrToken?: string;
    pin?: string;
  };
}

function parseOptionalInstant(raw: unknown, fieldName: string): Date | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string") throw new AccessApiError("INVALID_INPUT", `${fieldName} inválido.`);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new AccessApiError("INVALID_INPUT", `${fieldName} inválido.`);
  return d;
}

export async function createAuthorization(
  db: FirebaseFirestore.Firestore,
  ctx: AuthorizationActorContext,
  input: CreateAuthorizationInput,
): Promise<CreateAuthorizationResult> {
  // ── Princípio central: PORTEIRO/SEGURANCA nunca autorizam (§2, §13) ──
  if (ctx.role === "PORTEIRO" || ctx.role === "SEGURANCA") {
    throw new AccessApiError("FORBIDDEN", "Portaria não pode criar autorizações de acesso.");
  }
  const isMoradorActor = ctx.role === "MORADOR";
  if (!isMoradorActor && !isOperatorActor(ctx)) {
    throw new AccessApiError("FORBIDDEN", "Seu perfil não pode criar autorizações de acesso.");
  }

  // ── Validação de input ──
  if (typeof input.accessType !== "string" || !ACCESS_TYPES.includes(input.accessType as AccessType)) {
    throw new AccessApiError("INVALID_INPUT", "accessType inválido.");
  }
  const accessType = input.accessType as AccessType;

  const snapshotResult = validateVisitorSnapshot({
    nome: input.nome,
    telefone: input.telefone,
    placa: input.placa,
    observacao: input.observacao,
  });
  if (!snapshotResult.valid) throw new AccessApiError("INVALID_INPUT", snapshotResult.reason);

  if (typeof input.visitDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.visitDate)) {
    throw new AccessApiError("INVALID_INPUT", "visitDate inválida — use o formato YYYY-MM-DD.");
  }
  const expectedEntryAt = parseOptionalInstant(input.expectedEntryAt, "expectedEntryAt");
  const expectedExitAt = parseOptionalInstant(input.expectedExitAt, "expectedExitAt");

  // ── Unidade — nunca autoridade do cliente sem validação server-side (§11/§12) ──
  const requestedUnitId = typeof input.unitId === "string" && input.unitId.trim() ? input.unitId.trim() : null;
  let unitId: string;
  let blocoId: string | null;

  if (isMoradorActor) {
    const eligible = await resolveEligibleUnits(db, ctx.condominioId, ctx.uid, ctx.membroData);
    const selection = selectUnit(eligible, requestedUnitId);
    if (!selection.ok) {
      if (selection.reason === "NO_ACTIVE_UNIT") {
        throw new AccessApiError("NO_ACTIVE_UNIT", "Você não possui vínculo ativo com nenhuma unidade neste condomínio.");
      }
      if (selection.reason === "AMBIGUOUS_REQUIRES_UNIT_ID") {
        throw new AccessApiError("INVALID_UNIT", "Você possui mais de uma unidade — informe unitId.");
      }
      throw new AccessApiError("INVALID_UNIT", "unitId não pertence às suas unidades ativas.");
    }
    unitId = selection.unit.unitId;
    blocoId = selection.unit.blocoId;
  } else {
    // Ator administrativo: unidade é obrigatória e validada contra o condomínio-alvo (§13).
    const requestedBlocoId = typeof input.blocoId === "string" && input.blocoId.trim() ? input.blocoId.trim() : null;
    if (!requestedUnitId || !requestedBlocoId) {
      throw new AccessApiError("INVALID_INPUT", "unitId e blocoId são obrigatórios para autorização administrativa.");
    }
    const unidadeSnap = await db
      .collection("condominios").doc(ctx.condominioId)
      .collection("blocos").doc(requestedBlocoId)
      .collection("unidades").doc(requestedUnitId)
      .get();
    if (!unidadeSnap.exists) {
      throw new AccessApiError("INVALID_UNIT", "Unidade não encontrada neste condomínio.");
    }
    unitId = requestedUnitId;
    blocoId = requestedBlocoId;
  }

  // ── Timezone + janela de validade (server-controlled, §14) ──
  const condoSnap = await db.collection("condominios").doc(ctx.condominioId).get();
  const timezone = getCondominioTimezone(condoSnap.data() as any);
  const window = computeVisitDateWindow({ visitDate: input.visitDate, timezone, expectedEntryAt });
  if (!window) throw new AccessApiError("INVALID_INPUT", "visitDate inválida.");

  // ── Policy — ao menos um método de credencial deve estar ativo (§15) ──
  const policyDoc = await db.collection("condominios").doc(ctx.condominioId).collection("config").doc("accessPolicy").get();
  const policy = resolveAccessPolicy(policyDoc.exists ? (policyDoc.data() as any) : null);
  if (!policy.qrEnabled && !policy.pinEnabled) {
    throw new AccessApiError("POLICY_DISABLED", "Nenhum método de credencial (QR/PIN) está habilitado para este condomínio.");
  }

  // ── Emissão de credencial (antes da transação — nunca persistir raw, §16/§17) ──
  let rawQrToken: string | undefined;
  let qrTokenHash: string | null = null;
  if (policy.qrEnabled) {
    const qr = generateQrCredential();
    rawQrToken = qr.token;
    qrTokenHash = qr.hash;
  }

  let rawPin: string | undefined;
  let pinLookupHash: string | null = null;
  if (policy.pinEnabled) {
    let hmacKey: string;
    try {
      hmacKey = loadPinHmacKey();
    } catch (e) {
      if (e instanceof PinHmacKeyMissingError) {
        throw new AccessApiError("CONFIGURATION_ERROR", "PIN está habilitado, mas a configuração de segurança do servidor está incompleta.");
      }
      throw e;
    }
    const issued = await issueNonCollidingPin(db, ctx.condominioId, hmacKey);
    rawPin = issued.rawPin;
    pinLookupHash = issued.pinLookupHash;
  }

  // ── IDs definidos antes da transação (§16) ──
  const authorizationRef = db.collection("condominios").doc(ctx.condominioId).collection("accessAuthorizations").doc();
  const credentialRef = db.collection("condominios").doc(ctx.condominioId).collection("accessCredentials").doc();
  const eventRef = db.collection("condominios").doc(ctx.condominioId).collection("accessEvents").doc();

  const now = new Date();

  await db.runTransaction(async (tx) => {
    tx.create(authorizationRef, {
      condominioId: ctx.condominioId,
      unitId,
      blocoId,
      createdByUid: ctx.uid,
      accessType,
      visitorSnapshot: snapshotResult.snapshot,
      visitDate: input.visitDate,
      expectedEntryAt: expectedEntryAt ? Timestamp.fromDate(expectedEntryAt) : null,
      expectedExitAt: expectedExitAt ? Timestamp.fromDate(expectedExitAt) : null,
      newEntryValidFrom: Timestamp.fromDate(window.newEntryValidFrom),
      newEntryValidUntil: Timestamp.fromDate(window.newEntryValidUntil),
      usagePolicy: "SINGLE_USE",
      status: "AUTORIZADO",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      revokedAt: null,
      revokedByUid: null,
      revocationReason: null,
    });

    tx.create(credentialRef, {
      condominioId: ctx.condominioId,
      authorizationId: authorizationRef.id,
      qrTokenHash,
      pinLookupHash,
      pinAttempts: 0,
      pinLockedUntil: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.create(eventRef, {
      condominioId: ctx.condominioId,
      unitId,
      authorizationId: authorizationRef.id,
      stayId: null,
      type: "AUTHORIZATION_CREATED",
      actorUid: ctx.uid,
      actorRole: ctx.isSuperAdmin ? "SUPER_ADMIN" : (ctx.role || "MORADOR"),
      timestamp: FieldValue.serverTimestamp(),
      metadata: { accessType },
    });
  });

  return {
    authorization: {
      id: authorizationRef.id,
      condominioId: ctx.condominioId,
      unitId,
      blocoId,
      createdByUid: ctx.uid,
      accessType,
      visitorSnapshot: snapshotResult.snapshot,
      visitDate: input.visitDate,
      expectedEntryAt,
      expectedExitAt,
      newEntryValidFrom: window.newEntryValidFrom,
      newEntryValidUntil: window.newEntryValidUntil,
      usagePolicy: "SINGLE_USE",
      status: "AUTORIZADO",
      createdAt: now,
      updatedAt: now,
      revokedAt: null,
      revokedByUid: null,
      revocationReason: null,
    },
    credential: {
      ...(rawQrToken ? { qrToken: rawQrToken } : {}),
      ...(rawPin ? { pin: rawPin } : {}),
    },
  };
}

// ─────────────────────────── List / Detail ───────────────────────────

function toAuthorizationDto(id: string, data: FirebaseFirestore.DocumentData) {
  const newEntryValidUntil: Timestamp = data.newEntryValidUntil;
  return {
    id,
    unitId: data.unitId,
    blocoId: data.blocoId ?? null,
    accessType: data.accessType,
    visitorSnapshot: data.visitorSnapshot,
    visitDate: data.visitDate,
    expectedEntryAt: data.expectedEntryAt ? data.expectedEntryAt.toDate().toISOString() : null,
    expectedExitAt: data.expectedExitAt ? data.expectedExitAt.toDate().toISOString() : null,
    newEntryValidFrom: data.newEntryValidFrom.toDate().toISOString(),
    newEntryValidUntil: data.newEntryValidUntil.toDate().toISOString(),
    usagePolicy: data.usagePolicy,
    effectiveStatus: deriveAuthorizationStatus(
      { status: data.status, newEntryValidUntil: newEntryValidUntil.toDate() },
      new Date(),
    ),
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
    revokedAt: data.revokedAt ? data.revokedAt.toDate().toISOString() : null,
    revocationReason: data.revocationReason ?? null,
  };
}

export interface ListOwnAuthorizationsInput {
  scope?: "active" | "upcoming" | "history";
  limit?: number;
}

export async function listOwnAuthorizations(
  db: FirebaseFirestore.Firestore,
  ctx: AuthorizationActorContext,
  input: ListOwnAuthorizationsInput,
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  let query: FirebaseFirestore.Query = db
    .collection("condominios").doc(ctx.condominioId)
    .collection("accessAuthorizations")
    .where("createdByUid", "==", ctx.uid);

  if (input.scope === "upcoming") {
    const today = new Date().toISOString().slice(0, 10);
    query = query.where("visitDate", ">=", today).orderBy("visitDate", "asc");
  } else {
    query = query.orderBy("createdAt", "desc");
  }

  const snap = await query.limit(limit).get();
  let items = snap.docs.map((d) => toAuthorizationDto(d.id, d.data()));

  if (input.scope === "active") items = items.filter((a) => a.effectiveStatus === "AUTORIZADO");
  if (input.scope === "history") items = items.filter((a) => a.effectiveStatus !== "AUTORIZADO");

  return { items };
}

export async function getAuthorizationDetail(
  db: FirebaseFirestore.Firestore,
  ctx: AuthorizationActorContext,
  authorizationId: string,
) {
  const ref = db.collection("condominios").doc(ctx.condominioId).collection("accessAuthorizations").doc(authorizationId);
  const snap = await ref.get();
  if (!snap.exists) throw new AccessApiError("NOT_FOUND", "Autorização não encontrada.");

  const data = snap.data()!;
  const isOwner = data.createdByUid === ctx.uid;
  if (!isOwner && !isOperatorActor(ctx)) {
    throw new AccessApiError("NOT_FOUND", "Autorização não encontrada.");
  }

  return toAuthorizationDto(snap.id, data);
}

// ─────────────────────────── Revoke ───────────────────────────

export async function revokeAuthorization(
  db: FirebaseFirestore.Firestore,
  ctx: AuthorizationActorContext,
  authorizationId: string,
  reason?: string | null,
) {
  if (ctx.role === "PORTEIRO" || ctx.role === "SEGURANCA") {
    throw new AccessApiError("FORBIDDEN", "Portaria não pode revogar autorizações de acesso.");
  }

  const ref = db.collection("condominios").doc(ctx.condominioId).collection("accessAuthorizations").doc(authorizationId);
  const eventRef = db.collection("condominios").doc(ctx.condominioId).collection("accessEvents").doc();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AccessApiError("NOT_FOUND", "Autorização não encontrada.");
    const data = snap.data()!;

    const isOwner = data.createdByUid === ctx.uid;
    if (!isOwner && !isOperatorActor(ctx)) {
      throw new AccessApiError("NOT_FOUND", "Autorização não encontrada.");
    }

    // Idempotente (§27): segunda revogação é sucesso silencioso, sem duplicar evento.
    if (data.status === "REVOGADO") {
      return { alreadyRevoked: true };
    }

    tx.update(ref, {
      status: "REVOGADO",
      revokedAt: FieldValue.serverTimestamp(),
      revokedByUid: ctx.uid,
      revocationReason: reason ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.create(eventRef, {
      condominioId: ctx.condominioId,
      unitId: data.unitId,
      authorizationId,
      stayId: null,
      type: "AUTHORIZATION_REVOKED",
      actorUid: ctx.uid,
      actorRole: ctx.isSuperAdmin ? "SUPER_ADMIN" : (ctx.role || "MORADOR"),
      timestamp: FieldValue.serverTimestamp(),
      metadata: reason ? { reason } : {},
    });

    return { alreadyRevoked: false };
  });

  return result;
}
