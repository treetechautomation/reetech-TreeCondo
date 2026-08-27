/**
 * G1.4 — Primeira API Global do Painel Treetech.
 *
 * GET /api/global/dashboard → indicadores agregados, somente leitura.
 *
 * Protegida por requireSuperAdmin (apiGuard) — não recebe condominioId,
 * não usa membership/tenant. Escala atual (poucas dezenas de condomínios)
 * permite agregar por condomínio usando os índices COLLECTION já existentes
 * (status+timestamp em anuncios/incidentes/encomendas) sem precisar de
 * índices novos em escopo COLLECTION_GROUP.
 */
import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

const ENCOMENDA_STATUS_PENDENTE = ["CHEGOU", "AGUARDANDO_RETIRADA"] as const;

export async function GET(req: Request) {
  try {
    await apiGuard({ request: req, requireSuperAdmin: true });

    const db = adminDb();

    // Apenas os IDs (leitura leve) — precisamos deles para agregar por condomínio.
    const condominiosSnap = await db.collection("condominios").select().get();
    const condominioIds = condominiosSnap.docs.map((d) => d.id);

    const [usersCountSnap, membrosCountSnap, perCondominio] = await Promise.all([
      db.collection("users").count().get(),
      db.collectionGroup("membros").count().get(),
      Promise.all(
        condominioIds.map(async (condominioId) => {
          const base = db.collection("condominios").doc(condominioId);
          const [anunciosSnap, incidentesSnap, encomendasSnap] = await Promise.all([
            base.collection("anuncios").where("status", "==", "PUBLICADO").count().get(),
            base.collection("incidentes").where("status", "==", "ABERTO").count().get(),
            base.collection("encomendas").where("status", "in", [...ENCOMENDA_STATUS_PENDENTE]).count().get(),
          ]);
          return {
            anuncios: anunciosSnap.data().count,
            incidentes: incidentesSnap.data().count,
            encomendas: encomendasSnap.data().count,
          };
        })
      ),
    ]);

    const totals = perCondominio.reduce(
      (acc, c) => ({
        anuncios: acc.anuncios + c.anuncios,
        incidentes: acc.incidentes + c.incidentes,
        encomendas: acc.encomendas + c.encomendas,
      }),
      { anuncios: 0, incidentes: 0, encomendas: 0 }
    );

    return NextResponse.json({
      ok: true,
      data: {
        totalCondominios: condominioIds.length,
        totalUsuarios: usersCountSnap.data().count,
        totalMembros: membrosCountSnap.data().count,
        totalAnunciosAtivos: totals.anuncios,
        totalIncidentesAbertos: totals.incidentes,
        totalEncomendasPendentes: totals.encomendas,
      },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonError(e?.message || "Erro inesperado", 500);
  }
}
