import { NextResponse } from "next/server";
export const runtime = "nodejs";

import { adminDb } from "@/lib/firebaseAdmin";
import { jsonError } from "@/lib/jsonError";
import { apiGuard } from "@/lib/apiGuard";

function serializeTimestamp(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v?.toDate === "function") {
    try {
      const d: Date = v.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString();
    } catch { /* fall through */ }
  }
  if (typeof v?.toISOString === "function") {
    try {
      const s = v.toISOString();
      if (typeof s === "string") return s;
    } catch { /* fall through */ }
  }
  if (typeof v === "number") {
    try {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch { /* fall through */ }
  }
  return null;
}

function safeStr(v: any): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

export async function GET(req: Request) {
  const db = adminDb();

  try {
    const { searchParams } = new URL(req.url);
    const condominioId = searchParams.get("condominioId") || "";

    if (!condominioId) return jsonError("condominioId é obrigatório.", 400);

    const ctx = await apiGuard({
      request: req,
      condominioId,
      allowedRoles: ["PORTEIRO", "SUPER_ADMIN"],
    });

    // Validate condominio exists
    let condominioExists = false;
    try {
      const cSnap = await db.collection("condominios").doc(condominioId).get();
      condominioExists = cSnap.exists;
    } catch (e) { /* ignore */ }
    if (!condominioExists) return jsonError("Condomínio não encontrado.", 404);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today;

    const result: any = {
      ok: true,
      kpis: {},
      acessosRecentes: [],
      encomendasPendentes: [],
      reservasHoje: [],
      incidentesAbertos: [],
      comunicados: [],
    };

    // ─── KPI: Acessos Hoje ───
    try {
      const acessosHojeSnap = await db.collection("condominios").doc(condominioId)
        .collection("acessos")
        .where("createdAt", ">=", todayStart)
        .count()
        .get();
      result.kpis.acessosHoje = acessosHojeSnap.data().count;

      const aguardandoSnap = await db.collection("condominios").doc(condominioId)
        .collection("acessos")
        .where("status", "in", ["AUTORIZADO", "PENDENTE"])
        .count()
        .get();
      result.kpis.aguardandoEntrada = aguardandoSnap.data().count;
    } catch (e: any) {
      console.warn("[portaria/dashboard] acessos KPIs falhou:", e?.message);
      result.kpis.acessosHoje = 0;
      result.kpis.aguardandoEntrada = 0;
    }

    // ─── KPI: Encomendas Pendentes ───
    try {
      const encomendasPendSnap = await db.collection("condominios").doc(condominioId)
        .collection("encomendas")
        .where("status", "==", "AGUARDANDO")
        .count()
        .get();
      result.kpis.encomendasPendentes = encomendasPendSnap.data().count;
    } catch (e: any) {
      console.warn("[portaria/dashboard] encomendas KPI falhou:", e?.message);
      result.kpis.encomendasPendentes = 0;
    }

    // ─── KPI: Reservas Hoje ───
    try {
      const tomorrow = new Date(todayStart);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const reservasHojeSnap = await db.collection("condominios").doc(condominioId)
        .collection("reservas")
        .where("status", "in", ["APROVADA", "CONFIRMADA"])
        .where("data", ">=", todayStart)
        .where("data", "<", tomorrow)
        .count()
        .get();
      result.kpis.reservasHoje = reservasHojeSnap.data().count;
    } catch (e: any) {
      console.warn("[portaria/dashboard] reservas KPI falhou:", e?.message);
      result.kpis.reservasHoje = 0;
    }

    // ─── KPI: Incidentes Abertos ───
    try {
      const incAbertosSnap = await db.collection("condominios").doc(condominioId)
        .collection("incidentes")
        .where("status", "in", ["ABERTO", "EM_ANDAMENTO"])
        .count()
        .get();
      result.kpis.incidentesAbertos = incAbertosSnap.data().count;
    } catch (e: any) {
      console.warn("[portaria/dashboard] incidentes KPI falhou:", e?.message);
      result.kpis.incidentesAbertos = 0;
    }

    // ─── Acessos Recentes ───
    try {
      const acessosSnap = await db.collection("condominios").doc(condominioId)
        .collection("acessos")
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();

      result.acessosRecentes = acessosSnap.docs.map((d: any) => {
        const data = d.data();
        return {
          id: d.id,
          nome: safeStr(data.nome) || safeStr(data.visitanteNome) || "",
          tipo: safeStr(data.tipo) || "VISITANTE",
          status: safeStr(data.status) || "PENDENTE",
          blocoId: safeStr(data.blocoId) || safeStr(data.destinoBlocoId) || "",
          unidadeId: safeStr(data.unidadeId) || safeStr(data.destinoUnidadeId) || "",
          blocoNome: safeStr(data.destinoBlocoNome) || safeStr(data.blocoNome) || "",
          unidadeNumero: safeStr(data.destinoUnidadeNumero) || safeStr(data.unidadeNumero) || "",
          createdAt: serializeTimestamp(data.createdAt),
        };
      });
    } catch (e: any) {
      console.warn("[portaria/dashboard] acessos recentes falhou:", e?.message);
    }

    // ─── Encomendas Pendentes ───
    try {
      const encSnap = await db.collection("condominios").doc(condominioId)
        .collection("encomendas")
        .where("status", "==", "AGUARDANDO")
        .orderBy("chegouEm", "desc")
        .limit(10)
        .get();

      result.encomendasPendentes = encSnap.docs.map((d: any) => {
        const data = d.data();
        return {
          id: d.id,
          transportadora: safeStr(data.transportadora) || "",
          codigo: safeStr(data.codigo) || safeStr(data.codigoRastreio) || "",
          blocoNome: safeStr(data.blocoNome) || safeStr(data.unidadeSnapshot?.blocoNome) || "",
          unidadeNumero: safeStr(data.unidadeNumero) || safeStr(data.unidadeSnapshot?.unidadeNumero) || "",
          chegouEm: serializeTimestamp(data.chegouEm),
        };
      });
    } catch (e: any) {
      console.warn("[portaria/dashboard] encomendas falhou:", e?.message);
    }

    // ─── Reservas Hoje ───
    try {
      const tomorrow = new Date(todayStart);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const resSnap = await db.collection("condominios").doc(condominioId)
        .collection("reservas")
        .where("status", "in", ["APROVADA", "CONFIRMADA"])
        .where("data", ">=", todayStart)
        .where("data", "<", tomorrow)
        .limit(10)
        .get();

      result.reservasHoje = resSnap.docs.map((d: any) => {
        const data = d.data();
        return {
          id: d.id,
          areaNome: safeStr(data.areaNome) || safeStr(data.area) || "",
          horarioInicio: safeStr(data.horarioInicio) || safeStr(data.inicio) || "",
          horarioFim: safeStr(data.horarioFim) || safeStr(data.fim) || "",
          moradorNome: safeStr(data.moradorNome) || safeStr(data.criadoPorNome) || "",
          unidadeNumero: safeStr(data.unidadeNumero) || safeStr(data.unidadeSnapshot?.unidadeNumero) || "",
          status: safeStr(data.status) || "",
        };
      });
    } catch (e: any) {
      console.warn("[portaria/dashboard] reservas falhou:", e?.message);
    }

    // ─── Incidentes Abertos ───
    try {
      const incSnap = await db.collection("condominios").doc(condominioId)
        .collection("incidentes")
        .where("status", "in", ["ABERTO", "EM_ANDAMENTO"])
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();

      result.incidentesAbertos = incSnap.docs.map((d: any) => {
        const data = d.data();
        return {
          id: d.id,
          titulo: safeStr(data.titulo) || safeStr(data.descricao) || "",
          tipo: safeStr(data.tipo) || "",
          status: safeStr(data.status) || "",
          local: safeStr(data.local) || safeStr(data.localDescricao) || "",
          createdAt: serializeTimestamp(data.createdAt),
        };
      });
    } catch (e: any) {
      console.warn("[portaria/dashboard] incidentes falhou:", e?.message);
    }

    // ─── Comunicados (Anúncios PUBLICADOS) ───
    try {
      const now = new Date();
      const anunciosSnap = await db.collection("condominios").doc(condominioId)
        .collection("anuncios")
        .where("status", "==", "PUBLICADO")
        .where("publicadoEm", "<=", now)
        .orderBy("publicadoEm", "desc")
        .limit(5)
        .get();

      result.comunicados = anunciosSnap.docs.map((d: any) => {
        const data = d.data();
        const expiresAt = data.expiraEm?.toDate?.() || null;
        if (expiresAt && expiresAt < now) return null;
        return {
          id: d.id,
          titulo: safeStr(data.titulo) || "",
          resumo: safeStr(data.resumo) || safeStr(data.mensagem?.slice(0, 120)) || "",
          publicadoEm: serializeTimestamp(data.publicadoEm),
        };
      }).filter(Boolean);
    } catch (e: any) {
      console.warn("[portaria/dashboard] anuncios falhou:", e?.message);
    }

    return NextResponse.json(result);
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("[portaria/dashboard] erro:", e?.message || String(e));
    return jsonError("Erro ao carregar dashboard.", 500);
  }
}
