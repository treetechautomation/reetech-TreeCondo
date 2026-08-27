/**
 * G1.6.6 — Vínculo Empresa ↔ Cliente (Fundação) — Painel Global Treetech.
 *
 * PATCH /api/global/clientes/[id]/empresa
 *
 * Responsável EXCLUSIVAMENTE por:
 *   - vincular o cliente a uma empresa (`empresaId: string`);
 *   - remover o vínculo (`empresaId: null`).
 *
 * Relacionamento unidirecional e aditivo: Cliente → Empresa. A Empresa NÃO
 * mantém lista de clientes (sem campo `clienteIds`/`clientes[]` em
 * globalEmpresas) — decisão de modelagem G1.6.6, Etapa 2. O PATCH genérico de
 * cliente (/api/global/clientes/[id]) continua não aceitando `empresaId`;
 * esta é a única via de escrita desse campo.
 *
 * Validações (nesta ordem, dentro de uma única Transaction):
 *   1. Cliente existe (404 CLIENT_NOT_FOUND caso contrário).
 *   2. `version` do payload bate com a version atual do cliente (409 em
 *      conflito de concorrência).
 *   3. Se vinculando (empresaId != null): empresa existe (404
 *      COMPANY_NOT_FOUND) e AMBOS cliente e empresa estão com status ATIVO
 *      (409 em caso contrário).
 *
 * Decisão de modelagem (não coberta explicitamente pelo enunciado — decisão
 * documentada para homologação): a checagem "ambos ativos" se aplica somente
 * ao VÍNCULO. Desvincular (empresaId: null) é ação corretiva/administrativa
 * e não é bloqueada por status — permite remover uma referência mesmo que o
 * cliente ou a empresa tenham sido suspensos/cancelados após o vínculo.
 *
 * Auditoria: GLOBAL_CLIENT_COMPANY_LINKED / GLOBAL_CLIENT_COMPANY_UNLINKED,
 * via writeGlobalAuditLog() reutilizado (sem duplicar lógica), gravado na
 * mesma Transaction da mutação do cliente.
 *
 * Não implementado nesta fase (fora de escopo): UI, DELETE, relacionamento
 * inverso Empresa → Clientes, Cliente → Produtos/Condomínios.
 */
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";
import { writeGlobalAuditLog } from "@/lib/globalAuditLog";
import type { GlobalCliente } from "@/types/global-clientes";
import type { GlobalEmpresa } from "@/types/global-empresas";

type LinkEmpresaInput = {
  empresaId: string | null;
  version: number;
};

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await apiGuard({
      request: req,
      requireSuperAdmin: true,
      rateLimit: { limit: 20, windowSec: 60 },
    });

    const clienteId = params.id;
    const body = (await req.json().catch(() => null)) as LinkEmpresaInput | null;
    if (!body || typeof body !== "object") return jsonError("Payload inválido.", 400);

    if (body.empresaId !== null && typeof body.empresaId !== "string") {
      return jsonError("empresaId deve ser uma string (vincular) ou null (desvincular).", 400);
    }
    const empresaId = typeof body.empresaId === "string" ? body.empresaId.trim() : null;
    if (empresaId === "") {
      return jsonError("empresaId não pode ser uma string vazia — use null para desvincular.", 400);
    }

    const version = Number(body.version);
    if (!Number.isFinite(version) || version < 1) {
      return jsonError("A 'version' atual do cliente é obrigatória para o controle de concorrência.", 400);
    }

    const db = adminDb();
    const clienteRef = db.collection("globalClientes").doc(clienteId);
    const empresaRef = empresaId ? db.collection("globalEmpresas").doc(empresaId) : null;

    await db.runTransaction(async (t) => {
      const clienteSnap = await t.get(clienteRef);
      if (!clienteSnap.exists) throw new Error("CLIENT_NOT_FOUND");

      const clienteData = clienteSnap.data() as Partial<GlobalCliente>;
      const currentVersion = clienteData.version ?? 1;
      if (currentVersion !== version) throw new Error("CONCURRENCY_ERROR");

      if (empresaRef) {
        const empresaSnap = await t.get(empresaRef);
        if (!empresaSnap.exists) throw new Error("COMPANY_NOT_FOUND");
        const empresaData = empresaSnap.data() as Partial<GlobalEmpresa>;

        // "Ambos ativos" — somente para o vínculo (ver comentário de topo).
        if (clienteData.status !== "ATIVO") throw new Error("CLIENT_NOT_ACTIVE");
        if (empresaData.status !== "ATIVO") throw new Error("COMPANY_NOT_ACTIVE");
      }

      const beforeEmpresaId = clienteData.empresaId ?? null;

      t.update(clienteRef, {
        empresaId,
        version: currentVersion + 1,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: ctx.uid,
      });

      await writeGlobalAuditLog(
        {
          actorUid: ctx.uid,
          actorEmail: ctx.email || undefined,
          action: empresaId ? "GLOBAL_CLIENT_COMPANY_LINKED" : "GLOBAL_CLIENT_COMPANY_UNLINKED",
          entity: "GLOBAL_CLIENT",
          entityId: clienteId,
          before: { empresaId: beforeEmpresaId },
          after: { empresaId },
          source: "API",
        },
        { transaction: t }
      );
    });

    const updatedSnap = await clienteRef.get();
    const data = updatedSnap.data() as Partial<GlobalCliente>;
    return NextResponse.json({
      ok: true,
      data: {
        id: updatedSnap.id,
        empresaId: data.empresaId ?? null,
        version: data.version ?? 1,
        updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
        updatedByUid: data.updatedByUid ?? null,
      },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    if (e?.message === "CLIENT_NOT_FOUND") return jsonError("Cliente não encontrado.", 404);
    if (e?.message === "COMPANY_NOT_FOUND") return jsonError("Empresa não encontrada.", 404);
    if (e?.message === "CONCURRENCY_ERROR") return jsonError("O cliente foi modificado por outro usuário. Recarregue os dados e tente novamente.", 409);
    if (e?.message === "CLIENT_NOT_ACTIVE") return jsonError("Cliente não está com status ATIVO — o vínculo exige que cliente e empresa estejam ativos.", 409);
    if (e?.message === "COMPANY_NOT_ACTIVE") return jsonError("Empresa não está com status ATIVO — o vínculo exige que cliente e empresa estejam ativos.", 409);
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
