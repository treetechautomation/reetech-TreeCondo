"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import {
  normalizeLancamento,
  agruparPorBlocoUnidade,
  chaveParaRotuloBlocoUnidade,
  type LancamentoLeitura,
} from "@/lib/financeiroCompat";
import { FinanceiroStatus } from "@/lib/financeiroStatus";
import type { FinanceiroStatusType } from "@/lib/financeiroStatus";
import { ArrowLeft, Download, FileText } from "lucide-react";

function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?._seconds === "number") return new Date(v._seconds * 1000);
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateBR(v: any): string {
  const d = toDateSafe(v);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR");
}

function formatMesAno(competencia: string): string {
  if (!/^\d{4}-\d{2}$/.test(competencia)) return competencia || "—";
  const [y, m] = competencia.split("-");
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[parseInt(m, 10) - 1]} de ${y}`;
}

function moneyBRL(v: number): string {
  return (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusLabel(s: FinanceiroStatusType): string {
  const map: Record<string, string> = {
    [FinanceiroStatus.AGUARDANDO_ENVIO]: "Aguardando envio",
    [FinanceiroStatus.ENVIADO_ADMINISTRADORA]: "Enviado à administradora",
    [FinanceiroStatus.PROCESSANDO]: "Processando",
    [FinanceiroStatus.LANCADO_BOLETO]: "Lançado no boleto",
    [FinanceiroStatus.QUITADO]: "Quitado",
    [FinanceiroStatus.CANCELADO]: "Cancelado",
    [FinanceiroStatus.ISENTO]: "Isento",
    [FinanceiroStatus.ESTORNADO]: "Estornado",
  };
  return map[s] || s;
}

const TODOS_STATUSS: FinanceiroStatusType[] = [
  FinanceiroStatus.AGUARDANDO_ENVIO,
  FinanceiroStatus.ENVIADO_ADMINISTRADORA,
  FinanceiroStatus.PROCESSANDO,
  FinanceiroStatus.LANCADO_BOLETO,
  FinanceiroStatus.QUITADO,
  FinanceiroStatus.CANCELADO,
  FinanceiroStatus.ISENTO,
  FinanceiroStatus.ESTORNADO,
];

export default function FinanceiroReservasPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const firestore = useFirestore();

  const condId = session?.activeCondominioId ?? null;
  const role = String(session?.role || "").toUpperCase();
  const isSuperAdmin = !!(session as any)?.superAdmin;
  const isAdminLike =
    isSuperAdmin ||
    ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(role);

  if (!isAdminLike && !isSessionLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-slate-700">
              Acesso restrito
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Você não possui permissão para acessar o módulo financeiro.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }
  const userName = String(session?.user?.displayName || session?.user?.email || "Administrador");

  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [lancamentos, setLancamentos] = React.useState<LancamentoLeitura[]>([]);
  const [condominioNome, setCondominioNome] = React.useState<string>("");

  const [filtroCompetencia, setFiltroCompetencia] = useState("");
  const [filtroBloco, setFiltroBloco] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [generating, setGenerating] = useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!firestore || !condId || !isAdminLike) {
        if (!cancelled) { setLancamentos([]); setLoading(false); }
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        const [snap, condoSnap] = await Promise.all([
          getDocs(collection(firestore, "condominios", condId, "financeiro")),
          getDoc(doc(firestore, "condominiosPublicos", condId)),
        ]);

        const list: LancamentoLeitura[] = snap.docs.map((d) =>
          normalizeLancamento({ id: d.id, ...(d.data() || {}) } as any, d.id)
        );

        if (!cancelled) {
          setCondominioNome(String((condoSnap.data() || {}).nome || condId));
          setLancamentos(list);
          setLoading(false);
        }
      } catch (e: any) {
        console.error("[FinanceiroReservas] erro:", e);
        if (!cancelled) { setErr(e?.message || "Erro ao carregar."); setLancamentos([]); setLoading(false); }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [firestore, condId, isAdminLike]);

  const filtrados = useMemo(() => {
    let items = lancamentos;

    if (filtroCompetencia) {
      items = items.filter((l) => l.competencia === filtroCompetencia);
    }
    if (filtroBloco) {
      const q = filtroBloco.toLowerCase();
      items = items.filter((l) =>
        l.blocoNome.toLowerCase().includes(q) || l.blocoIdNorm.toLowerCase().includes(q)
      );
    }
    if (filtroUnidade) {
      const q = filtroUnidade.toLowerCase();
      items = items.filter((l) =>
        l.unidadeId.toLowerCase().includes(q) || l.unidadeIdNorm.toLowerCase().includes(q)
      );
    }
    if (filtroArea) {
      const q = filtroArea.toLowerCase();
      items = items.filter((l) => l.areaNome.toLowerCase().includes(q) || l.areaId.toLowerCase().includes(q));
    }
    if (filtroStatus) {
      items = items.filter((l) => l.status === filtroStatus);
    }
    if (filtroDataInicio) {
      const ini = new Date(filtroDataInicio).getTime();
      if (!isNaN(ini)) items = items.filter((l) => {
        const d = toDateSafe(l.dataEvento);
        return d ? d.getTime() >= ini : false;
      });
    }
    if (filtroDataFim) {
      const fim = new Date(filtroDataFim).getTime();
      if (!isNaN(fim)) items = items.filter((l) => {
        const d = toDateSafe(l.dataEvento);
        return d ? d.getTime() <= fim : false;
      });
    }

    items.sort((a, b) => {
      const da = toDateSafe(a.dataEvento)?.getTime() || 0;
      const db = toDateSafe(b.dataEvento)?.getTime() || 0;
      return da - db;
    });

    return items;
  }, [lancamentos, filtroCompetencia, filtroBloco, filtroUnidade, filtroArea, filtroStatus, filtroDataInicio, filtroDataFim]);

  const competenciasDisponiveis = useMemo(() => {
    const s = new Set<string>();
    lancamentos.forEach((l) => { if (l.competencia) s.add(l.competencia); });
    return Array.from(s).sort();
  }, [lancamentos]);

  const totalValor = filtrados.reduce((acc, l) => acc + l.valorCentavos, 0);
  const aptosUnicos = useMemo(() => {
    const s = new Set<string>();
    filtrados.forEach((l) => {
      const key = `${l.blocoIdNorm || "_"}:${l.unidadeIdNorm || "_"}`;
      s.add(key);
    });
    return s.size;
  }, [filtrados]);

  const contagemStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filtrados.forEach((l) => {
      map[l.status] = (map[l.status] || 0) + 1;
    });
    return map;
  }, [filtrados]);

  function limparFiltros() {
    setFiltroCompetencia("");
    setFiltroBloco("");
    setFiltroUnidade("");
    setFiltroArea("");
    setFiltroStatus("");
    setFiltroDataInicio("");
    setFiltroDataFim("");
  }

  async function gerarPdf() {
    setGenerating(true);
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      const titulo = "Lançamentos Financeiros de Reservas";
      const competenciaLabel = filtroCompetencia ? formatMesAno(filtroCompetencia) : "Todas";
      const dataHora = new Date().toLocaleString("pt-BR");

      let y = 14;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(condominioNome || condId || "Condomínio", 14, y);

      pdf.setFontSize(12);
      pdf.text(titulo, 14, y + 8);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(`Competência: ${competenciaLabel}`, 14, y + 14);
      pdf.text(`Gerado em: ${dataHora}`, 14, y + 19);
      pdf.text(`Por: ${userName}`, 14, y + 24);

      y += 30;

      autoTable(pdf, {
        startY: y,
        head: [["Apartamentos", "Reservas", "Valor total", ...TODOS_STATUSS.map((s) => statusLabel(s))]],
        body: [[
          String(aptosUnicos),
          String(filtrados.length),
          moneyBRL(totalValor),
          ...TODOS_STATUSS.map((s) => String(contagemStatus[s] || 0)),
        ]],
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [13, 68, 89], textColor: 255 },
      });

      y = ((pdf as any).lastAutoTable?.finalY || y) + 6;

      const grupos = agruparPorBlocoUnidade(filtrados);
      const chaves = Array.from(grupos.keys()).sort();

      for (const chave of chaves) {
        const items = grupos.get(chave)!;
        const rotulo = chaveParaRotuloBlocoUnidade(items);
        const subtotal = items.reduce((acc, l) => acc + l.valorCentavos, 0);

        if (y > 170) { pdf.addPage(); y = 14; }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(rotulo, 14, y);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(`Subtotal: ${moneyBRL(subtotal)}  •  ${items.length} reserva(s)`, 14, y + 5);

        y += 10;

        const bodyRows = items.map((l) => [
          l.numeroReserva || l.id.substring(0, 8),
          formatDateBR(l.dataSolicitacao),
          formatDateBR(l.dataEvento),
          l.areaNome || l.areaId,
          l.opcaoNome || "—",
          moneyBRL(l.valorCentavos),
          l.competencia || "—",
          statusLabel(l.status),
          l.observacoes || "",
        ]);

        autoTable(pdf, {
          startY: y,
          head: [["Nº Reserva", "Solicitação", "Evento", "Área", "Opção", "Valor", "Competência", "Status", "Obs."]],
          body: bodyRows,
          theme: "striped",
          styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
          headStyles: { fillColor: [0, 208, 230], textColor: [15, 23, 42] },
          columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 22 },
            2: { cellWidth: 22 },
            3: { cellWidth: 28 },
            4: { cellWidth: 24 },
            5: { cellWidth: 22 },
            6: { cellWidth: 22 },
            7: { cellWidth: 24 },
            8: { cellWidth: "auto" },
          },
        });

        y = ((pdf as any).lastAutoTable?.finalY || y) + 4;
      }

      if (y > 250) { pdf.addPage(); y = 14; }
      y += 8;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(`Total geral: ${moneyBRL(totalValor)}`, 14, y);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.text(`${filtrados.length} reserva(s) em ${aptosUnicos} apartamento(s).`, 14, y + 5);

      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(128, 128, 128);
        pdf.text(`TreeCondo — Página ${i} de ${pageCount}`, 280, 200, { align: "right" });
      }

      const nomeArquivo = filtroCompetencia
        ? `financeiro-reservas-${filtroCompetencia}.pdf`
        : `financeiro-reservas-${new Date().toISOString().slice(0, 10)}.pdf`;

      pdf.save(nomeArquivo);
    } catch (e: any) {
      alert(e?.message || "Erro ao gerar PDF.");
    } finally {
      setGenerating(false);
    }
  }

  if (isSessionLoading) {
    return <AppLayout pageTitle="Relatório Financeiro de Reservas">Carregando sessão...</AppLayout>;
  }
  if (!session || !condId) {
    return <AppLayout pageTitle="Relatório Financeiro de Reservas">Sem sessão ativa.</AppLayout>;
  }
  if (!isAdminLike) {
    return <AppLayout pageTitle="Relatório Financeiro de Reservas">Acesso negado.</AppLayout>;
  }

  return (
    <AppLayout pageTitle="Relatório Financeiro de Reservas">
      <div className="space-y-6">
        <div className="rounded-3xl border border-black/5 bg-white/65 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[#0D4459]">{condominioNome}</div>
              <div className="text-xs text-slate-500">Lançamentos financeiros de reservas — exportação para administradora</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/financeiro"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
              </Button>
              <Button onClick={gerarPdf} disabled={generating}>
                <Download className="h-4 w-4" /> {generating ? "Gerando..." : "Gerar PDF"}
              </Button>
            </div>
          </div>
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>
        ) : null}

        <div className="rounded-2xl border border-black/5 bg-white/65 p-4 shadow-sm backdrop-blur-xl">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">Competência</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={filtroCompetencia}
                onChange={(e) => setFiltroCompetencia(e.target.value)}
              >
                <option value="">Todas</option>
                {competenciasDisponiveis.map((c) => (
                  <option key={c} value={c}>{formatMesAno(c)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Bloco</label>
              <Input
                className="mt-1 rounded-xl"
                value={filtroBloco}
                onChange={(e) => setFiltroBloco(e.target.value)}
                placeholder="Ex: Bloco A"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Apartamento</label>
              <Input
                className="mt-1 rounded-xl"
                value={filtroUnidade}
                onChange={(e) => setFiltroUnidade(e.target.value)}
                placeholder="Ex: 101"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Área</label>
              <Input
                className="mt-1 rounded-xl"
                value={filtroArea}
                onChange={(e) => setFiltroArea(e.target.value)}
                placeholder="Ex: Salão"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Status</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
              >
                <option value="">Todos</option>
                {TODOS_STATUSS.map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Data início</label>
              <Input
                className="mt-1 rounded-xl"
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">Data fim</label>
              <Input
                className="mt-1 rounded-xl"
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={limparFiltros} className="rounded-xl">
                Limpar filtros
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-black/5 bg-white/65 p-4 text-sm text-slate-600">Carregando...</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#0D4459]">Apartamentos</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{aptosUnicos}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#0D4459]">Reservas</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{filtrados.length}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#0D4459]">Valor total</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{moneyBRL(totalValor)}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#0D4459]">Por status</div>
                <div className="mt-1 text-xs text-slate-600">
                  {TODOS_STATUSS.map((s) => {
                    const n = contagemStatus[s] || 0;
                    if (n === 0) return null;
                    return <div key={s}>{statusLabel(s)}: {n}</div>;
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-black/5 bg-white/65 p-5 shadow-sm backdrop-blur-xl">
              <div className="mb-4 text-sm font-semibold text-[#0D4459]">
                Lançamentos {filtrados.length > 0 ? `(${filtrados.length})` : ""}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2">Nº</th>
                      <th className="px-2 py-2">Bloco/Apto</th>
                      <th className="px-2 py-2">Morador</th>
                      <th className="px-2 py-2">Solicitação</th>
                      <th className="px-2 py-2">Evento</th>
                      <th className="px-2 py-2">Área</th>
                      <th className="px-2 py-2">Valor</th>
                      <th className="px-2 py-2">Competência</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-2 py-6 text-center text-slate-500">Nenhum lançamento encontrado.</td>
                      </tr>
                    ) : (
                      filtrados.map((l) => (
                        <tr key={l.id} className="border-b border-black/5 text-slate-800 hover:bg-slate-50">
                          <td className="px-2 py-2 text-xs font-mono">{l.numeroReserva || l.id.substring(0, 8)}</td>
                          <td className="px-2 py-2">{[l.blocoNome, l.unidadeId].filter(Boolean).join(" - ") || "—"}</td>
                          <td className="px-2 py-2">{l.moradorNome || l.moradorUid}</td>
                          <td className="px-2 py-2">{formatDateBR(l.dataSolicitacao)}</td>
                          <td className="px-2 py-2">{formatDateBR(l.dataEvento)}</td>
                          <td className="px-2 py-2">{l.areaNome || l.areaId}</td>
                          <td className="px-2 py-2 font-medium">{moneyBRL(l.valorCentavos)}</td>
                          <td className="px-2 py-2">{l.competencia || "—"}</td>
                          <td className="px-2 py-2 text-xs">{statusLabel(l.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {filtrados.length > 0 && (
                <div className="mt-4 text-xs text-slate-500">
                  Total: {filtrados.length} reserva(s) em {aptosUnicos} apartamento(s) • Valor total: {moneyBRL(totalValor)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
