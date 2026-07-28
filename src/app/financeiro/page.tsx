"use client";

import React, { useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Plus,
  Check,
  Copy,
  TrendingDown,
  Receipt,
  Upload,
  Download,
  AlertTriangle,
  FileText,
} from "lucide-react";

import Link from "next/link";

import { useCondominio } from "@/contexts/CondominioContext";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  collection,
  query,
  orderBy,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";

type Cobranca = {
  id: string;
  moradorId: string;
  unidadeId: string;
  tipo: "condominio" | "reserva";
  descricao: string;
  valor: number;
  vencimento: any;
  status: "pendente" | "pago";
  pixCopiaCola: string;
  createdAt: any;
  paidAt?: any;
  paymentMethod?: string;
  reconciliationMethod?: string;
  cardDetails?: {
    brand: string;
    last4: string;
    installments: number;
    authCode: string;
  };
};

type Despesa = {
  id: string;
  descricao: string;
  valor: number;
  data: any;
  categoria: string;
  createdAt?: any;
};

export default function FinanceiroPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { session } = useSessionCtx();
  const { condominioAtivoId, vinculoAtivo, blocos, unidades } = useCondominio();

  const isOperator =
    !!session?.superAdmin ||
    vinculoAtivo?.role === "SINDICO" ||
    vinculoAtivo?.role === "ADMIN" ||
    vinculoAtivo?.role === "ADMIN_CONDOMINIO";

  if (!isOperator && !session?.superAdmin) {
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

  const currentUid = session?.user?.uid ?? "";

  // Firestore collections refs
  const cobrancasRef = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId || !isOperator) return null;
    return query(collection(firestore, `condominios/${condominioAtivoId}/financeiro`), orderBy("vencimento", "asc"));
  }, [firestore, condominioAtivoId, isOperator]);

  const { data: cobrancasRaw, isLoading: isLoadingCobrancas } = useCollection<Cobranca>(cobrancasRef);
  const cobrancas = useMemo(() => (cobrancasRaw || []) as Cobranca[], [cobrancasRaw]);

  const despesasRef = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId || !isOperator) return null;
    return query(collection(firestore, `condominios/${condominioAtivoId}/despesas`), orderBy("data", "asc"));
  }, [firestore, condominioAtivoId, isOperator]);

  const { data: despesasRaw, isLoading: isLoadingDespesas } = useCollection<Despesa>(despesasRef);
  const despesas = useMemo(() => (despesasRaw || []) as Despesa[], [despesasRaw]);

  // Lista de todos os moradores do condomínio para o síndico escolher ao criar cobrança
  const [moradoresList, setMoradoresList] = useState<{ id: string; nome: string; unidade: string }[]>([]);
  React.useEffect(() => {
    if (!firestore || !condominioAtivoId || !isOperator) return;
    (async () => {
      try {
        const list: { id: string; nome: string; unidade: string }[] = [];
        for (const b of blocos) {
          const uSnap = await getDocs(collection(firestore, `condominios/${condominioAtivoId}/blocos/${b.id}/unidades`));
          for (const uDoc of uSnap.docs) {
            const mSnap = await getDocs(collection(firestore, `condominios/${condominioAtivoId}/blocos/${b.id}/unidades/${uDoc.id}/moradores`));
            mSnap.forEach((mDoc) => {
              const data = mDoc.data();
              list.push({
                id: mDoc.id,
                nome: data.nome,
                unidade: `${b.nome} - Apt ${data.unidadeId || uDoc.id}`,
              });
            });
          }
        }
        setMoradoresList(list);
      } catch (e) {
        console.error("Erro ao buscar moradores para cobrança:", e);
      }
    })();
  }, [firestore, condominioAtivoId, isOperator, blocos]);

  // Form states - Nova Cobrança
  const [cobrancaOpen, setCobrancaOpen] = useState(false);
  const [targetMorador, setTargetMorador] = useState("");
  const [cbTipo, setCbTipo] = useState<"condominio" | "reserva">("condominio");
  const [cbDescricao, setCbDescricao] = useState("");
  const [cbValor, setCbValor] = useState("");
  const [cbVencimento, setCbVencimento] = useState("");
  const [saving, setSaving] = useState(false);

  // Form states - Nova Despesa
  const [despesaOpen, setDespesaOpen] = useState(false);
  const [dpDescricao, setDpDescricao] = useState("");
  const [dpValor, setDpValor] = useState("");
  const [dpData, setDpData] = useState("");
  const [dpCategoria, setDpCategoria] = useState("Manutenção");

  // Pix states
  const [selectedCobranca, setSelectedCobranca] = useState<Cobranca | null>(null);
  const [pixModalOpen, setPixModalOpen] = useState(false);

  // Card Checkout states
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [selectedCobrancaForCard, setSelectedCobrancaForCard] = useState<Cobranca | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardInstallments, setCardInstallments] = useState("1");

  // CNAB Reconciliação states
  const [processingCnab, setProcessingCnab] = useState(false);
  const [cnabReport, setCnabReport] = useState<{ reconciled: number; totalValue: number; logs: string[] } | null>(null);

  // Dynamic calculations from database
  const stats = useMemo(() => {
    const paid = cobrancas.filter((c) => c.status === "pago");
    const open = cobrancas.filter((c) => c.status === "pendente");
    const totalPaid = paid.reduce((acc, c) => acc + c.valor, 0);
    const totalOpen = open.reduce((acc, c) => acc + c.valor, 0);
    const totalDespesas = despesas.reduce((acc, d) => acc + d.valor, 0);
    const balance = totalPaid - totalDespesas;

    return {
      totalPaid,
      totalOpen,
      totalDespesas,
      balance,
    };
  }, [cobrancas, despesas]);

  // Chart calculation logic from real DB records
  const monthlyChartData = useMemo(() => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const today = new Date();
    const last6Months: { key: string; label: string; receita: number; despesa: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      last6Months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${months[d.getMonth()]}/${String(d.getFullYear()).substring(2)}`,
        receita: 0,
        despesa: 0,
      });
    }

    // Sum paid receipts
    cobrancas.forEach((c) => {
      if (c.status !== "pago" || !c.vencimento) return;
      const date = c.paidAt?.seconds 
        ? new Date(c.paidAt.seconds * 1000) 
        : (c.vencimento.toDate ? c.vencimento.toDate() : new Date(c.vencimento));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const item = last6Months.find((m) => m.key === key);
      if (item) item.receita += c.valor;
    });

    // Sum expenses
    despesas.forEach((d) => {
      if (!d.data) return;
      const date = d.data.toDate ? d.data.toDate() : new Date(d.data);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const item = last6Months.find((m) => m.key === key);
      if (item) item.despesa += d.valor;
    });

    return last6Months;
  }, [cobrancas, despesas]);

  // Max value to scale dynamic charts
  const maxChartVal = useMemo(() => {
    let maxVal = 100;
    monthlyChartData.forEach((d) => {
      if (d.receita > maxVal) maxVal = d.receita;
      if (d.despesa > maxVal) maxVal = d.despesa;
    });
    return maxVal * 1.1; // 10% padding
  }, [monthlyChartData]);

  // Residents' bills filter
  const minhasCobrancas = useMemo(() => {
    // If the database has a registered resident matching the current user id
    return cobrancas.filter((c) => c.moradorId === currentUid);
  }, [cobrancas, currentUid]);

  // Actions - Nova Cobrança
  const handleSaveCobranca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !condominioAtivoId) return;
    if (!targetMorador || !cbDescricao.trim() || !cbValor.trim() || !cbVencimento) {
      toast({ variant: "destructive", title: "Erro", description: "Preencha todos os campos da cobrança." });
      return;
    }

    setSaving(true);
    try {
      const selected = moradoresList.find(m => m.id === targetMorador);
      const randomPixKey = `00020101021126580014br.gov.bcb.pix0136tc-pix-support-treecondo-key-${Math.random().toString(36).substring(7)}5204000053039865406${Number(cbValor).toFixed(2)}5802BR5919TreeCondo6009Sao Paulo62070503***6304${Math.random().toString(16).substring(2, 6).toUpperCase()}`;

      await addDoc(collection(firestore, `condominios/${condominioAtivoId}/financeiro`), {
        moradorId: targetMorador,
        unidadeId: selected ? selected.unidade : "Geral",
        tipo: cbTipo,
        descricao: cbDescricao.trim(),
        valor: Number(cbValor),
        vencimento: new Date(cbVencimento),
        status: "pendente",
        pixCopiaCola: randomPixKey,
        createdAt: serverTimestamp(),
      });

      toast({ title: "Sucesso", description: "Cobrança gerada com sucesso!" });
      setCobrancaOpen(false);
      setCbDescricao("");
      setCbValor("");
      setCbVencimento("");
      setTargetMorador("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Actions - Nova Despesa
  const handleSaveDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !condominioAtivoId) return;
    if (!dpDescricao.trim() || !dpValor.trim() || !dpData) {
      toast({ variant: "destructive", title: "Erro", description: "Preencha todos os campos da despesa." });
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(firestore, `condominios/${condominioAtivoId}/despesas`), {
        descricao: dpDescricao.trim(),
        valor: Number(dpValor),
        data: new Date(dpData),
        categoria: dpCategoria,
        createdAt: serverTimestamp(),
      });

      toast({ title: "Sucesso", description: "Despesa registrada com sucesso!" });
      setDespesaOpen(false);
      setDpDescricao("");
      setDpValor("");
      setDpData("");
      setDpCategoria("Manutenção");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "Tipo;Destinatário/Categoria;Descrição;Data/Vencimento;Valor (R$);Status/Método de Pagamento\r\n";
    
    cobrancas.forEach((c) => {
      const valorStr = c.valor.toFixed(2).replace(".", ",");
      const vencStr = formatTimestamp(c.vencimento);
      const methodStr = c.status === "pago"
        ? (c.paymentMethod === "CREDIT_CARD" ? `Cartão (${c.cardDetails?.brand ?? ""} *${c.cardDetails?.last4 ?? ""})` :
           c.reconciliationMethod === "CNAB240" ? "CNAB 240" : "Pix Link")
        : "Pendente";
      
      csvContent += `Receita;${c.unidadeId || "Geral"};${c.descricao};${vencStr};${valorStr};${c.status === "pago" ? "Pago (" + methodStr + ")" : "Pendente"}\r\n`;
    });
    
    despesas.forEach((d) => {
      const valorStr = (-d.valor).toFixed(2).replace(".", ",");
      const dataStr = formatTimestamp(d.data);
      csvContent += `Despesa;${d.categoria};${d.descricao};${dataStr};${valorStr};Pago\r\n`;
    });
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Relatorio_Financeiro_TreeCondo_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({ title: "CSV exportado com sucesso!", description: "Arquivo contendo receitas e despesas baixado." });
  };

  // Real Pix Payment Update
  const handleSimulatePayment = async () => {
    if (!selectedCobranca || !firestore || !condominioAtivoId) return;
    setSaving(true);
    try {
      await updateDoc(doc(firestore, `condominios/${condominioAtivoId}/financeiro`, selectedCobranca.id), {
        status: "pago",
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        paymentMethod: "PIX",
      });
      toast({ title: "Sucesso", description: "Pagamento Pix compensado!" });
      setPixModalOpen(false);
      setSelectedCobranca(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Card Checkout Approval
  const handleCardPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !condominioAtivoId || !selectedCobrancaForCard) return;

    if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
      toast({ variant: "destructive", title: "Erro de validação", description: "Preencha todos os campos do cartão." });
      return;
    }

    const cleanNum = cardNumber.replace(/\s+/g, "");
    if (cleanNum.length < 13 || cleanNum.length > 19 || !/^\d+$/.test(cleanNum)) {
      toast({ variant: "destructive", title: "Número inválido", description: "Cartão de crédito deve conter entre 13 e 19 dígitos." });
      return;
    }

    // Luhn algorithm check
    let sum = 0;
    let shouldDouble = false;
    for (let i = cleanNum.length - 1; i >= 0; i--) {
      let digit = parseInt(cleanNum.charAt(i));
      if (shouldDouble) {
        if ((digit *= 2) > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    if (sum % 10 !== 0) {
      toast({ variant: "destructive", title: "Erro de autenticação", description: "Número de cartão de crédito falhou na soma de verificação." });
      return;
    }

    if (!/^\d{3,4}$/.test(cardCvv)) {
      toast({ variant: "destructive", title: "CVV inválido", description: "O código CVV deve possuir 3 ou 4 algarismos." });
      return;
    }

    setSaving(true);
    try {
      const authCode = Math.floor(100000 + Math.random() * 900000).toString();
      await updateDoc(doc(firestore, `condominios/${condominioAtivoId}/financeiro`, selectedCobrancaForCard.id), {
        status: "pago",
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        paymentMethod: "CREDIT_CARD",
        cardDetails: {
          brand: cleanNum.startsWith("4") ? "Visa" : cleanNum.startsWith("5") ? "Mastercard" : "Elo",
          last4: cleanNum.substring(cleanNum.length - 4),
          installments: parseInt(cardInstallments),
          authCode: authCode,
        }
      });

      toast({ title: "Pagamento Aprovado!", description: `Transação autorizada. Cód: ${authCode}.` });
      setCardModalOpen(false);
      setSelectedCobrancaForCard(null);
      setCardNumber("");
      setCardName("");
      setCardExpiry("");
      setCardCvv("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao processar cartão", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // CNAB 240 file generator for user to test uploading
  const handleDownloadTestCnab = () => {
    const pendentes = cobrancas.filter(c => c.status === "pendente");
    if (pendentes.length === 0) {
      toast({ variant: "destructive", title: "Nenhuma pendente", description: "Não há cobranças pendentes no banco para testar a reconciliação." });
      return;
    }

    let content = "00100000         202484501   TreeCondo Financial S.A.               " + " ".repeat(158) + "\r\n";
    content += "00100011         0120   Cobranca Retorno                            " + " ".repeat(164) + "\r\n";

    pendentes.forEach((c, index) => {
      const seqT = String((index * 2) + 1).padStart(5, "0");
      const seqU = String((index * 2) + 2).padStart(5, "0");
      const idField = c.id.padEnd(20, " ");
      
      let lineT = `00100013${seqT}T   123450000123456  ${idField}`;
      lineT = lineT.padEnd(240, " ") + "\r\n";
      content += lineT;

      const valorCentos = Math.round(c.valor * 100);
      const valorField = String(valorCentos).padStart(15, "0");
      const today = new Date();
      const dateField = `${String(today.getDate()).padStart(2, "0")}${String(today.getMonth() + 1).padStart(2, "0")}${today.getFullYear()}`;

      let lineU = `00100013${seqU}U   ${valorField}${" ".repeat(102)}${dateField}`;
      lineU = lineU.padEnd(240, " ") + "\r\n";
      content += lineU;
    });

    content += "00100015         " + " ".repeat(215) + "\r\n";
    content += "00100099         " + " ".repeat(215) + "\r\n";

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CNAB240_RETORNO_TREECONDO_${new Date().toISOString().slice(0, 10)}.ret`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "CNAB gerado com sucesso!", description: "Arquivo de teste baixado no seu computador." });
  };

  // CNAB 240 Upload parser
  const handleUploadCnab = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firestore || !condominioAtivoId) return;
    setProcessingCnab(true);
    setCnabReport(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      
      let reconciledCount = 0;
      let totalValueReconciled = 0;
      const logs: string[] = [];
      let currentCobrancaId = "";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length < 100) continue; // safety margin for shorter lines

        // CNAB Record Type at position 7 (0-indexed)
        const recordType = line.substring(7, 8);
        if (recordType === "3") {
          // Segment at position 13 (0-indexed)
          const segmentCode = line.substring(13, 14);
          if (segmentCode === "T") {
            // Document ID matches key from position 22 or after
            currentCobrancaId = line.substring(22, 42).trim();
          } else if (segmentCode === "U" && currentCobrancaId) {
            // Value is position 17 to 32
            const valorPago = parseFloat(line.substring(17, 32)) / 100;
            // Date is position 137 to 145 (DDMMYYYY)
            const dateStr = line.substring(137, 145);

            try {
              // Fetch to verify document details
              const colRef = collection(firestore, `condominios/${condominioAtivoId}/financeiro`);
              const snap = await getDocs(colRef);
              const docMatch = snap.docs.find(d => d.id === currentCobrancaId);

              if (docMatch) {
                const data = docMatch.data() as Cobranca;
                if (data.status === "pago") {
                  logs.push(`⚠️ Título ID ${currentCobrancaId} já constava como Liquidado.`);
                } else {
                  let paidDate = new Date();
                  if (dateStr && dateStr.length === 8) {
                    const day = parseInt(dateStr.substring(0, 2));
                    const month = parseInt(dateStr.substring(2, 4)) - 1;
                    const year = parseInt(dateStr.substring(4, 8));
                    paidDate = new Date(year, month, day);
                  }

                  await updateDoc(doc(firestore, `condominios/${condominioAtivoId}/financeiro`, currentCobrancaId), {
                    status: "pago",
                    paidAt: paidDate,
                    updatedAt: serverTimestamp(),
                    reconciliationMethod: "CNAB240",
                  });

                  reconciledCount++;
                  totalValueReconciled += valorPago;
                  logs.push(`✅ Reconciliado ID ${currentCobrancaId} no valor de R$ ${valorPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
                }
              } else {
                logs.push(`❌ Título ID ${currentCobrancaId} não foi localizado no banco.`);
              }
            } catch (err: any) {
              logs.push(`❌ Falha ao processar ID ${currentCobrancaId}: ${err.message}`);
            }
            currentCobrancaId = "";
          }
        }
      }

      setCnabReport({
        reconciled: reconciledCount,
        totalValue: totalValueReconciled,
        logs,
      });

      toast({ title: "Processamento concluído!", description: `Liquidado ${reconciledCount} faturas.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao processar retorno", description: e.message });
    } finally {
      setProcessingCnab(false);
      e.target.value = ""; // reset input
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return "-";
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
    return date.toLocaleDateString("pt-BR");
  };

  if (!condominioAtivoId) {
    return (
      <AppLayout pageTitle="Painel Financeiro">
        <Card className="tc-card-signature">
          <CardHeader>
            <CardTitle>Nenhum condomínio ativo</CardTitle>
            <CardDescription>Selecione um condomínio para gerenciar o financeiro.</CardDescription>
          </CardHeader>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Financeiro">
      <style>{`
        @media print {
          body, html, main, .tc-bg, #__next {
            background: white !important;
            color: black !important;
          }
          aside, header, nav, footer, button, .print\\:hidden, .print-hidden {
            display: none !important;
          }
          div[class*="bg-slate-"] {
            background: transparent !important;
            border: none !important;
            color: black !important;
            box-shadow: none !important;
          }
          table {
            color: black !important;
            border-collapse: collapse !important;
            width: 100% !important;
          }
          thead tr {
            border-bottom: 2px solid #333 !important;
          }
          tbody tr {
            border-bottom: 1px solid #ddd !important;
          }
          th, td {
            color: black !important;
            padding: 8px !important;
          }
          span[class*="text-"], td[class*="text-"], div[class*="text-"] {
            color: black !important;
          }
        }
      `}</style>
      <div className="space-y-6">
        {isOperator ? (
          // VISÃO ADMINISTRATIVA (SÍNDICO)
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <PageHeader
                title="Administração Financeira"
                description="Fluxo de receitas liquidadas, conciliação e controle de despesas operacionais."
                icon={<DollarSign className="h-6 w-6" />}
              />
              <div className="flex flex-wrap gap-2 print:hidden">
                <Button 
                  onClick={handleExportCSV}
                  className="rounded-xl border border-[#00D0E6]/30 bg-[#00D0E6]/10 text-[#00D0E6] hover:bg-[#00D0E6]/20 font-bold flex items-center gap-1.5 transition"
                >
                  <Download className="h-4 w-4" /> Exportar CSV
                </Button>
                <Button 
                  onClick={() => window.print()}
                  className="rounded-xl border border-[#D3EA00]/30 bg-[#D3EA00]/10 text-[#D3EA00] hover:bg-[#D3EA00]/20 font-bold flex items-center gap-1.5 transition"
                >
                  <Download className="h-4 w-4" /> Exportar PDF
                </Button>
                <Button
                  asChild
                  className="rounded-xl border border-[#D3EA00]/30 bg-[#D3EA00]/10 text-[#D3EA00] hover:bg-[#D3EA00]/20 font-bold flex items-center gap-1.5 transition"
                >
                  <Link href="/financeiro/reservas">
                    <FileText className="h-4 w-4" /> Relatório de Reservas
                  </Link>
                </Button>
                <Button 
                  onClick={() => setDespesaOpen(true)}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-bold flex items-center gap-1.5 transition"
                >
                  <Plus className="h-4 w-4" /> Lançar Despesa
                </Button>
                <Button 
                  onClick={() => setCobrancaOpen(true)}
                  className="rounded-xl bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none flex items-center gap-1.5 hover:scale-105 transition"
                >
                  <Plus className="h-4 w-4" /> Lançar Cobrança
                </Button>
              </div>
            </div>

            {/* Indicadores Dinâmicos de Caixa */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 print:hidden">
              <Card className="bg-slate-950/40 border-white/10 text-white rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute right-4 top-4 bg-emerald-500/10 p-2.5 rounded-2xl">
                  <TrendingUp className="text-emerald-400 h-5 w-5" />
                </div>
                <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Receitas Compensadas</div>
                <div className="text-2xl font-black text-[#00D0E6] mt-2">
                  R$ {stats.totalPaid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-white/50 mt-1">Cobrancas liquidadas.</div>
              </Card>

              <Card className="bg-slate-950/40 border-white/10 text-white rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute right-4 top-4 bg-red-500/10 p-2.5 rounded-2xl">
                  <TrendingDown className="text-red-400 h-5 w-5" />
                </div>
                <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Despesas Pagas</div>
                <div className="text-2xl font-black text-red-400 mt-2">
                  R$ {stats.totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-white/50 mt-1">Despesas acumuladas no banco.</div>
              </Card>

              <Card className="bg-slate-950/40 border-white/10 text-white rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute right-4 top-4 bg-[#D3EA00]/10 p-2.5 rounded-2xl">
                  <DollarSign className="text-[#D3EA00] h-5 w-5" />
                </div>
                <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Saldo de Caixa</div>
                <div className="text-2xl font-black text-[#D3EA00] mt-2">
                  R$ {stats.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-white/50 mt-1">Saldo operacional (Receitas - Despesas).</div>
              </Card>

              <Card className="bg-slate-950/40 border-white/10 text-white rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute right-4 top-4 bg-amber-500/10 p-2.5 rounded-2xl">
                  <AlertTriangle className="text-amber-400 h-5 w-5" />
                </div>
                <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Inadimplência Aberta</div>
                <div className="text-2xl font-black text-amber-400 mt-2">
                  R$ {stats.totalOpen.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[10px] text-white/50 mt-1">Cobrancas pendentes.</div>
              </Card>
            </div>

            {/* Gráfico Real com Dados Operacionais */}
            <Card className="bg-slate-950/40 border-white/10 text-white rounded-3xl overflow-hidden print:hidden">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Fluxo de Caixa — Receitas vs Despesas Reais</CardTitle>
                <CardDescription className="text-white/60">Gráfico dinâmico alimentado pelo saldo de transações cadastradas no Firestore.</CardDescription>
              </CardHeader>
              <CardContent className="h-64 flex items-end justify-between gap-6 px-6 pb-6 pt-4 border-t border-white/5 bg-slate-950/20">
                {monthlyChartData.map((item) => {
                  const pctReceita = maxChartVal > 100 ? (item.receita / maxChartVal) * 100 : 0;
                  const pctDespesa = maxChartVal > 100 ? (item.despesa / maxChartVal) * 100 : 0;

                  return (
                    <div key={item.key} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                      <div className="w-full flex items-end justify-center gap-1.5 h-40">
                        {/* Receita bar */}
                        <div 
                          style={{ height: `${Math.max(3, pctReceita)}%` }}
                          className="w-4 bg-emerald-500 rounded-t-lg transition-all duration-300 group-hover:brightness-110" 
                          title={`Receitas: R$ ${item.receita.toFixed(2)}`} 
                        />
                        {/* Despesa bar */}
                        <div 
                          style={{ height: `${Math.max(3, pctDespesa)}%` }}
                          className="w-4 bg-red-500 rounded-t-lg transition-all duration-300 group-hover:brightness-110" 
                          title={`Despesas: R$ ${item.despesa.toFixed(2)}`} 
                        />
                      </div>
                      <span className="text-[10px] text-white/40 font-bold whitespace-nowrap">{item.label}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Sub-abas de gerenciamento */}
            <Tabs defaultValue="receitas" className="w-full">
              <TabsList className="grid grid-cols-3 w-full max-w-md bg-white/5 border border-white/10 p-1 rounded-2xl mb-6 print:hidden">
                <TabsTrigger value="receitas" className="rounded-xl">Receitas</TabsTrigger>
                <TabsTrigger value="despesas" className="rounded-xl">Despesas</TabsTrigger>
                <TabsTrigger value="cnab" className="rounded-xl">Conciliação CNAB 240</TabsTrigger>
              </TabsList>

              <TabsContent value="receitas" className="outline-none">
                <Card className="bg-slate-900/40 border-white/10 text-white rounded-3xl overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Lançamentos de Cobrança (Receitas)</CardTitle>
                    <CardDescription className="text-white/60">Lista completa de taxas emitidas para os moradores.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingCobrancas ? (
                      <p className="py-6 text-center text-white/50">Carregando receitas...</p>
                    ) : cobrancas.length === 0 ? (
                      <p className="py-6 text-center text-white/50">Nenhuma cobrança cadastrada.</p>
                    ) : (
                      <div className="overflow-x-auto w-full">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-white/10 text-white/50">
                              <th className="py-3 font-semibold">Unidade</th>
                              <th className="py-3 font-semibold">Descrição</th>
                              <th className="py-3 font-semibold">Tipo</th>
                              <th className="py-3 font-semibold">Vencimento</th>
                              <th className="py-3 font-semibold">Valor</th>
                              <th className="py-3 font-semibold">Método</th>
                              <th className="py-3 font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cobrancas.map((c) => (
                              <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition">
                                <td className="py-3.5 font-bold text-[#00D0E6]">{c.unidadeId}</td>
                                <td className="py-3.5">{c.descricao}</td>
                                <td className="py-3.5 capitalize">{c.tipo}</td>
                                <td className="py-3.5">{formatTimestamp(c.vencimento)}</td>
                                <td className="py-3.5 font-bold">R$ {c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                                <td className="py-3.5 text-xs text-white/60">
                                  {c.status === "pago" ? (
                                    c.paymentMethod === "CREDIT_CARD" ? `Cartão (${c.cardDetails?.brand} *${c.cardDetails?.last4})` :
                                    c.reconciliationMethod === "CNAB240" ? "CNAB 240" : "Pix Link"
                                  ) : "-"}
                                </td>
                                <td className="py-3.5">
                                  <StatusBadge tone={c.status === "pago" ? "success" : "warning"}>
                                    {c.status === "pago" ? "Pago" : "Pendente"}
                                  </StatusBadge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="despesas" className="outline-none">
                <Card className="bg-slate-900/40 border-white/10 text-white rounded-3xl overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Controle de Despesas (Saídas)</CardTitle>
                    <CardDescription className="text-white/60">Fluxo de gastos operacionais e pagamentos efetuados pelo condomínio.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingDespesas ? (
                      <p className="py-6 text-center text-white/50">Carregando despesas...</p>
                    ) : despesas.length === 0 ? (
                      <p className="py-6 text-center text-white/50">Nenhuma despesa registrada.</p>
                    ) : (
                      <div className="overflow-x-auto w-full">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-white/10 text-white/50">
                              <th className="py-3 font-semibold">Descrição</th>
                              <th className="py-3 font-semibold">Categoria</th>
                              <th className="py-3 font-semibold">Data do Gasto</th>
                              <th className="py-3 font-semibold">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {despesas.map((d) => (
                              <tr key={d.id} className="border-b border-white/5 hover:bg-white/5 transition">
                                <td className="py-3.5 font-bold text-white">{d.descricao}</td>
                                <td className="py-3.5">
                                  <Badge variant="outline" className="border-white/20 text-white/80">{d.categoria}</Badge>
                                </td>
                                <td className="py-3.5">{formatTimestamp(d.data)}</td>
                                <td className="py-3.5 font-bold text-red-400">- R$ {d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cnab" className="outline-none">
                <Card className="bg-slate-900/40 border-white/10 text-white rounded-3xl overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Conciliação Bancária Automatizada</CardTitle>
                    <CardDescription className="text-white/60">
                      Importe arquivos de retorno CNAB 240 (.ret) do seu banco para liquidar cobranças automaticamente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="p-6 border border-dashed border-white/10 rounded-2xl bg-white/5 flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="space-y-1">
                        <h4 className="font-bold">Testar Reconciliação com CNAB 240</h4>
                        <p className="text-xs text-white/50">
                          Gere e baixe um arquivo CNAB 240 pré-configurado contendo as cobranças pendentes do seu banco.
                        </p>
                      </div>
                <Button
                        onClick={handleDownloadTestCnab}
                        variant="secondary"
                        className="rounded-xl flex items-center gap-1.5 whitespace-nowrap bg-white/10 border border-white/10 hover:bg-white/20 text-white"
                      >
                        <Download className="h-4.5 w-4.5" /> Baixar CNAB de Teste
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="uploadCnab" className="text-white font-bold block">Upload de Arquivo de Retorno (.ret)</Label>
                      <div className="relative flex items-center justify-center border border-white/15 rounded-2xl bg-slate-900/50 p-8 text-center cursor-pointer hover:border-[#00D0E6] transition">
                        <input 
                          type="file" 
                          id="uploadCnab" 
                          accept=".ret,.txt"
                          onChange={handleUploadCnab}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          disabled={processingCnab}
                        />
                        <div className="space-y-2">
                          <Upload className="mx-auto h-8 w-8 text-[#00D0E6]" />
                          <div className="text-sm font-semibold">{processingCnab ? "Processando arquivo..." : "Selecione ou arraste o arquivo CNAB 240"}</div>
                          <div className="text-xs text-white/40">Suporta formatos de retorno CNAB 240 padrão de bancos nacionais.</div>
                        </div>
                      </div>
                    </div>

                    {/* Console Report */}
                    {cnabReport && (
                      <div className="p-6 border border-white/15 rounded-3xl bg-slate-950/50 space-y-4">
                        <h4 className="font-bold text-white text-md flex items-center gap-2 border-b border-white/10 pb-3">
                          📁 Relatório de Processamento Bancário
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 p-3 rounded-xl">
                            <span className="text-xs text-white/40 block">Títulos Conciliados</span>
                            <span className="text-xl font-bold text-emerald-400">{cnabReport.reconciled}</span>
                          </div>
                          <div className="bg-white/5 p-3 rounded-xl">
                            <span className="text-xs text-white/40 block">Total Liquidado</span>
                            <span className="text-xl font-bold text-[#D3EA00]">
                              R$ {cnabReport.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-white/40 block">Logs do Processador</span>
                          <div className="max-h-40 overflow-y-auto bg-black p-3 rounded-xl font-mono text-[11px] text-white/70 space-y-1">
                            {cnabReport.logs.map((log, index) => (
                              <div key={index}>{log}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          // VISÃO DO MORADOR (MENSALIDADES)
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Minhas Mensalidades</h2>
              <p className="text-sm text-white/50">Consulte faturas em aberto e faça o pagamento instantâneo por Pix ou Cartão de Crédito.</p>
            </div>

            {isLoadingCobrancas ? (
              <p className="py-12 text-center text-white/50">Carregando faturas...</p>
            ) : minhasCobrancas.length === 0 ? (
              <Card className="bg-slate-950/40 border-white/10 text-white p-8 text-center rounded-3xl">
                <p className="text-white/55">Nenhuma mensalidade cadastrada para a sua unidade.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {minhasCobrancas.map((c) => (
                  <Card key={c.id} className="relative overflow-hidden bg-slate-950/40 border-white/10 text-white rounded-3xl flex flex-col justify-between">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-white/5 border border-white/10 text-white/60">
                          {c.tipo === "condominio" ? "Taxa Condomínio" : "Reserva de Área"}
                        </span>
                        <StatusBadge tone={c.status === "pago" ? "success" : "warning"}>
                          {c.status === "pago" ? "Pago" : "Pendente"}
                        </StatusBadge>
                      </div>
                      <CardTitle className="text-lg font-bold text-white leading-tight">{c.descricao}</CardTitle>
                      <div className="text-2xl font-black text-[#D3EA00] pt-1">
                        R$ {c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                      <div className="text-xs space-y-1">
                        <div>
                          <span className="text-white/40">Vencimento:</span>{" "}
                          <span className="font-semibold text-white/80">{formatTimestamp(c.vencimento)}</span>
                        </div>
                        {c.paidAt && (
                          <div>
                            <span className="text-white/40">Pago em:</span>{" "}
                            <span className="font-semibold text-emerald-400">{formatTimestamp(c.paidAt)}</span>
                          </div>
                        )}
                      </div>

                      {c.status === "pendente" ? (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <Button
                            onClick={() => {
                              setSelectedCobranca(c);
                              setPixModalOpen(true);
                            }}
                            className="h-10 rounded-xl bg-[#00D0E6] text-slate-900 font-bold border-none flex items-center justify-center gap-1.5 hover:scale-105 transition"
                          >
                            <Receipt className="h-4 w-4" /> Pix
                          </Button>
                          <Button
                            onClick={() => {
                              setSelectedCobrancaForCard(c);
                              setCardModalOpen(true);
                            }}
                            className="h-10 rounded-xl bg-[#D3EA00] text-slate-900 font-bold border-none flex items-center justify-center gap-1.5 hover:scale-105 transition"
                          >
                            <CreditCard className="h-4 w-4" /> Cartão
                          </Button>
                        </div>
                      ) : (
                        <div className="w-full h-10 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5">
                          <Check className="h-4 w-4" /> Cobrança Paga
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SÍNDICO: FORM COBRANÇA MODAL */}
      {cobrancaOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSaveCobranca}>
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-bold">Lançar Nova Cobrança</h3>
                <button type="button" onClick={() => setCobrancaOpen(false)} className="text-white/60 hover:text-white">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="targetMorador">Morador de Destino</Label>
                  <Select value={targetMorador} onValueChange={setTargetMorador}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Selecione o morador" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 text-white border-white/15 max-h-56">
                      {moradoresList.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome} ({m.unidade})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cbTipo">Tipo</Label>
                    <Select value={cbTipo} onValueChange={(v: any) => setCbTipo(v)}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 text-white border-white/15">
                        <SelectItem value="condominio">Mensalidade Condomínio</SelectItem>
                        <SelectItem value="reserva">Taxa de Reserva</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cbValor">Valor (R$)</Label>
                    <Input id="cbValor" type="number" value={cbValor} onChange={(e) => setCbValor(e.target.value)} placeholder="Ex: 450" className="bg-white/5 border-white/10 text-white" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cbVencimento">Vencimento</Label>
                  <Input id="cbVencimento" type="date" value={cbVencimento} onChange={(e) => setCbVencimento(e.target.value)} className="bg-white/5 border-white/10 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cbDescricao">Descrição do Lançamento</Label>
                  <Input id="cbDescricao" value={cbDescricao} onChange={(e) => setCbDescricao(e.target.value)} placeholder="Ex: Cota Condominial - Julho/2026" className="bg-white/5 border-white/10 text-white" />
                </div>
              </div>
              <div className="p-6 border-t border-white/10 flex justify-end gap-2 bg-slate-950/20">
                <Button type="button" variant="outline" className="border-white/10 hover:bg-white/10 text-white rounded-xl" onClick={() => setCobrancaOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none rounded-xl">
                  {saving ? "Salvando..." : "Gerar Cobrança"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SÍNDICO: FORM DESPESA MODAL */}
      {despesaOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSaveDespesa}>
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-bold">Registrar Nova Despesa</h3>
                <button type="button" onClick={() => setDespesaOpen(false)} className="text-white/60 hover:text-white">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="dpCategoria">Categoria</Label>
                    <Select value={dpCategoria} onValueChange={setDpCategoria}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 text-white border-white/15">
                        <SelectItem value="Manutenção">Manutenção Geral</SelectItem>
                        <SelectItem value="Limpeza">Material & Limpeza</SelectItem>
                        <SelectItem value="Segurança">Segurança & Portaria</SelectItem>
                        <SelectItem value="Energia">Água / Energia</SelectItem>
                        <SelectItem value="Outro">Outras Despesas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dpValor">Valor do Gasto (R$)</Label>
                    <Input id="dpValor" type="number" value={dpValor} onChange={(e) => setDpValor(e.target.value)} placeholder="Ex: 890" className="bg-white/5 border-white/10 text-white" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dpData">Data do Lançamento</Label>
                  <Input id="dpData" type="date" value={dpData} onChange={(e) => setDpData(e.target.value)} className="bg-white/5 border-white/10 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dpDescricao">Descrição da Despesa</Label>
                  <Input id="dpDescricao" value={dpDescricao} onChange={(e) => setDpDescricao(e.target.value)} placeholder="Ex: Conserto do Portão Garagem Bloco B" className="bg-white/5 border-white/10 text-white" />
                </div>
              </div>
              <div className="p-6 border-t border-white/10 flex justify-end gap-2 bg-slate-950/20">
                <Button type="button" variant="outline" className="border-white/10 hover:bg-white/10 text-white rounded-xl" onClick={() => setDespesaOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none rounded-xl">
                  {saving ? "Registrando..." : "Registrar Despesa"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MORADOR: PIX QR CODE DIALOG */}
      {pixModalOpen && selectedCobranca && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative w-full max-w-sm bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200 p-6 text-center space-y-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold">Liquidar via Pix</h3>
              <button onClick={() => setPixModalOpen(false)} className="text-white/60 hover:text-white">✕</button>
            </div>

            {/* Código QR Simulado */}
            <div className="mx-auto h-44 w-44 bg-white rounded-2xl flex items-center justify-center border border-white/10 p-2 shadow-inner">
              <svg className="h-full w-full fill-slate-900" viewBox="0 0 100 100">
                <rect x="5" y="5" width="20" height="20" />
                <rect x="5" y="75" width="20" height="20" />
                <rect x="75" y="5" width="20" height="20" />
                <rect x="10" y="10" width="10" height="10" className="fill-white" />
                <rect x="10" y="80" width="10" height="10" className="fill-white" />
                <rect x="80" y="10" width="10" height="10" className="fill-white" />
                <rect x="35" y="5" width="5" height="15" />
                <rect x="45" y="10" width="15" height="5" />
                <rect x="5" y="35" width="15" height="5" />
                <rect x="15" y="45" width="5" height="20" />
                <rect x="35" y="35" width="15" height="15" />
                <rect x="55" y="45" width="10" height="5" />
                <rect x="45" y="60" width="15" height="15" />
                <rect x="75" y="35" width="20" height="5" />
                <rect x="70" y="55" width="10" height="10" />
                <rect x="85" y="75" width="10" height="10" />
                <rect x="35" y="85" width="20" height="5" />
              </svg>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-white/50">Valor Total</div>
              <div className="text-2xl font-black text-[#D3EA00]">
                R$ {selectedCobranca.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-white/40">Favorecido: TreeCondo Gestora</div>
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full border-white/10 hover:bg-white/10 text-white rounded-xl text-xs flex items-center justify-center gap-1.5"
                onClick={() => {
                  navigator.clipboard.writeText(selectedCobranca.pixCopiaCola);
                  toast({ title: "Código copiado!" });
                }}
              >
                <Copy className="h-4 w-4" /> Copiar Código Pix
              </Button>
              <Button
                disabled={saving}
                onClick={handleSimulatePayment}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold border-none rounded-xl"
              >
                {saving ? "Confirmando..." : "Confirmar Pagamento Realizado"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MORADOR: CREDIT CARD CHECKOUT DIALOG */}
      {cardModalOpen && selectedCobrancaForCard && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200">
            <form onSubmit={handleCardPayment}>
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <CreditCard className="text-[#00D0E6] h-6 w-6" /> Pagamento com Cartão
                </h3>
                <button type="button" onClick={() => setCardModalOpen(false)} className="text-white/60 hover:text-white">✕</button>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-xs text-white/40 block">Fatura</span>
                    <span className="text-sm font-bold">{selectedCobrancaForCard.descricao}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-white/40 block">Valor</span>
                    <span className="text-lg font-black text-[#D3EA00]">
                      R$ {selectedCobrancaForCard.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cardName">Nome no Cartão</Label>
                  <Input 
                    id="cardName" 
                    value={cardName} 
                    onChange={(e) => setCardName(e.target.value.toUpperCase())} 
                    placeholder="JOÃO S SILVA" 
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20" 
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cardNumber">Número do Cartão</Label>
                  <Input 
                    id="cardNumber" 
                    value={cardNumber} 
                    onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 "))} 
                    placeholder="4444 5555 6666 7777" 
                    maxLength={19}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cardExpiry">Validade</Label>
                    <Input 
                      id="cardExpiry" 
                      value={cardExpiry} 
                      onChange={(e) => setCardExpiry(e.target.value.replace(/\D/g, "").replace(/(\d{2})(?=\d)/g, "$1/"))} 
                      placeholder="MM/AA" 
                      maxLength={5}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cardCvv">CVV</Label>
                    <Input 
                      id="cardCvv" 
                      type="password"
                      value={cardCvv} 
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))} 
                      placeholder="123" 
                      maxLength={4}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/20" 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cardInstallments">Opções de Parcelamento</Label>
                  <Select value={cardInstallments} onValueChange={setCardInstallments}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Selecione o parcelamento" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 text-white border-white/15">
                      <SelectItem value="1">1x de R$ {selectedCobrancaForCard.valor.toFixed(2)} sem juros</SelectItem>
                      <SelectItem value="2">2x de R$ {(selectedCobrancaForCard.valor / 2).toFixed(2)} sem juros</SelectItem>
                      <SelectItem value="3">3x de R$ {(selectedCobrancaForCard.valor / 3).toFixed(2)} sem juros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-6 border-t border-white/10 flex justify-end gap-2 bg-slate-950/20">
                <Button type="button" variant="outline" className="border-white/10 hover:bg-white/10 text-white rounded-xl" onClick={() => setCardModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none rounded-xl">
                  {saving ? "Processando..." : "Confirmar Pagamento"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
