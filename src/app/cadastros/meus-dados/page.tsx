"use client";

import React, { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
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
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Car, PawPrint, Plus, Trash2, Edit, FileText, Bell, Droplet, Flame, ShieldCheck, Palette } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useCondominio } from "@/contexts/CondominioContext";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Pet = {
  id: string;
  nome: string;
  especie: string;
  raca?: string;
  porte?: string;
  observacoes?: string;
};

type Veiculo = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  cor: string;
  vaga?: string;
};

export default function MeusDadosPage() {
  const { theme, setTheme } = useTheme();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { session } = useSessionCtx();
  const {
    condominioAtivoId,
    vinculoAtivo,
    blocoAtivoId,
    unidadeAtivaId,
    blocos,
    unidades,
    isLoadingBlocos,
    isLoadingUnidades,
  } = useCondominio();

  const isOperator =
    !!session?.superAdmin ||
    vinculoAtivo?.role === "SINDICO" ||
    vinculoAtivo?.role === "ADMIN" ||
    vinculoAtivo?.role === "ADMIN_CONDOMINIO";

  const targetBlocoId = isOperator ? blocoAtivoId : (vinculoAtivo?.blocoId ?? null);
  const targetUnidadeId = isOperator ? unidadeAtivaId : (vinculoAtivo?.unidadeId ?? null);

  const blocosMap = useMemo(() => new Map(blocos.map((b) => [b.id, b.nome])), [blocos]);
  const unidadesMap = useMemo(() => new Map(unidades.map((u) => [u.id, u.numero])), [unidades]);

  const blocoNome = targetBlocoId ? blocosMap.get(targetBlocoId) ?? targetBlocoId : "-";
  const unidadeNumero = targetUnidadeId ? unidadesMap.get(targetUnidadeId) ?? targetUnidadeId : "-";

  // Firestore Refs
  const veiculosRef = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId || !targetBlocoId || !targetUnidadeId) return null;
    return query(
      collection(firestore, `condominios/${condominioAtivoId}/blocos/${targetBlocoId}/unidades/${targetUnidadeId}/veiculos`),
      orderBy("placa")
    );
  }, [firestore, condominioAtivoId, targetBlocoId, targetUnidadeId]);

  const { data: veiculosRaw, isLoading: isLoadingVeiculos } = useCollection<Veiculo>(veiculosRef);
  const veiculos = useMemo(() => (veiculosRaw || []) as Veiculo[], [veiculosRaw]);

  const petsRef = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId || !targetBlocoId || !targetUnidadeId) return null;
    return query(
      collection(firestore, `condominios/${condominioAtivoId}/blocos/${targetBlocoId}/unidades/${targetUnidadeId}/pets`),
      orderBy("nome")
    );
  }, [firestore, condominioAtivoId, targetBlocoId, targetUnidadeId]);

  const { data: petsRaw, isLoading: isLoadingPets } = useCollection<Pet>(petsRef);
  const pets = useMemo(() => (petsRaw || []) as Pet[], [petsRaw]);

  // States para Formulários
  const [petModalOpen, setPetModalOpen] = useState(false);
  const [veiculoModalOpen, setVeiculoModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form Fields - Pet
  const [petId, setPetId] = useState<string | null>(null);
  const [petNome, setPetNome] = useState("");
  const [petEspecie, setPetEspecie] = useState("Cão");
  const [petRaca, setPetRaca] = useState("");
  const [petPorte, setPetPorte] = useState("Médio");
  const [petObs, setPetObs] = useState("");

  // Form Fields - Veículo
  const [veiculoId, setVeiculoId] = useState<string | null>(null);
  const [vPlaca, setVPlaca] = useState("");
  const [vMarca, setVMarca] = useState("");
  const [vModelo, setVModelo] = useState("");
  const [vCor, setVCor] = useState("");
  const [vVaga, setVVaga] = useState("");

  // Form Fields - Procurações
  const [procuracoes, setProcuracoes] = useState<any[]>([]);
  const [isLoadingProcuracoes, setIsLoadingProcuracoes] = useState(false);
  const [procModalOpen, setProcModalOpen] = useState(false);
  const [procOutorgadoNome, setProcOutorgadoNome] = useState("");
  const [procOutorgadoUnidade, setProcOutorgadoUnidade] = useState("");
  const [procExpiresAt, setProcExpiresAt] = useState("");

  // Push Notification States
  const [pushEnabled, setPushEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>("default");

  React.useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
      setPushEnabled(Notification.permission === "granted");
    }
  }, []);

  const handleTogglePush = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast({ variant: "destructive", title: "Não suportado", description: "Notificações não são suportadas neste navegador." });
      return;
    }

    if (Notification.permission === "denied") {
      toast({
        variant: "destructive",
        title: "Permissão Negada",
        description: "Você bloqueou as notificações. Ative-as nas configurações do seu navegador."
      });
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      setPushEnabled(true);
      toast({ title: "Notificações Ativadas! 🔔", description: "Você começará a receber atualizações em tempo real." });
    } else {
      setPushEnabled(false);
    }
  };

  const handleSimulatePush = (type: "PORTARIA" | "FINANCEIRO") => {
    if (notificationPermission !== "granted") {
      toast({ variant: "destructive", title: "Permissão necessária", description: "Ative as notificações para testar." });
      return;
    }

    toast({ title: "Enviando simulação...", description: "Você receberá o push em 3 segundos." });

    setTimeout(() => {
      const title = type === "PORTARIA" ? "📦 Nova Encomenda Recebida" : "⚠️ Fatura Próxima do Vencimento";
      const body = type === "PORTARIA" 
        ? "Uma nova encomenda para a sua unidade chegou na portaria principal. Retire com seu PIN." 
        : "A sua taxa de condomínio deste mês vence em 3 dias. Evite juros pagando com Pix.";

      new Notification(title, {
        body,
        icon: "/favicon.ico"
      });
    }, 3000);
  };

  // Water/Gas Consumption States
  const [consumos, setConsumos] = useState<any[]>([]);
  const [isLoadingConsumos, setIsLoadingConsumos] = useState(false);

  React.useEffect(() => {
    if (!firestore || !condominioAtivoId || !targetBlocoId || !targetUnidadeId) return;
    setIsLoadingConsumos(true);
    const q = query(
      collection(firestore, `condominios/${condominioAtivoId}/blocos/${targetBlocoId}/unidades/${targetUnidadeId}/consumo`),
      orderBy("ano", "asc"),
      orderBy("mes", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setConsumos(list);
      setIsLoadingConsumos(false);
    }, (err) => {
      console.error(err);
      setIsLoadingConsumos(false);
    });
    return unsub;
  }, [firestore, condominioAtivoId, targetBlocoId, targetUnidadeId]);

  const chartData = useMemo(() => {
    if (consumos.length > 0) {
      return consumos.map((c) => ({
        name: `${MESES[c.mes - 1]}/${c.ano}`,
        agua: c.agua,
        gas: c.gas
      }));
    }
    return [
      { name: "Jan", agua: 12.5, gas: 8.2 },
      { name: "Fev", agua: 14.1, gas: 7.9 },
      { name: "Mar", agua: 11.8, gas: 9.1 },
      { name: "Abr", agua: 13.0, gas: 8.5 },
      { name: "Mai", agua: 12.2, gas: 8.0 },
      { name: "Jun", agua: 15.4, gas: 9.4 },
    ];
  }, [consumos]);

  // Electronic Signature / Hashing States
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";

    const pos = getMousePos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pos = getMousePos(canvas, e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const getMousePos = (canvas: HTMLCanvasElement, e: any) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const sha256 = async (message: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
  };

  React.useEffect(() => {
    if (!firestore || !condominioAtivoId || !session?.user?.uid) return;
    setIsLoadingProcuracoes(true);

    const ref = collection(firestore, `condominios/${condominioAtivoId}/procuracoes`);
    const q = isOperator
      ? query(ref, orderBy("createdAt", "desc"))
      : query(ref, where("outorganteUid", "==", session.user.uid));

    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (!isOperator) {
        // Ordena no cliente para evitar necessidade de criar índice composto no Firestore
        all.sort((a: any, b: any) => {
          const t1 = a.createdAt?.seconds ?? 0;
          const t2 = b.createdAt?.seconds ?? 0;
          return t2 - t1;
        });
      }

      setProcuracoes(all);
      setIsLoadingProcuracoes(false);
    }, (err) => {
      console.error("Erro ao ler procurações:", err);
      setIsLoadingProcuracoes(false);
    });
    return unsub;
  }, [firestore, condominioAtivoId, session?.user?.uid, isOperator]);

  const handleSaveProcuracao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !condominioAtivoId || !session?.user?.uid) return;
    if (!procOutorgadoNome.trim() || !procOutorgadoUnidade.trim() || !procExpiresAt) {
      toast({ variant: "destructive", title: "Erro no formulário", description: "Todos os campos são obrigatórios." });
      return;
    }

    setSaving(true);
    try {
      const currentUserName = (session as any)?.userName || session?.user?.displayName || "Morador";
      const colPath = `condominios/${condominioAtivoId}/procuracoes`;
      
      const payload = `${session.user.uid}|${procOutorgadoNome}|${procOutorgadoUnidade}|${procExpiresAt}|${Date.now()}`;
      const hash = await sha256(payload);
      const signatureDataUrl = canvasRef.current ? canvasRef.current.toDataURL() : null;

      const docData = {
        outorganteUid: session.user.uid,
        outorganteNome: currentUserName,
        outorganteUnidade: `${blocoNome} - Apt ${unidadeNumero}`,
        outorgadoNome: procOutorgadoNome.trim(),
        outorgadoUnidade: procOutorgadoUnidade.trim(),
        status: "ATIVA",
        expiresAt: new Date(procExpiresAt),
        hash: hash,
        assinatura: signatureDataUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(firestore, colPath), docData);
      toast({ title: "Procuração outorgada com sucesso!" });
      setProcModalOpen(false);
      setProcOutorgadoNome("");
      setProcOutorgadoUnidade("");
      setProcExpiresAt("");
      setHasSignature(false);
    } catch (err: any) {
      console.error("Erro ao salvar procuração:", err);
      toast({ variant: "destructive", title: "Erro ao salvar procuração", description: err.message || "Tente novamente." });
    } finally {
      setSaving(false);
    }
  };

  const handleRevogarProcuracao = async (id: string) => {
    if (!confirm("Revogar esta procuração?") || !firestore || !condominioAtivoId) return;
    try {
      await updateDoc(doc(firestore, `condominios/${condominioAtivoId}/procuracoes`, id), {
        status: "REVOGADA",
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Procuração revogada com sucesso." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao revogar procuração", description: err.message });
    }
  };

  // Ações - Pets
  const openNewPet = () => {
    setPetId(null);
    setPetNome("");
    setPetEspecie("Cão");
    setPetRaca("");
    setPetPorte("Médio");
    setPetObs("");
    setPetModalOpen(true);
  };

  const openEditPet = (pet: Pet) => {
    setPetId(pet.id);
    setPetNome(pet.nome);
    setPetEspecie(pet.especie || "Cão");
    setPetRaca(pet.raca || "");
    setPetPorte(pet.porte || "Médio");
    setPetObs(pet.observacoes || "");
    setPetModalOpen(true);
  };

  const handleSavePet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !condominioAtivoId || !targetBlocoId || !targetUnidadeId) return;
    if (!petNome.trim()) {
      toast({ variant: "destructive", title: "Nome obrigatório", description: "Informe o nome do pet." });
      return;
    }

    setSaving(true);
    try {
      const colPath = `condominios/${condominioAtivoId}/blocos/${targetBlocoId}/unidades/${targetUnidadeId}/pets`;
      const petData = {
        nome: petNome.trim(),
        especie: petEspecie,
        raca: petRaca.trim() || null,
        porte: petPorte,
        observacoes: petObs.trim() || null,
        updatedAt: serverTimestamp(),
      };

      if (petId) {
        await updateDoc(doc(firestore, colPath, petId), petData);
        toast({ title: "Pet atualizado com sucesso!" });
      } else {
        await addDoc(collection(firestore, colPath), {
          ...petData,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Pet cadastrado com sucesso!" });
      }
      setPetModalOpen(false);
    } catch (e: any) {
      console.error("Erro ao salvar pet:", e);
      toast({ variant: "destructive", title: "Erro ao salvar pet", description: e.message || "Tente novamente." });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePet = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este pet?") || !firestore || !condominioAtivoId || !targetBlocoId || !targetUnidadeId) return;
    try {
      await deleteDoc(doc(firestore, `condominios/${condominioAtivoId}/blocos/${targetBlocoId}/unidades/${targetUnidadeId}/pets`, id));
      toast({ title: "Pet removido com sucesso." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao remover pet", description: e.message });
    }
  };

  // Ações - Veículos
  const openNewVeiculo = () => {
    setVeiculoId(null);
    setVPlaca("");
    setVMarca("");
    setVModelo("");
    setVCor("");
    setVVaga("");
    setVeiculoModalOpen(true);
  };

  const openEditVeiculo = (v: Veiculo) => {
    setVeiculoId(v.id);
    setVPlaca(v.placa);
    setVMarca(v.marca);
    setVModelo(v.modelo);
    setVCor(v.cor);
    setVVaga(v.vaga || "");
    setVeiculoModalOpen(true);
  };

  const handleSaveVeiculo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !condominioAtivoId || !targetBlocoId || !targetUnidadeId) return;
    if (!vPlaca.trim() || !vModelo.trim()) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Informe a placa e o modelo do veículo." });
      return;
    }

    setSaving(true);
    try {
      const colPath = `condominios/${condominioAtivoId}/blocos/${targetBlocoId}/unidades/${targetUnidadeId}/veiculos`;
      const veiculoData = {
        placa: vPlaca.trim().toUpperCase(),
        marca: vMarca.trim(),
        modelo: vModelo.trim(),
        cor: vCor.trim(),
        vaga: vVaga.trim() || null,
        updatedAt: serverTimestamp(),
      };

      if (veiculoId) {
        await updateDoc(doc(firestore, colPath, veiculoId), veiculoData);
        toast({ title: "Veículo atualizado com sucesso!" });
      } else {
        await addDoc(collection(firestore, colPath), {
          ...veiculoData,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Veículo cadastrado com sucesso!" });
      }
      setVeiculoModalOpen(false);
    } catch (e: any) {
      console.error("Erro ao salvar veículo:", e);
      toast({ variant: "destructive", title: "Erro ao salvar veículo", description: e.message || "Tente novamente." });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVeiculo = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este veículo?") || !firestore || !condominioAtivoId || !targetBlocoId || !targetUnidadeId) return;
    try {
      await deleteDoc(doc(firestore, `condominios/${condominioAtivoId}/blocos/${targetBlocoId}/unidades/${targetUnidadeId}/veiculos`, id));
      toast({ title: "Veículo removido com sucesso." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao remover veículo", description: e.message });
    }
  };

  if (!condominioAtivoId) {
    return (
      <AppLayout pageTitle="Meus Dados">
        <Card className="tc-card-signature">
          <CardHeader>
            <CardTitle>Nenhum condomínio ativo</CardTitle>
            <CardDescription>Selecione um condomínio para gerenciar seus dados.</CardDescription>
          </CardHeader>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle={isOperator ? "Cadastros da Unidade" : "Meus Dados (Pets & Veículos)"}>
      <div className="space-y-6">
        <Card className="bg-slate-900/50 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-xl">Unidade Selecionada</CardTitle>
            <CardDescription className="text-white/60">
              Bloco: <span className="text-white font-bold">{blocoNome}</span> — Unidade:{" "}
              <span className="text-white font-bold">{unidadeNumero}</span>
            </CardDescription>
          </CardHeader>
          {isOperator && (
            <CardContent className="text-xs text-white/50 pt-0">
              *Como administrador, você pode trocar a unidade ativa na barra de ferramentas lateral para ver outros cadastros.
            </CardContent>
          )}
        </Card>

        {!targetBlocoId || !targetUnidadeId ? (
          <Card className="bg-slate-900/40 border-white/10 text-white p-8 text-center">
            <p className="text-white/60 text-sm">
              Por favor, selecione um <strong>Bloco</strong> e uma <strong>Unidade</strong> na barra lateral esquerda para visualizar e gerenciar os dados.
            </p>
          </Card>
        ) : (
          <Tabs defaultValue="veiculos" className="w-full">
            <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full max-w-3xl bg-white/5 border border-white/10 p-1 rounded-2xl mb-6">
              <TabsTrigger value="veiculos" className="rounded-xl flex items-center justify-center gap-2">
                <Car className="h-4 w-4" /> Veículos
              </TabsTrigger>
              <TabsTrigger value="pets" className="rounded-xl flex items-center justify-center gap-2">
                <PawPrint className="h-4 w-4" /> Pets
              </TabsTrigger>
              <TabsTrigger value="procuracoes" className="rounded-xl flex items-center justify-center gap-2">
                <FileText className="h-4 w-4" /> Procurações
              </TabsTrigger>
              <TabsTrigger value="consumo" className="rounded-xl flex items-center justify-center gap-2">
                <Droplet className="h-4 w-4" /> Consumos
              </TabsTrigger>
              <TabsTrigger value="notificacoes" className="rounded-xl flex items-center justify-center gap-2">
                <Bell className="h-4 w-4" /> Alertas
              </TabsTrigger>
              <TabsTrigger value="aparencia" className="rounded-xl flex items-center justify-center gap-2">
                <Palette className="h-4 w-4" /> Aparência
              </TabsTrigger>
            </TabsList>

            {/* VEÍCULOS TAB */}
            <TabsContent value="veiculos" className="space-y-4 outline-none">
              <Card className="bg-slate-900/40 border-white/10 text-white rounded-3xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Car className="text-[#00D0E6] h-5 w-5" /> Veículos Cadastrados
                    </CardTitle>
                    <CardDescription className="text-white/60">
                      Veículos autorizados para acesso e estacionamento nesta unidade.
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={openNewVeiculo} 
                    className="rounded-xl bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none flex items-center gap-1.5 hover:scale-105 transition"
                  >
                    <Plus className="h-4 w-4" /> Novo Veículo
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoadingVeiculos ? (
                    <p className="py-6 text-center text-sm text-white/50">Carregando veículos...</p>
                  ) : veiculos.length === 0 ? (
                    <p className="py-6 text-center text-sm text-white/50">Nenhum veículo cadastrado para esta unidade.</p>
                  ) : (
                    <div className="overflow-x-auto w-full">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10 hover:bg-transparent">
                            <TableHead className="text-white/50">Placa</TableHead>
                            <TableHead className="text-white/50">Modelo</TableHead>
                            <TableHead className="text-white/50">Marca</TableHead>
                            <TableHead className="text-white/50">Cor</TableHead>
                            <TableHead className="text-white/50">Vaga</TableHead>
                            <TableHead className="text-white/50 text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {veiculos.map((v) => (
                            <TableRow key={v.id} className="border-white/5 hover:bg-white/5">
                              <TableCell className="font-bold text-[#00D0E6]">{v.placa}</TableCell>
                              <TableCell>{v.modelo}</TableCell>
                              <TableCell>{v.marca || "-"}</TableCell>
                              <TableCell>{v.cor || "-"}</TableCell>
                              <TableCell>{v.vaga || "-"}</TableCell>
                              <TableCell className="text-right space-x-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10 text-white/70 hover:text-white" onClick={() => openEditVeiculo(v)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-500/20 text-red-400 hover:text-red-300" onClick={() => handleDeleteVeiculo(v.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* PETS TAB */}
            <TabsContent value="pets" className="space-y-4 outline-none">
              <Card className="bg-slate-900/40 border-white/10 text-white rounded-3xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <PawPrint className="text-[#D3EA00] h-5 w-5" /> Pets Cadastrados
                    </CardTitle>
                    <CardDescription className="text-white/60">
                      Animais de estimação associados a esta unidade.
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={openNewPet} 
                    className="rounded-xl bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none flex items-center gap-1.5 hover:scale-105 transition"
                  >
                    <Plus className="h-4 w-4" /> Novo Pet
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoadingPets ? (
                    <p className="py-6 text-center text-sm text-white/50">Carregando pets...</p>
                  ) : pets.length === 0 ? (
                    <p className="py-6 text-center text-sm text-white/50">Nenhum pet cadastrado para esta unidade.</p>
                  ) : (
                    <div className="overflow-x-auto w-full">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10 hover:bg-transparent">
                            <TableHead className="text-white/50">Nome</TableHead>
                            <TableHead className="text-white/50">Espécie</TableHead>
                            <TableHead className="text-white/50">Raça</TableHead>
                            <TableHead className="text-white/50">Porte</TableHead>
                            <TableHead className="text-white/50">Observações</TableHead>
                            <TableHead className="text-white/50 text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pets.map((p) => (
                            <TableRow key={p.id} className="border-white/5 hover:bg-white/5">
                              <TableCell className="font-bold text-[#D3EA00]">{p.nome}</TableCell>
                              <TableCell>{p.especie}</TableCell>
                              <TableCell>{p.raca || "-"}</TableCell>
                              <TableCell>{p.porte || "-"}</TableCell>
                              <TableCell className="max-w-xs truncate">{p.observacoes || "-"}</TableCell>
                              <TableCell className="text-right space-x-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10 text-white/70 hover:text-white" onClick={() => openEditPet(p)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-500/20 text-red-400 hover:text-red-300" onClick={() => handleDeletePet(p.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* PROCURAÇÕES TAB */}
            <TabsContent value="procuracoes" className="space-y-4 outline-none">
              <Card className="bg-slate-900/40 border-white/10 text-white rounded-3xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <FileText className="text-[#00D0E6] h-5 w-5" /> Procurações Outorgadas
                    </CardTitle>
                    <CardDescription className="text-white/60">
                      Delegações de poder de voto para representação em assembleias deste condomínio.
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => setProcModalOpen(true)} 
                    className="rounded-xl bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none flex items-center gap-1.5 hover:scale-105 transition"
                  >
                    <Plus className="h-4 w-4" /> Outorgar Procuração
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoadingProcuracoes ? (
                    <p className="py-6 text-center text-sm text-white/50">Carregando procurações...</p>
                  ) : procuracoes.length === 0 ? (
                    <p className="py-6 text-center text-sm text-white/50">Nenhuma procuração cadastrada.</p>
                  ) : (
                    <div className="overflow-x-auto w-full">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10 hover:bg-transparent">
                            {isOperator && <TableHead className="text-white/50">Outorgante (De)</TableHead>}
                            <TableHead className="text-white/50">Outorgado (Para)</TableHead>
                            <TableHead className="text-white/50">Unidade Destino</TableHead>
                            <TableHead className="text-white/50">Validade</TableHead>
                            <TableHead className="text-white/50">Selo Digital</TableHead>
                            <TableHead className="text-white/50">Status</TableHead>
                            <TableHead className="text-white/50 text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {procuracoes.map((p) => {
                            const isExpired = p.expiresAt ? (p.expiresAt.toDate ? p.expiresAt.toDate() : new Date(p.expiresAt)) < new Date() : false;
                            const isActive = p.status === "ATIVA" && !isExpired;
                            return (
                              <TableRow key={p.id} className="border-white/5 hover:bg-white/5">
                                {isOperator && (
                                  <TableCell>
                                    <div className="font-bold text-white">{p.outorganteNome}</div>
                                    <div className="text-xs text-white/50">{p.outorganteUnidade}</div>
                                  </TableCell>
                                )}
                                <TableCell className="font-bold text-white">{p.outorgadoNome}</TableCell>
                                <TableCell>{p.outorgadoUnidade}</TableCell>
                                <TableCell>
                                  {p.expiresAt ? (
                                    p.expiresAt.toDate 
                                      ? p.expiresAt.toDate().toLocaleDateString("pt-BR") 
                                      : new Date(p.expiresAt).toLocaleDateString("pt-BR")
                                  ) : "-"}
                                </TableCell>
                                <TableCell>
                                  {p.hash ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                                        <ShieldCheck className="h-3 w-3" /> Assinado
                                      </span>
                                      <span 
                                        className="text-[9px] text-white/40 font-mono cursor-pointer hover:text-white select-all truncate max-w-[100px]" 
                                        onClick={() => {
                                          navigator.clipboard.writeText(p.hash);
                                          toast({ title: "Hash Copiado!", description: p.hash });
                                        }}
                                        title={p.hash}
                                      >
                                        {p.hash.substring(0, 8)}...
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-white/30">Sem selo</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {isActive ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                                      Ativa
                                    </span>
                                  ) : isExpired ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                                      Expirada
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/50">
                                      Revogada
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isActive && (
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-xl"
                                      onClick={() => handleRevogarProcuracao(p.id)}
                                    >
                                      Revogar
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* CONSUMOS TAB */}
            <TabsContent value="consumo" className="space-y-4 outline-none">
              <Card className="bg-slate-900/40 border-white/10 text-white rounded-3xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Droplet className="text-[#00D0E6] h-5 w-5" /> Consumos de Água & Gás
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Histórico estatístico de leituras mensais de recursos para a sua unidade.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingConsumos ? (
                    <p className="py-6 text-center text-sm text-white/50">Carregando leituras...</p>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 bg-slate-950/20 p-4 rounded-2xl border border-white/5">
                        <span className="text-xs text-white/40 uppercase font-bold tracking-wider block mb-4">Evolução Mensal (m³ / kg)</span>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", color: "#fff", fontSize: "12px" }} />
                              <Bar dataKey="agua" name="Água (m³)" fill="#00D0E6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="gas" name="Gás (kg)" fill="#D3EA00" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="bg-slate-950/10 p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
                        <div>
                          <span className="text-xs text-white/40 uppercase font-bold tracking-wider block mb-3">Leituras Recentes</span>
                          {consumos.length === 0 ? (
                            <div className="text-xs text-white/40 py-6 text-center">Nenhuma leitura cadastrada ainda para a unidade. Exibindo dados de simulação padrão no gráfico.</div>
                          ) : (
                            <div className="space-y-2 max-h-56 overflow-y-auto">
                              {consumos.map((c: any) => (
                                <div key={c.id} className="p-2.5 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between text-xs">
                                  <div className="font-bold text-white">{MESES[c.mes - 1]}/{c.ano}</div>
                                  <div className="flex gap-3 text-white/70">
                                    <span className="flex items-center gap-1"><Droplet className="h-3 w-3 text-[#00D0E6]" /> {c.agua} m³</span>
                                    <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-[#D3EA00]" /> {c.gas} kg</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* NOTIFICAÇÕES TAB */}
            <TabsContent value="notificacoes" className="space-y-4 outline-none">
              <Card className="bg-slate-900/40 border-white/10 text-white rounded-3xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Bell className="text-[#D3EA00] h-5 w-5" /> Notificações Push & Alertas
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Gerencie a autorização e teste o recebimento de notificações do condomínio direto em sua tela.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-5 bg-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-bold text-white flex items-center gap-2 text-sm">
                        Permissão de Notificação
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pushEnabled ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/50"
                        }`}>
                          {pushEnabled ? "Ativado" : "Desativado"}
                        </span>
                      </div>
                      <p className="text-xs text-white/60">Permite que o navegador exiba alertas visuais em tempo real quando você receber encomendas ou recados importantes.</p>
                    </div>
                    <button
                      onClick={handleTogglePush}
                      className={`px-4 py-2 font-bold rounded-xl text-xs transition duration-200 shrink-0 ${
                        pushEnabled 
                          ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20" 
                          : "bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 hover:scale-105"
                      }`}
                    >
                      {pushEnabled ? "Desativar" : "Ativar no Navegador"}
                    </button>
                  </div>

                  {pushEnabled && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <span className="text-xs text-white/40 uppercase font-bold tracking-wider block">Simulador de Alertas Push (Testes)</span>
                      <p className="text-xs text-white/60 leading-relaxed">Clique em um dos botões abaixo para disparar uma notificação push real no seu sistema operacional em 3 segundos. Minimize a aba ou mude de tela para ver o balão nativo.</p>
                      
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handleSimulatePush("PORTARIA")}
                          className="px-4 py-2.5 bg-slate-950/40 border border-white/10 hover:border-[#00D0E6] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        >
                          📦 Simular Encomenda
                        </button>
                        <button
                          onClick={() => handleSimulatePush("FINANCEIRO")}
                          className="px-4 py-2.5 bg-slate-950/40 border border-white/10 hover:border-[#D3EA00] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        >
                          ⚠️ Simular Cobrança
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* APARÊNCIA TAB */}
            <TabsContent value="aparencia" className="space-y-4 outline-none">
              <Card className="bg-slate-900/40 border-white/10 text-white rounded-3xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Palette className="text-[#00D0E6] h-5 w-5" /> Temas e Aparência do Sistema
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Escolha um tema estético premium para personalizar a interface e as cores do seu painel de controle.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Theme Onyx */}
                    <button
                      onClick={() => setTheme("onyx")}
                      className={`p-5 rounded-2xl border text-left transition duration-300 relative overflow-hidden flex flex-col justify-between min-h-[140px] group ${
                        theme === "onyx"
                          ? "border-[#00D0E6] bg-slate-950/60 shadow-[0_0_15px_rgba(0,208,230,0.15)]"
                          : "border-white/10 bg-slate-950/20 hover:border-white/20"
                      }`}
                    >
                      {theme === "onyx" && (
                        <div className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-[#00D0E6] animate-pulse" />
                      )}
                      <div>
                        <div className="font-bold text-sm text-white">Onyx Dark</div>
                        <p className="text-[11px] text-white/50 mt-1">O tema padrão escuro elegante com detalhes em ciano e verde.</p>
                      </div>
                      <div className="flex gap-1.5 mt-4">
                        <span className="w-4 h-4 rounded-full bg-[#00D0E6] inline-block border border-white/10" />
                        <span className="w-4 h-4 rounded-full bg-[#00A86B] inline-block border border-white/10" />
                        <span className="w-4 h-4 rounded-full bg-[#090E1A] inline-block border border-white/10" />
                      </div>
                    </button>

                    {/* Theme Cyberpunk */}
                    <button
                      onClick={() => setTheme("cyberpunk")}
                      className={`p-5 rounded-2xl border text-left transition duration-300 relative overflow-hidden flex flex-col justify-between min-h-[140px] group ${
                        theme === "cyberpunk"
                          ? "border-[#FF007F] bg-slate-950/80 shadow-[0_0_15px_rgba(255,0,127,0.15)]"
                          : "border-white/10 bg-slate-950/20 hover:border-white/20"
                      }`}
                    >
                      {theme === "cyberpunk" && (
                        <div className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-[#FF007F] animate-pulse" />
                      )}
                      <div>
                        <div className="font-bold text-sm text-white">Cyberpunk Neon</div>
                        <p className="text-[11px] text-white/50 mt-1">Preto absoluto com contrastes vibrantes em rosa neon e ciano futurista.</p>
                      </div>
                      <div className="flex gap-1.5 mt-4">
                        <span className="w-4 h-4 rounded-full bg-[#FF007F] inline-block border border-white/10" />
                        <span className="w-4 h-4 rounded-full bg-[#00FFFF] inline-block border border-white/10" />
                        <span className="w-4 h-4 rounded-full bg-[#030107] inline-block border border-white/10" />
                      </div>
                    </button>

                    {/* Theme Solar Light */}
                    <button
                      onClick={() => setTheme("solar")}
                      className={`p-5 rounded-2xl border text-left transition duration-300 relative overflow-hidden flex flex-col justify-between min-h-[140px] group ${
                        theme === "solar"
                          ? "border-[#f59e0b] bg-white border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                          : "border-white/10 bg-slate-950/20 hover:border-white/20"
                      }`}
                    >
                      {theme === "solar" && (
                        <div className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                      )}
                      <div>
                        <div className="font-bold text-sm text-slate-900 group-hover:text-amber-600 transition-colors">Solar Light</div>
                        <p className="text-[11px] text-slate-500 mt-1">Tema minimalista claro, inspirado na Apple, com tons quentes e suaves.</p>
                      </div>
                      <div className="flex gap-1.5 mt-4">
                        <span className="w-4 h-4 rounded-full bg-[#d97706] inline-block border border-black/10" />
                        <span className="w-4 h-4 rounded-full bg-[#fcd34d] inline-block border border-black/10" />
                        <span className="w-4 h-4 rounded-full bg-[#faf8f5] inline-block border border-black/10" />
                      </div>
                    </button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* VEÍCULO FORM MODAL */}
      {veiculoModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSaveVeiculo}>
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-bold">{veiculoId ? "Editar Veículo" : "Cadastrar Veículo"}</h3>
                <button type="button" onClick={() => setVeiculoModalOpen(false)} className="text-white/60 hover:text-white">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="placa">Placa</Label>
                  <Input id="placa" value={vPlaca} onChange={(e) => setVPlaca(e.target.value)} placeholder="ABC-1234 ou ABC1D23" className="bg-white/5 border-white/10 text-white uppercase" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="marca">Marca</Label>
                    <Input id="marca" value={vMarca} onChange={(e) => setVMarca(e.target.value)} placeholder="Ex: Chevrolet" className="bg-white/5 border-white/10 text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="modelo">Modelo</Label>
                    <Input id="modelo" value={vModelo} onChange={(e) => setVModelo(e.target.value)} placeholder="Ex: Onix" className="bg-white/5 border-white/10 text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cor">Cor</Label>
                    <Input id="cor" value={vCor} onChange={(e) => setVCor(e.target.value)} placeholder="Ex: Preto" className="bg-white/5 border-white/10 text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vaga">Vaga Vinculada</Label>
                    <Input id="vaga" value={vVaga} onChange={(e) => setVVaga(e.target.value)} placeholder="Ex: 12B" className="bg-white/5 border-white/10 text-white" />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-white/10 flex justify-end gap-2 bg-slate-950/20">
                <Button type="button" variant="outline" className="border-white/10 hover:bg-white/10 text-white rounded-xl" onClick={() => setVeiculoModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none rounded-xl">
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PET FORM MODAL */}
      {petModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSavePet}>
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-bold">{petId ? "Editar Pet" : "Cadastrar Pet"}</h3>
                <button type="button" onClick={() => setPetModalOpen(false)} className="text-white/60 hover:text-white">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="petNome">Nome do Pet</Label>
                  <Input id="petNome" value={petNome} onChange={(e) => setPetNome(e.target.value)} placeholder="Ex: Marley" className="bg-white/5 border-white/10 text-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="petEspecie">Espécie</Label>
                    <Select value={petEspecie} onValueChange={setPetEspecie}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 text-white border-white/15">
                        <SelectItem value="Cão">Cão / Cachorro</SelectItem>
                        <SelectItem value="Gato">Gato</SelectItem>
                        <SelectItem value="Ave">Ave / Pássaro</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="petPorte">Porte</Label>
                    <Select value={petPorte} onValueChange={setPetPorte}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 text-white border-white/15">
                        <SelectItem value="Pequeno">Pequeno</SelectItem>
                        <SelectItem value="Médio">Médio</SelectItem>
                        <SelectItem value="Grande">Grande</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="petRaca">Raça</Label>
                  <Input id="petRaca" value={petRaca} onChange={(e) => setPetRaca(e.target.value)} placeholder="Ex: Labrador, SRD..." className="bg-white/5 border-white/10 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="petObs">Observações / Vacinação</Label>
                  <Input id="petObs" value={petObs} onChange={(e) => setPetObs(e.target.value)} placeholder="Ex: Vacina da raiva em dia, dócil..." className="bg-white/5 border-white/10 text-white" />
                </div>
              </div>
              <div className="p-6 border-t border-white/10 flex justify-end gap-2 bg-slate-950/20">
                <Button type="button" variant="outline" className="border-white/10 hover:bg-white/10 text-white rounded-xl" onClick={() => setPetModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none rounded-xl">
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROCURAÇÃO FORM MODAL */}
      {procModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSaveProcuracao}>
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-bold">Outorgar Procuração</h3>
                <button type="button" onClick={() => setProcModalOpen(false)} className="text-white/60 hover:text-white">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="procOutorgadoNome">Nome do Outorgado (Representante)</Label>
                  <Input 
                    id="procOutorgadoNome" 
                    value={procOutorgadoNome} 
                    onChange={(e) => setProcOutorgadoNome(e.target.value)} 
                    placeholder="Nome completo do procurador" 
                    className="bg-white/5 border-white/10 text-white" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="procOutorgadoUnidade">Unidade do Outorgado</Label>
                  <Input 
                    id="procOutorgadoUnidade" 
                    value={procOutorgadoUnidade} 
                    onChange={(e) => setProcOutorgadoUnidade(e.target.value)} 
                    placeholder="Ex: Bloco A - Apt 101" 
                    className="bg-white/5 border-white/10 text-white" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="procExpiresAt">Válido Até (Data de Expiração)</Label>
                  <Input 
                    id="procExpiresAt" 
                    type="date" 
                    value={procExpiresAt} 
                    onChange={(e) => setProcExpiresAt(e.target.value)} 
                    className="bg-white/5 border-white/10 text-white" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white">Assinatura Eletrônica (Desenhe no quadro)</Label>
                  <div className="border border-white/10 bg-slate-950 rounded-xl overflow-hidden relative">
                    <canvas
                      ref={canvasRef}
                      width={380}
                      height={120}
                      className="w-full h-30 bg-slate-950 cursor-crosshair touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="px-2 py-1 bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-[10px] font-bold rounded-lg transition"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/40">Sua assinatura será digitalizada e vinculada a um hash criptográfico SHA-256 de segurança.</p>
                </div>
              </div>
              <div className="p-6 border-t border-white/10 flex justify-end gap-2 bg-slate-950/20">
                <Button type="button" variant="outline" className="border-white/10 hover:bg-white/10 text-white rounded-xl" onClick={() => setProcModalOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none rounded-xl">
                  {saving ? "Processando..." : "Outorgar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
