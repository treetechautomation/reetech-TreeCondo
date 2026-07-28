"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { SectionCard } from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCondominio } from "@/contexts/CondominioContext";
import { useSessionCtx } from "@/contexts/SessionContext";
import { hasRole } from "@/lib/acl";
import { useToast } from "@/hooks/use-toast";
import { Building2, Home, PlusCircle, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { UnidadeTipo, BlocoTipo } from "@/lib/normalization/unit-types";
import * as XLSX from "xlsx";

// ─── Constants ────────────────────────────────────

const BLOCK_TYPES: { value: BlocoTipo; label: string }[] = [
  { value: "BLOCO", label: "Bloco" },
  { value: "TORRE", label: "Torre" },
  { value: "QUADRA", label: "Quadra" },
  { value: "SETOR", label: "Setor" },
  { value: "ALAMEDA", label: "Alameda" },
  { value: "OUTRO", label: "Outro..." },
];

const UNIT_TYPES: { value: UnidadeTipo; label: string }[] = [
  { value: "APARTAMENTO", label: "Apartamento" },
  { value: "CASA", label: "Casa" },
  { value: "SALA", label: "Sala" },
  { value: "LOJA", label: "Loja" },
  { value: "LOTE", label: "Lote" },
  { value: "CONJUNTO", label: "Conjunto" },
  { value: "OUTRO", label: "Outro..." },
];

const VALID_UNIT_TYPES: string[] = ["APARTAMENTO", "CASA", "SALA", "LOJA", "LOTE", "CONJUNTO", "OUTRO"];
const VALID_BLOCK_TYPES: string[] = ["BLOCO", "TORRE", "QUADRA", "SETOR", "ALAMEDA", "OUTRO"];

const TABS = [
  { key: "blocos", label: "Blocos" },
  { key: "unidades", label: "Unidades" },
] as const;

// ─── Types ─────────────────────────────────────────

interface BlocoItem {
  id: string; nome: string; nomeNorm: string; tipo: BlocoTipo;
  tipoCustom?: string | null; isSistema: boolean; ordem: number;
  ativo: boolean; condominioId: string;
}

interface UnidadeItem {
  id: string; numero: string; numeroNorm: string; blocoId: string;
  condominioId: string; andar: number | null; tipo: UnidadeTipo;
  tipoCustom?: string | null; ocupacao: string; ativo: boolean;
}

// ─── Tab component ─────────────────────────────────

function TabBar({ active, onChange }: { active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.05] border border-white/10 w-fit">
      {TABS.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-medium transition-all",
            active === t.key
              ? "bg-white/10 text-white shadow-inner"
              : "text-white/60 hover:text-white/80"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Pagina principal ──────────────────────────────

export default function EstruturaPage() {
  const { condominioAtivoId } = useCondominio();
  const { session } = useSessionCtx();
  const { toast } = useToast();
  const [tab, setTab] = useState<string>("blocos");

  const canManage = hasRole(session, ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"]);

  async function getToken() { return await session?.user?.getIdToken(); }

  // ─── Blocos state ──────────────────────────────
  const [blocos, setBlocos] = useState<BlocoItem[]>([]);
  const [blocosLoading, setBlocosLoading] = useState(true);
  const [blocoDialog, setBlocoDialog] = useState(false);
  const [editingBloco, setEditingBloco] = useState<BlocoItem | null>(null);
  const [blocoForm, setBlocoForm] = useState({ nome: "", tipo: "BLOCO" as BlocoTipo, tipoCustom: "", ordem: 0 });
  const [blocoSaving, setBlocoSaving] = useState(false);
  const [blocoBusca, setBlocoBusca] = useState("");

  async function loadBlocos() {
    if (!condominioAtivoId) return;
    setBlocosLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/blocos?condominioId=${encodeURIComponent(condominioAtivoId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setBlocos(data.blocos || []);
    } catch { /* ignore */ }
    setBlocosLoading(false);
  }

  useEffect(() => { loadBlocos(); }, [condominioAtivoId]);

  function openBlocoCreate() {
    setEditingBloco(null);
    setBlocoForm({ nome: "", tipo: "BLOCO", tipoCustom: "", ordem: blocos.length });
    setBlocoDialog(true);
  }
  function openBlocoEdit(b: BlocoItem) {
    setEditingBloco(b);
    setBlocoForm({ nome: b.nome, tipo: b.tipo, tipoCustom: b.tipoCustom || "", ordem: b.ordem ?? 0 });
    setBlocoDialog(true);
  }

  async function saveBloco() {
    if (!blocoForm.nome.trim()) return;
    if (blocoForm.tipo === "OUTRO" && !blocoForm.tipoCustom.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe o tipo personalizado.", variant: "destructive" }); return;
    }
    setBlocoSaving(true);
    const token = await getToken();
    const body: any = { condominioId: condominioAtivoId, nome: blocoForm.nome.trim(), tipo: blocoForm.tipo, tipoCustom: blocoForm.tipo === "OUTRO" ? blocoForm.tipoCustom.trim() : null, ordem: blocoForm.ordem };
    const res = editingBloco
      ? await fetch(`/api/blocos/${editingBloco.id}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/blocos", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.ok) { toast({ title: editingBloco ? "Bloco atualizado" : "Bloco criado" }); setBlocoDialog(false); loadBlocos(); }
    else toast({ title: "Erro", description: data.error, variant: "destructive" });
    setBlocoSaving(false);
  }

  async function toggleBloco(b: BlocoItem) {
    if (b.ativo && !confirm(`Desativar bloco "${b.nome}"?`)) return;
    const token = await getToken();
    let res: Response;
    if (b.ativo) {
      res = await fetch(`/api/blocos/${b.id}?condominioId=${encodeURIComponent(condominioAtivoId!)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    } else {
      res = await fetch(`/api/blocos/${b.id}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ condominioId: condominioAtivoId, ativo: true }) });
    }
    const data = await res.json();
    if (data.ok) { toast({ title: b.ativo ? "Bloco desativado" : "Bloco reativado" }); loadBlocos(); }
    else toast({ title: "Erro", description: data.error, variant: "destructive" });
  }

  // ─── Unidades state ─────────────────────────────
  const [unidades, setUnidades] = useState<UnidadeItem[]>([]);
  const [unidadesLoading, setUnidadesLoading] = useState(true);
  const [unidadeDialog, setUnidadeDialog] = useState(false);
  const [editingUnidade, setEditingUnidade] = useState<UnidadeItem | null>(null);
  const [uniForm, setUniForm] = useState({ numero: "", blocoId: "", andar: "", tipo: "APARTAMENTO" as UnidadeTipo, tipoCustom: "", ocupacao: "VAGO" });
  const [uniSaving, setUniSaving] = useState(false);
  // ─── Batch state ───────────────────────────────
  const [batchDialog, setBatchDialog] = useState(false);
  const [batchStep, setBatchStep] = useState<"config" | "preview" | "result">("config");
  const [batchMode, setBatchMode] = useState<"andar" | "lista">("andar");
  const [batchBloco, setBatchBloco] = useState("");
  const [batchTipo, setBatchTipo] = useState<UnidadeTipo>("APARTAMENTO");
  const [batchTipoCustom, setBatchTipoCustom] = useState("");
  const [batchOcupacao, setBatchOcupacao] = useState("VAGO");
  const [andarIni, setAndarIni] = useState(1);
  const [andarFim, setAndarFim] = useState(1);
  const [finais, setFinais] = useState("01\n02\n03\n04");
  const [listaDireta, setListaDireta] = useState("");
  const [previewUnits, setPreviewUnits] = useState<{ numero: string; andar: number | null; status: string }[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);
  // ─── Import state ──────────────────────────────
  const [importDialog, setImportDialog] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "confirm" | "result">("upload");
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importBlocosNovos, setImportBlocosNovos] = useState<Set<string>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [uniBusca, setUniBusca] = useState("");
  const [uniBlocoFiltro, setUniBlocoFiltro] = useState("");
  const [uniAtivas, setUniAtivas] = useState(true);

  const loadUnidades = useCallback(async () => {
    if (!condominioAtivoId || !uniBlocoFiltro) { setUnidades([]); setUnidadesLoading(false); return; }
    setUnidadesLoading(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams({ condominioId: condominioAtivoId, blocoId: uniBlocoFiltro });
      if (uniAtivas) params.set("apenasAtivas", "true");
      const res = await fetch(`/api/unidades?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setUnidades(data.unidades || []);
    } catch { /* ignore */ }
    setUnidadesLoading(false);
  }, [condominioAtivoId, uniBlocoFiltro, uniAtivas]);

  useEffect(() => {
    if (tab === "unidades" && condominioAtivoId) {
      if (!uniBlocoFiltro && blocos.length > 0) {
        const active = blocos.filter((b: BlocoItem) => b.ativo);
        if (active.length === 1) setUniBlocoFiltro(active[0].id);
      }
      if (uniBlocoFiltro) loadUnidades();
    }
  }, [tab, condominioAtivoId, uniBlocoFiltro, uniAtivas]);

  function openUnidadeCreate() {
    setEditingUnidade(null);
    setUniForm({ numero: "", blocoId: uniBlocoFiltro || "", andar: "", tipo: "APARTAMENTO", tipoCustom: "", ocupacao: "VAGO" });
    setUnidadeDialog(true);
  }
  function openUnidadeEdit(u: UnidadeItem) {
    setEditingUnidade(u);
    setUniForm({ numero: u.numero, blocoId: u.blocoId, andar: u.andar?.toString() || "", tipo: u.tipo, tipoCustom: u.tipoCustom || "", ocupacao: u.ocupacao });
    setUnidadeDialog(true);
  }

  async function saveUnidade() {
    if (!uniForm.numero.trim()) return;
    if (!uniForm.blocoId) { toast({ title: "Selecione um bloco", variant: "destructive" }); return; }
    if (uniForm.tipo === "OUTRO" && !uniForm.tipoCustom.trim()) { toast({ title: "Informe o tipo personalizado", variant: "destructive" }); return; }
    setUniSaving(true);
    const token = await getToken();
    const body: any = { condominioId: condominioAtivoId, blocoId: uniForm.blocoId, numero: uniForm.numero.trim(), tipo: uniForm.tipo, tipoCustom: uniForm.tipo === "OUTRO" ? uniForm.tipoCustom.trim() : null, andar: uniForm.andar ? parseInt(uniForm.andar, 10) : null, ocupacao: uniForm.ocupacao };
    const res = editingUnidade
      ? await fetch(`/api/unidades/${editingUnidade.id}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/unidades", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.ok) { toast({ title: editingUnidade ? "Unidade atualizada" : "Unidade criada" }); setUnidadeDialog(false); loadUnidades(); }
    else toast({ title: "Erro", description: data.error, variant: "destructive" });
    setUniSaving(false);
  }

  async function toggleUnidade(u: UnidadeItem) {
    if (u.ativo && !confirm(`Desativar unidade "${u.numero}"?`)) return;
    const token = await getToken();
    const params = new URLSearchParams({ condominioId: condominioAtivoId!, blocoId: u.blocoId });
    let res: Response;
    if (u.ativo) {
      res = await fetch(`/api/unidades/${u.id}?${params.toString()}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    } else {
      res = await fetch(`/api/unidades/${u.id}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ condominioId: condominioAtivoId, blocoId: u.blocoId, ativo: true }) });
    }
    const data = await res.json();
    if (data.ok) { toast({ title: u.ativo ? "Unidade desativada" : "Unidade reativada" }); loadUnidades(); }
    else toast({ title: "Erro", description: data.error, variant: "destructive" });
  }

  // ─── Helpers ────────────────────────────────────
  const blocoLabel = (t: BlocoTipo, tc?: string | null) => t === "OUTRO" && tc ? tc : (BLOCK_TYPES.find(bt => bt.value === t)?.label || t);
  const uniLabel = (t: UnidadeTipo, tc?: string | null) => t === "OUTRO" && tc ? tc : (UNIT_TYPES.find(ut => ut.value === t)?.label || t);

  const filteredBlocos = blocos.filter(b => !blocoBusca || b.nome.toLowerCase().includes(blocoBusca.toLowerCase()));
  const showBlocoSelector = blocos.filter(b => b.ativo && !b.isSistema).length > 1 || blocos.some(b => !b.isSistema && b.ativo);

  const filteredUnidades = unidades.filter(u =>
    !uniBusca || u.numero.toLowerCase().includes(uniBusca.toLowerCase()) || u.numeroNorm.includes(uniBusca.toLowerCase())
  );
  const uniStats = {
    total: unidades.length,
    ativas: unidades.filter(u => u.ativo).length,
    vagas: unidades.filter(u => u.ativo && u.ocupacao === "VAGO").length,
    ocupadas: unidades.filter(u => u.ativo && u.ocupacao !== "VAGO" && u.ocupacao !== "EM_REFORMA" && u.ocupacao !== "INTERDITADO").length,
  };

  // ─── Batch generation ───────────────────────────
  function generatePreview() {
    const nums: { numero: string; andar: number | null }[] = [];
    if (batchMode === "andar") {
      if (andarIni > andarFim) return;
      const finaisList = finais.split("\n").map(s => s.trim()).filter(Boolean);
      if (finaisList.length === 0) return;
      for (let a = andarIni; a <= andarFim; a++) {
        for (const f of finaisList) {
          nums.push({ numero: `${a}${f}`, andar: a });
        }
      }
    } else {
      const lines = listaDireta.split("\n").map(s => s.trim()).filter(Boolean);
      for (const l of lines) nums.push({ numero: l, andar: null });
    }

    // Detect internal duplicates after normalization
    const seen = new Map<string, string>();
    const units: { numero: string; andar: number | null; status: string }[] = [];
    for (const n of nums) {
      const norm = String(n.numero).toLowerCase()
        .replace(/\b(apto|apt|apartamento|unidade)\b/gi, "")
        .replace(/[^0-9a-z]/gi, "").trim()
        .replace(/^0+/, "") || "0";
      if (seen.has(norm)) {
        units.push({ numero: n.numero, andar: n.andar, status: "DUPLICADO_LOTE" });
      } else {
        seen.set(norm, n.numero);
        units.push({ numero: n.numero, andar: n.andar, status: "NOVA" });
      }
    }
    setPreviewUnits(units);
    setBatchStep("preview");
  }

  async function executeBatch() {
    const validUnits = previewUnits.filter(u => u.status === "NOVA");
    if (validUnits.length === 0) {
      toast({ title: "Nenhuma unidade válida para criar.", variant: "destructive" }); return;
    }
    if (batchTipo === "OUTRO" && !batchTipoCustom.trim()) {
      toast({ title: "Informe o tipo personalizado", variant: "destructive" }); return;
    }
    setBatchLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/unidades/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          condominioId: condominioAtivoId,
          blocoId: batchBloco || uniBlocoFiltro,
          tipo: batchTipo,
          tipoCustom: batchTipo === "OUTRO" ? batchTipoCustom.trim() : null,
          ocupacao: batchOcupacao,
          unidades: validUnits.map(u => ({ numero: u.numero, andar: u.andar, tipo: batchTipo, ocupacao: batchOcupacao })),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBatchResult({ criadas: data.criadas, conflitos: 0, erros: 0, unidades: data.unidades });
        setBatchStep("result");
        loadUnidades();
      } else if (data.conflitos) {
        // Mark conflicts in preview
        const conflitosSet = new Set(data.conflitos.map((c: string) => c));
        setPreviewUnits(prev => prev.map(u => conflitosSet.has(u.numero) ? { ...u, status: "CONFLITO" } : u));
        toast({ title: "Conflitos detectados", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Erro", description: data.error || "Falha ao criar unidades.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha na requisição.", variant: "destructive" });
    }
    setBatchLoading(false);
  }

  function resetBatch() {
    setBatchStep("config"); setBatchMode("andar"); setBatchBloco(""); setBatchTipo("APARTAMENTO");
    setBatchTipoCustom(""); setBatchOcupacao("VAGO"); setAndarIni(1); setAndarFim(1);
    setFinais("01\n02\n03\n04"); setListaDireta(""); setPreviewUnits([]); setBatchResult(null);
  }

  function openBatchDialog() {
    resetBatch();
    if (blocos.length > 0) setBatchBloco(uniBlocoFiltro || (blocos.filter(b => b.ativo).length === 1 ? blocos.find(b => b.ativo)?.id || "" : ""));
    setBatchDialog(true);
  }

  // ─── Import functions ──────────────────────────
  const NORM_MAP: Record<string, UnidadeTipo> = { apartamento: "APARTAMENTO", casa: "CASA", sala: "SALA", loja: "LOJA", lote: "LOTE", conjunto: "CONJUNTO", outro: "OUTRO" };
  const OCUP_MAP: Record<string, string> = { vago: "VAGO", ocupado: "OCUPADO" };
  const BLOC_MAP: Record<string, BlocoTipo> = { bloco: "BLOCO", torre: "TORRE", quadra: "QUADRA", setor: "SETOR", alameda: "ALAMEDA", outro: "OUTRO" };

  function normalizeHeader(h: string): string {
    return h.toLowerCase().trim()
      .replace(/^bloco$/i, "bloco").replace(/^unidade$/i, "unidade").replace(/^tipo$/i, "tipo")
      .replace(/^andar$/i, "andar").replace(/^ocupacao$/i, "ocupacao")
      .replace(/^tipoCustom$/i, "tipocustom").replace(/^blocoTipo$/i, "blocotipo").replace(/^blocoTipoCustom$/i, "blocotipocustom");
  }

  function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
        if (rows.length < 2) { toast({ title: "Planilha vazia ou sem dados.", variant: "destructive" }); return; }

        const headers = (rows[0] as string[]).map(h => normalizeHeader(String(h)));
        const colMap: Record<string, number> = {};
        headers.forEach((h, i) => { colMap[h] = i; });

        if (!("unidade" in colMap)) { toast({ title: "Coluna 'unidade' obrigatória.", variant: "destructive" }); return; }

        const parsed: any[] = [];
        const novoBlocos = new Set<string>();
        const blocoIdx = colMap["bloco"];
        const unidadeIdx = colMap["unidade"];
        const tipoIdx = colMap["tipo"];
        const andarIdx = colMap["andar"];
        const ocupIdx = colMap["ocupacao"];
        const tcIdx = colMap["tipocustom"];
        const btIdx = colMap["blocotipo"];
        const btcIdx = colMap["blocotipocustom"];

        for (let i = 1; i < rows.length; i++) {
          const r = rows[i] as string[];
          const rawNum = String(r[unidadeIdx] ?? "").trim();
          if (!rawNum) continue;

          const rawBloco = String(r[blocoIdx] ?? "").trim();
          const rawTipo = String(r[tipoIdx] ?? "").trim().toLowerCase();
          const rawAndar = String(r[andarIdx] ?? "").trim();
          const rawOcup = String(r[ocupIdx] ?? "").trim().toLowerCase();
          const rawTC = String(r[tcIdx] ?? "").trim();
          const rawBT = String(r[btIdx] ?? "").trim().toLowerCase();
          const rawBTC = String(r[btcIdx] ?? "").trim();

          const tipo = NORM_MAP[rawTipo] || (VALID_UNIT_TYPES.includes(rawTipo.toUpperCase() as any) ? rawTipo.toUpperCase() : null);
          const blocoNome = rawBloco || (showBlocoSelector ? null : (blocos.find(b => b.ativo)?.nome || ""));
          const blocoTipo = BLOC_MAP[rawBT] || (VALID_BLOCK_TYPES.includes(rawBT.toUpperCase() as any) ? rawBT.toUpperCase() : null);
          const ocup = OCUP_MAP[rawOcup] || (["vago", "ocupado", "em_reforma", "interditado"].includes(rawOcup) ? rawOcup.toUpperCase().replace(/_/g, "_") : "VAGO");

          let blocoId = "";
          const blocoExistente = blocos.find(b => b.nome.toLowerCase().trim() === (blocoNome || "").toLowerCase().trim());
          if (blocoExistente) blocoId = blocoExistente.id;
          else if (blocoNome) novoBlocos.add(blocoNome);

          const errors: string[] = [];
          if (!tipo) errors.push(`Tipo inválido: "${rawTipo}"`);
          if (tipo === "OUTRO" && !rawTC) errors.push("tipoCustom obrigatório para OUTRO");

          parsed.push({
            linha: i + 1, blocoNome, blocoId, blocoNovo: !blocoId && !!blocoNome, blocoTipo, blocoTipoCustom: rawBTC || null,
            numero: rawNum, tipo, tipoCustom: rawTC || null,
            andar: rawAndar && !isNaN(Number(rawAndar)) ? Number(rawAndar) : null,
            ocupacao: ocup, status: errors.length ? "INVÁLIDA" : "VÁLIDA", errors,
          });
        }

        setImportBlocosNovos(novoBlocos);
        setImportRows(parsed);
        setImportStep("preview");
      } catch (err: any) {
        toast({ title: "Erro ao ler arquivo", description: err?.message || "Formato inválido.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadModel() {
    const headers = ["bloco", "unidade", "tipo", "andar", "ocupacao", "tipoCustom", "blocoTipo", "blocoTipoCustom"];
    const example = ["Rosas", "101", "APARTAMENTO", "1", "VAGO", "", "BLOCO", ""];
    const csv = [headers.join(","), example.join(",")].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "modelo-unidades-treecondo.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function executeImport() {
    const validRows = importRows.filter((r: any) => r.status === "VÁLIDA");
    if (validRows.length === 0) { toast({ title: "Nenhuma linha válida.", variant: "destructive" }); return; }

    setImportLoading(true);
    const token = await getToken();
    const results = { criadas: 0, blocosNovos: 0, conflitos: 0, erros: 0, total: validRows.length };

    try {
      // Phase 1: create new blocos
      for (const nome of importBlocosNovos) {
        const row = importRows.find((r: any) => r.blocoNome === nome);
        const bt = row?.blocoTipo || "BLOCO";
        const btc = row?.blocoTipoCustom || null;
        const bRes = await fetch("/api/blocos", {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ condominioId: condominioAtivoId, nome, tipo: bt, tipoCustom: btc, ordem: 0 }),
        });
        const bData = await bRes.json();
        if (bData.ok) { results.blocosNovos++; loadBlocos(); }
      }
      // Small delay for Firestore propagation
      await new Promise(r => setTimeout(r, 500));
      const updatedBlocos: BlocoItem[] = [];
      // Refresh blocos list silently
      try {
        const br = await fetch(`/api/blocos?condominioId=${encodeURIComponent(condominioAtivoId!)}`, { headers: { Authorization: `Bearer ${token}` } });
        const bj = await br.json();
        if (bj.ok) updatedBlocos.push(...(bj.blocos || []));
      } catch { /* ignore */ }

      // Resolve blocoIds after creation
      const unitsByBloco: Record<string, { numero: string; andar: number | null; tipo: UnidadeTipo; tipoCustom: string | null; ocupacao: string }[]> = {};
      for (const r of validRows) {
        const allBlocos = updatedBlocos.length > 0 ? updatedBlocos : blocos;
        const b = allBlocos.find((x: any) => x.nome.toLowerCase().trim() === (r.blocoNome || "").toLowerCase().trim());
        const bid = b?.id || (blocos.find((x: any) => x.nome.toLowerCase().trim() === (r.blocoNome || "").toLowerCase().trim())?.id || uniBlocoFiltro);
        if (!bid) { r.status = "INVÁLIDA"; r.errors = ["Bloco não encontrado"]; results.erros++; continue; }
        if (!unitsByBloco[bid]) unitsByBloco[bid] = [];
        unitsByBloco[bid].push({ numero: r.numero, andar: r.andar, tipo: r.tipo, tipoCustom: r.tipoCustom, ocupacao: r.ocupacao });
      }

      // Phase 2: create unidades in chunks
      for (const [bid, units] of Object.entries(unitsByBloco)) {
        for (let i = 0; i < units.length; i += 200) {
          const chunk = units.slice(i, i + 200);
          const res = await fetch("/api/unidades/batch", {
            method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ condominioId: condominioAtivoId, blocoId: bid, tipo: chunk[0].tipo, tipoCustom: chunk[0].tipoCustom, ocupacao: chunk[0].ocupacao || "VAGO", unidades: chunk }),
          });
          const data = await res.json();
          if (data.ok) results.criadas += data.criadas;
          else { results.erros += chunk.length; results.conflitos += (data.conflitos?.length || 0); }
        }
      }

      setImportResult(results);
      setImportStep("result");
      loadUnidades();
    } catch (e: any) {
      toast({ title: "Erro na importação", description: e?.message, variant: "destructive" });
    }
    setImportLoading(false);
  }

  function resetImport() {
    setImportStep("upload"); setImportRows([]); setImportBlocosNovos(new Set()); setImportResult(null);
  }

  // ─── Render ─────────────────────────────────────
  return (
    <AppLayout pageTitle="Blocos e Unidades">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Gerencie a estrutura física e as unidades do condomínio.
        </p>
        <TabBar active={tab} onChange={setTab} />

        {/* ═══════ BLOCOS ═══════ */}
        {tab === "blocos" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <Input placeholder="Buscar bloco..." value={blocoBusca} onChange={e => setBlocoBusca(e.target.value)} className="max-w-xs" />
              {canManage && <Button onClick={openBlocoCreate}><PlusCircle className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Novo bloco</span></Button>}
            </div>
            {blocosLoading ? <p className="text-muted-foreground text-sm">Carregando...</p> :
             filteredBlocos.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="Nenhum bloco cadastrado"
                description="Crie blocos para organizar as unidades do condomínio."
                action={canManage ? { label: "Novo bloco", onClick: openBlocoCreate } : undefined}
              />
            ) : (
              <SectionCard noPadding>
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead className="hidden sm:table-cell">Ordem</TableHead><TableHead>Status</TableHead>{canManage && <TableHead className="w-12" />}</TableRow></TableHeader>
                  <TableBody>
                    {filteredBlocos.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.nome}{b.isSistema && <Badge variant="secondary" className="ml-2 text-xs">sistema</Badge>}</TableCell>
                        <TableCell>{blocoLabel(b.tipo, b.tipoCustom)}</TableCell>
                        <TableCell className="hidden sm:table-cell">{b.ordem}</TableCell>
                        <TableCell><StatusBadge tone={b.ativo ? "success" : "neutral"}>{b.ativo ? "Ativo" : "Inativo"}</StatusBadge></TableCell>
                        {canManage && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={b.isSistema}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openBlocoEdit(b)}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleBloco(b)} className={b.ativo ? "text-destructive" : ""}>{b.ativo ? <><Trash2 className="h-4 w-4 mr-2" /> Desativar</> : "Reativar"}</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SectionCard>
            )}
          </div>
        )}

        {/* ═══════ UNIDADES ═══════ */}
        {tab === "unidades" && (
          <div className="space-y-3">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[{ l: "Total", v: uniStats.total }, { l: "Ativas", v: uniStats.ativas }, { l: "Vagas", v: uniStats.vagas }, { l: "Ocupadas", v: uniStats.ocupadas }].map(s => (
                <div key={s.l} className="tc-glass-card p-2 text-center"><p className="text-xl font-bold">{s.v}</p><p className="text-[10px] text-muted-foreground">{s.l}</p></div>
              ))}
            </div>
            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-center">
              {showBlocoSelector && blocos.length > 0 && (
                <Select value={uniBlocoFiltro} onValueChange={v => setUniBlocoFiltro(v)}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Bloco" /></SelectTrigger>
                  <SelectContent>{blocos.filter(b => b.ativo).map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <Input placeholder="Buscar unidade..." value={uniBusca} onChange={e => setUniBusca(e.target.value)} className="max-w-[180px]" />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={uniAtivas} onChange={e => setUniAtivas(e.target.checked)} /> Ativas</label>
              <div className="flex-1" />
              {canManage && <Button onClick={openUnidadeCreate}><PlusCircle className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Nova unidade</span></Button>}
              {canManage && <Button variant="outline" onClick={openBatchDialog}><span className="hidden sm:inline">Gerar em lote</span><span className="sm:hidden">Lote</span></Button>}
              {canManage && <Button variant="ghost" size="sm" onClick={() => { resetImport(); setImportDialog(true); }}><span className="hidden sm:inline">Importar planilha</span><span className="sm:hidden">Imp.</span></Button>}
            </div>
            {unidadesLoading ? <p className="text-muted-foreground text-sm">Carregando...</p> :
             !uniBlocoFiltro ? (
              <EmptyState
                icon={Building2}
                title="Selecione um bloco"
                description="Escolha um bloco acima para visualizar suas unidades."
              />
            ) : filteredUnidades.length === 0 ? (
              <EmptyState
                icon={Home}
                title="Nenhuma unidade cadastrada"
                description="Adicione unidades manualmente, gere em lote ou importe de uma planilha."
                action={canManage ? { label: "Nova unidade", onClick: openUnidadeCreate } : undefined}
              />
            ) : (
              <SectionCard noPadding>
                <Table>
                  <TableHeader><TableRow><TableHead>Número</TableHead><TableHead className="hidden sm:table-cell">Tipo</TableHead><TableHead className="hidden md:table-cell">Andar</TableHead><TableHead>Estado</TableHead><TableHead className="hidden sm:table-cell">Status</TableHead>{canManage && <TableHead className="w-12" />}</TableRow></TableHeader>
                  <TableBody>
                    {filteredUnidades.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.numero}</TableCell>
                        <TableCell className="hidden sm:table-cell">{uniLabel(u.tipo, u.tipoCustom)}</TableCell>
                        <TableCell className="hidden md:table-cell">{u.andar ?? "—"}</TableCell>
                        <TableCell><StatusBadge tone={u.ocupacao === "VAGO" ? "neutral" : u.ocupacao === "OCUPADO" ? "success" : u.ocupacao === "EM_REFORMA" ? "warning" : "danger"}>{u.ocupacao === "VAGO" ? "Vago" : u.ocupacao === "OCUPADO" ? "Ocupado" : u.ocupacao === "EM_REFORMA" ? "Em reforma" : "Interditado"}</StatusBadge></TableCell>
                        <TableCell className="hidden sm:table-cell"><StatusBadge tone={u.ativo ? "success" : "neutral"}>{u.ativo ? "Ativo" : "Inativo"}</StatusBadge></TableCell>
                        {canManage && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openUnidadeEdit(u)}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleUnidade(u)} className={u.ativo ? "text-destructive" : ""}>{u.ativo ? <><Trash2 className="h-4 w-4 mr-2" /> Desativar</> : "Reativar"}</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SectionCard>
            )}
          </div>
        )}

        {/* ═══════ DIALOG: Bloco ═══════ */}
        <Dialog open={blocoDialog} onOpenChange={setBlocoDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingBloco ? "Editar bloco" : "Novo bloco"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={blocoForm.nome} onChange={e => setBlocoForm({ ...blocoForm, nome: e.target.value })} placeholder="Ex: Bloco A" /></div>
              <div><Label>Tipo</Label>
                <Select value={blocoForm.tipo} onValueChange={v => setBlocoForm({ ...blocoForm, tipo: v as BlocoTipo, tipoCustom: v !== "OUTRO" ? "" : blocoForm.tipoCustom })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BLOCK_TYPES.map(bt => <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {blocoForm.tipo === "OUTRO" && <div><Label>Tipo personalizado *</Label><Input value={blocoForm.tipoCustom} onChange={e => setBlocoForm({ ...blocoForm, tipoCustom: e.target.value })} placeholder="Ex: Galpão" /></div>}
              <div><Label>Ordem</Label><Input type="number" value={blocoForm.ordem} onChange={e => setBlocoForm({ ...blocoForm, ordem: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBlocoDialog(false)}>Cancelar</Button>
              <Button onClick={saveBloco} disabled={blocoSaving}>{blocoSaving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══════ DIALOG: Unidade ═══════ */}
        <Dialog open={unidadeDialog} onOpenChange={setUnidadeDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingUnidade ? "Editar unidade" : "Nova unidade"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {showBlocoSelector && blocos.length > 1 && (
                <div><Label>Bloco</Label>
                  <Select value={uniForm.blocoId} onValueChange={v => setUniForm({ ...uniForm, blocoId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o bloco" /></SelectTrigger>
                    <SelectContent>{blocos.filter(b => b.ativo).map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Número</Label><Input value={uniForm.numero} onChange={e => setUniForm({ ...uniForm, numero: e.target.value })} placeholder="Ex: 101" /></div>
              <div><Label>Andar</Label><Input type="number" value={uniForm.andar} onChange={e => setUniForm({ ...uniForm, andar: e.target.value })} placeholder="Ex: 1" /></div>
              <div><Label>Tipo</Label>
                <Select value={uniForm.tipo} onValueChange={v => setUniForm({ ...uniForm, tipo: v as UnidadeTipo, tipoCustom: v !== "OUTRO" ? "" : uniForm.tipoCustom })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIT_TYPES.map(ut => <SelectItem key={ut.value} value={ut.value}>{ut.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {uniForm.tipo === "OUTRO" && <div><Label>Tipo personalizado *</Label><Input value={uniForm.tipoCustom} onChange={e => setUniForm({ ...uniForm, tipoCustom: e.target.value })} placeholder="Ex: Galpão" /></div>}
              <div><Label>Estado</Label>
                <Select value={uniForm.ocupacao} onValueChange={v => setUniForm({ ...uniForm, ocupacao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VAGO">Vago</SelectItem>
                    <SelectItem value="OCUPADO">Ocupado</SelectItem>
                    <SelectItem value="EM_REFORMA">Em reforma</SelectItem>
                    <SelectItem value="INTERDITADO">Interditado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUnidadeDialog(false)}>Cancelar</Button>
              <Button onClick={saveUnidade} disabled={uniSaving}>{uniSaving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══════ DIALOG: Geração em lote ═══════ */}
        <Dialog open={batchDialog} onOpenChange={v => { if (!v) resetBatch(); setBatchDialog(v); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto max-w-xl">
            <DialogHeader><DialogTitle>Gerar unidades em lote</DialogTitle></DialogHeader>

            {/* ── Step: Config ── */}
            {batchStep === "config" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Configure a estrutura e revise as unidades antes de criá-las.</p>

                {(showBlocoSelector && blocos.length > 1) ? (
                  <div><Label>Bloco</Label>
                    <Select value={batchBloco} onValueChange={setBatchBloco}>
                      <SelectTrigger><SelectValue placeholder="Selecione o bloco" /></SelectTrigger>
                      <SelectContent>{blocos.filter(b => b.ativo).map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tipo</Label>
                    <Select value={batchTipo} onValueChange={v => { setBatchTipo(v as UnidadeTipo); if (v !== "OUTRO") setBatchTipoCustom(""); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{UNIT_TYPES.map(ut => <SelectItem key={ut.value} value={ut.value}>{ut.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Estado</Label>
                    <Select value={batchOcupacao} onValueChange={setBatchOcupacao}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VAGO">Vago</SelectItem>
                        <SelectItem value="OCUPADO">Ocupado</SelectItem>
                        <SelectItem value="EM_REFORMA">Em reforma</SelectItem>
                        <SelectItem value="INTERDITADO">Interditado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {batchTipo === "OUTRO" && <div><Label>Tipo personalizado *</Label><Input value={batchTipoCustom} onChange={e => setBatchTipoCustom(e.target.value)} placeholder="Ex: Galpão" /></div>}

                <div className="flex gap-2">
                  {(["andar", "lista"] as const).map(m => (
                    <button key={m} onClick={() => setBatchMode(m)}
                      className={cn("px-3 py-1.5 text-xs rounded-full border transition-all",
                        batchMode === m ? "bg-white/15 border-white/30 text-white" : "border-white/10 text-white/60 hover:bg-white/5")}>
                      {m === "andar" ? "Por andar" : "Lista direta"}
                    </button>
                  ))}
                </div>

                {batchMode === "andar" ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label>Andar inicial</Label><Input type="number" value={andarIni} onChange={e => setAndarIni(parseInt(e.target.value) || 0)} /></div>
                      <div><Label>Andar final</Label><Input type="number" value={andarFim} onChange={e => setAndarFim(parseInt(e.target.value) || 0)} /></div>
                    </div>
                    <div><Label>Finais das unidades (um por linha)</Label>
                      <textarea className="w-full min-h-[80px] rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm" value={finais}
                        onChange={e => setFinais(e.target.value)} placeholder="01&#10;02&#10;03&#10;04" />
                    </div>
                  </>
                ) : (
                  <div><Label>Unidades (uma por linha)</Label>
                    <textarea className="w-full min-h-[100px] rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm" value={listaDireta}
                      onChange={e => setListaDireta(e.target.value)} placeholder="Casa 01&#10;Casa 02&#10;Casa 03" />
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => { resetBatch(); setBatchDialog(false); }}>Cancelar</Button>
                  <Button onClick={generatePreview}>Preview</Button>
                </DialogFooter>
              </div>
            )}

            {/* ── Step: Preview ── */}
            {batchStep === "preview" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {previewUnits.length} unidades serão geradas no bloco{" "}
                  {blocos.find(b => b.id === (batchBloco || uniBlocoFiltro))?.nome || "selecionado"}.
                  <br />Conflitos serão bloqueados. Revise antes de confirmar.
                </p>

                <div className="max-h-[300px] overflow-y-auto rounded-xl border border-white/10">
                  <Table>
                    <TableHeader><TableRow><TableHead>Unidade</TableHead><TableHead className="w-20">Andar</TableHead><TableHead className="w-28">Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {previewUnits.map((u, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{u.numero}</TableCell>
                          <TableCell>{u.andar ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={u.status === "NOVA" ? "default" : u.status === "CONFLITO" ? "destructive" : "secondary"}>
                              {u.status === "NOVA" ? "Nova" : u.status === "CONFLITO" ? "Já existe" : "Duplicado"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setBatchStep("config")}>Voltar</Button>
                  <Button onClick={executeBatch} disabled={batchLoading || previewUnits.every(u => u.status !== "NOVA")}>
                    {batchLoading ? "Criando..." : `Criar ${previewUnits.filter(u => u.status === "NOVA").length} unidades`}
                  </Button>
                </DialogFooter>
              </div>
            )}

            {/* ── Step: Result ── */}
            {batchStep === "result" && batchResult && (
              <div className="space-y-3 text-center">
                <p className="text-lg font-bold text-emerald-400">{batchResult.criadas} unidades criadas com sucesso!</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="tc-glass-card p-2"><p className="text-xl font-bold">{batchResult.criadas}</p><p className="text-xs text-muted-foreground">Criadas</p></div>
                  <div className="tc-glass-card p-2"><p className="text-xl font-bold">{batchResult.conflitos}</p><p className="text-xs text-muted-foreground">Conflitos</p></div>
                  <div className="tc-glass-card p-2"><p className="text-xl font-bold">{batchResult.erros}</p><p className="text-xs text-muted-foreground">Erros</p></div>
                </div>
                <DialogFooter>
                  <Button onClick={() => { resetBatch(); setBatchDialog(false); }}>Concluir</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ═══════ DIALOG: Importação ═══════ */}
        <Dialog open={importDialog} onOpenChange={v => { if (!v) resetImport(); setImportDialog(v); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto max-w-xl">
            <DialogHeader><DialogTitle>Importar blocos e unidades</DialogTitle></DialogHeader>

            {importStep === "upload" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Envie uma planilha CSV ou XLSX, revise os dados e confirme antes da importação.</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={downloadModel}>Baixar modelo</Button>
                </div>
                <div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center">
                  <input type="file" accept=".csv,.xlsx" className="hidden" id="importFile"
                    onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
                  <label htmlFor="importFile" className="cursor-pointer text-sm text-muted-foreground hover:text-white">
                    Clique para selecionar ou arraste um arquivo<br />
                    <span className="text-xs">CSV (.csv) ou Excel (.xlsx)</span>
                  </label>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setImportDialog(false)}>Cancelar</Button>
                </DialogFooter>
              </div>
            )}

            {importStep === "preview" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {importRows.length} linhas encontradas.
                  {importBlocosNovos.size > 0 && <><br />{importBlocosNovos.size} bloco(s) serão criados.</>}
                </p>
                <div className="max-h-[250px] overflow-y-auto rounded-xl border border-white/10">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="w-10">#</TableHead><TableHead>Bloco</TableHead><TableHead>Unidade</TableHead><TableHead>Tipo</TableHead><TableHead className="w-24">Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {importRows.map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{r.linha}</TableCell>
                          <TableCell>{r.blocoNome || "—"}{r.blocoNovo ? <Badge variant="outline" className="ml-1 text-[10px]">Novo</Badge> : null}</TableCell>
                          <TableCell className="font-medium">{r.numero}</TableCell>
                          <TableCell>{r.tipo || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === "VÁLIDA" ? "default" : "destructive"}>
                              {r.status === "VÁLIDA" ? "Válida" : r.errors?.[0] || r.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setImportStep("upload")}>Voltar</Button>
                  <Button onClick={executeImport} disabled={importLoading || importRows.every((r: any) => r.status !== "VÁLIDA")}>
                    {importLoading ? "Importando..." : `Importar ${importRows.filter((r: any) => r.status === "VÁLIDA").length} unidades`}
                  </Button>
                </DialogFooter>
              </div>
            )}

            {importStep === "result" && importResult && (
              <div className="space-y-3 text-center">
                <p className="text-lg font-bold text-emerald-400">{importResult.criadas} unidades importadas!</p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="tc-glass-card p-2"><p className="text-xl font-bold">{importResult.criadas}</p><p className="text-[10px] text-muted-foreground">Criadas</p></div>
                  <div className="tc-glass-card p-2"><p className="text-xl font-bold">{importResult.blocosNovos}</p><p className="text-[10px] text-muted-foreground">Blocos</p></div>
                  <div className="tc-glass-card p-2"><p className="text-xl font-bold">{importResult.conflitos}</p><p className="text-[10px] text-muted-foreground">Conflitos</p></div>
                  <div className="tc-glass-card p-2"><p className="text-xl font-bold">{importResult.erros}</p><p className="text-[10px] text-muted-foreground">Erros</p></div>
                </div>
                <DialogFooter>
                  <Button onClick={() => { resetImport(); setImportDialog(false); loadUnidades(); loadBlocos(); }}>Concluir</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
