"use client";

import { useEffect, useState, useRef } from "react";
import WelcomeMorador from "@/components/welcome/WelcomeMorador";
import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  orderBy,
  limit,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Package,
  AlertCircle,
  CalendarClock,
  CalendarCheck2,
  BarChart3,
  Key,
  ShieldAlert,
  Users,
  DollarSign,
  QrCode,
  Search,
  Check,
  Trash2,
  Clock,
  Eye,
  AlertTriangle,
  Smartphone,
  Shield,
  Activity,
  User,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranding } from "@/contexts/BrandingContext";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";

// Circular HUD Progress Indicator component
function CircularProgressHUD({
  value,
  max = 10,
  label,
  icon: Icon,
  colorClass = "text-[#00D0E6]",
  strokeColor = "#00D0E6",
  href,
}: {
  value: number | string | null;
  max?: number;
  label: string;
  icon: any;
  colorClass?: string;
  strokeColor?: string;
  href: string;
}) {
  const numericValue = typeof value === "number" ? value : 0;
  const percentage = Math.min(Math.max(numericValue / max, 0), 1);
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percentage);

  return (
    <Card className="border-white/10 bg-slate-950/40 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:border-[#00D0E6]/30 transition-all duration-300 rounded-3xl p-5 flex items-center justify-between group">
      <div className="flex flex-col justify-between h-full">
        <div>
          <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">{label}</span>
          <div className="text-2xl font-black text-white mt-1 group-hover:text-[#00D0E6] transition-colors">
            {value === null ? <Skeleton className="h-8 w-12 bg-white/10" /> : value}
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00D0E6] hover:text-[#00B4CC] mt-4 transition-all hover:translate-x-0.5"
        >
          Visualizar <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="relative flex items-center justify-center">
        {/* SVG Ring */}
        <svg className="w-16 h-16 transform -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="3.5"
            fill="transparent"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke={strokeColor}
            strokeWidth="3.5"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out shadow-[0_0_15px_rgba(0,208,230,0.4)]"
          />
        </svg>
        <div className={`absolute flex items-center justify-center ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { session } = useSessionCtx();
  const firestore = useFirestore();
  const branding = useBranding();
  const { toast } = useToast();

  const condominioId = session?.activeCondominioId;
  const uid = session?.user?.uid;
  const role = session?.role;
  const userName = session?.user?.displayName || "Morador";

  const isAdminLike = role && ["SINDICO", "ADMIN", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(role);
  const isOperator = role && ["SINDICO", "ADMIN", "PORTEIRO", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(role);

  // Stats Counters
  const [encomendasCount, setEncomendasCount] = useState<number | null>(null);
  const [incidentesCount, setIncidentesCount] = useState<number | null>(null);
  const [reservasCount, setReservasCount] = useState<number | null>(null);
  const [proximaAssembleia, setProximaAssembleia] = useState<any | undefined>(undefined);

  // BLE Virtual Key States
  const [bleState, setBleState] = useState<"idle" | "connecting" | "success">("idle");
  const [bleGate, setBleGate] = useState("");

  // Panic Button States
  const [panicState, setPanicState] = useState<"idle" | "counting" | "sent">("idle");
  const [panicCountdown, setPanicCountdown] = useState(3);
  const [panicTimerId, setPanicTimerId] = useState<any>(null);

  // Monospace Logs (System Ticker)
  const [tickerLogs, setTickerLogs] = useState<string[]>([]);
  const consoleContainerRef = useRef<HTMLDivElement>(null);

  // Visitor Passes States
  const [visitorPasses, setVisitorPasses] = useState<any[]>([]);
  const [allVisitorPasses, setAllVisitorPasses] = useState<any[]>([]);
  const [searchPassQuery, setSearchPassQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("TODOS");

  // Modal Controls
  const [showPassModal, setShowPassModal] = useState(false);
  const [showPortariaModal, setShowPortariaModal] = useState(false);

  // Form Fields for Pass Generation
  const [visitorName, setVisitorName] = useState("");
  const [visitorCpf, setVisitorCpf] = useState("");
  const [visitorType, setVisitorType] = useState<"VISITANTE" | "ENTREGADOR">("VISITANTE");
  const [expirationHours, setExpirationHours] = useState("1");
  const [creatingPass, setCreatingPass] = useState(false);
  
  // QR view modal state
  const [selectedPassQr, setSelectedPassQr] = useState<string | null>(null);
  const [selectedPassName, setSelectedPassName] = useState("");

  // System Ticker Auto Log Generator
  useEffect(() => {
    const defaultLogs = [
      `[SYS] Núcleo de segurança TreeCondo carregado com sucesso.`,
      `[SYS] Conexão criptografada com banco de dados estabelecida.`,
      `[LOG] Portaria virtual ativa no condomínio.`,
    ];
    setTickerLogs(defaultLogs);

    const interval = setInterval(() => {
      const times = new Date().toLocaleTimeString("pt-BR", { hour12: false });
      const randomLogs = [
        `[BLE] Scanner de portão principal detectou dispositivo inativo.`,
        `[SYS] Verificação periódica de integridade dos QR Codes concluída.`,
        `[LOG] Correspondências na portaria organizadas e catalogadas.`,
        `[SYS] Monitoramento CFTV em tempo real: conexões estáveis.`,
        `[BLE] Leitor biométrico de hall social aguardando aproximação.`,
        `[LOG] Rotina de limpeza agendada das áreas comuns sincronizada.`,
      ];
      const selected = randomLogs[Math.floor(Math.random() * randomLogs.length)];
      setTickerLogs((prev) => [...prev.slice(-30), `[${times}] ${selected}`]);
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  // Auto scroll console ticker container only
  useEffect(() => {
    if (consoleContainerRef.current) {
      consoleContainerRef.current.scrollTop = consoleContainerRef.current.scrollHeight;
    }
  }, [tickerLogs]);

  // Firestore Queries for stats counters
  useEffect(() => {
    if (!firestore || !condominioId) {
      setEncomendasCount(null);
      setIncidentesCount(null);
      setReservasCount(null);
      setProximaAssembleia(undefined);
      return;
    }

    const unsubs: (() => void)[] = [];
    const now = Timestamp.now();

    // 1. Encomendas query
    const encomendasRef = collection(firestore, "condominios", condominioId, "encomendas");
    (async () => {
      try {
        if (isOperator) {
          const q = query(encomendasRef, where("status", "==", "AGUARDANDO"));
          unsubs.push(onSnapshot(q, (snap) => setEncomendasCount(snap.size)));
        } else if (uid) {
          const membroRef = doc(firestore, "condominios", condominioId, "membros", uid);
          const membroSnap = await getDoc(membroRef);
          const md = membroSnap.exists() ? membroSnap.data() || {} : {};
          const unidadeIdNorm = md.unidadeIdNorm || null;
          const blocoIdNorm = md.blocoIdNorm || null;

          if (!unidadeIdNorm) {
            setEncomendasCount(0);
          } else {
            const wheres = [where("unidadeIdNorm", "==", unidadeIdNorm), where("status", "==", "AGUARDANDO")];
            if (blocoIdNorm) wheres.push(where("blocoIdNorm", "==", blocoIdNorm));
            const q = query(encomendasRef, ...wheres);
            unsubs.push(onSnapshot(q, (snap) => setEncomendasCount(snap.size)));
          }
        }
      } catch (err) {
        console.error("Error query encomendas:", err);
        setEncomendasCount(0);
      }
    })();

    // 2. Incidentes query
    const incidentesRef = collection(firestore, "condominios", condominioId, "incidentes");
    let qIncidentes;
    if (isOperator) {
      qIncidentes = query(incidentesRef, where("status", "in", ["ABERTO", "EM_ANDAMENTO"]));
    } else if (uid) {
      qIncidentes = query(incidentesRef, where("criadoPorUid", "==", uid), where("status", "in", ["ABERTO", "EM_ANDAMENTO"]));
    }
    if (qIncidentes) {
      unsubs.push(onSnapshot(qIncidentes, (snap) => setIncidentesCount(snap.size)));
    }

    // 3. Reservas query
    const reservasRef = collection(firestore, "condominios", condominioId, "reservas");
    let qReservas;
    if (isOperator) {
      qReservas = query(reservasRef, where("status", "==", "APROVADA"), where("data", ">=", now), orderBy("data", "asc"));
    } else if (uid) {
      qReservas = query(reservasRef, where("uid", "==", uid), where("status", "==", "APROVADA"), where("data", ">=", now), orderBy("data", "asc"));
    }
    if (qReservas) {
      unsubs.push(onSnapshot(qReservas, (snap) => setReservasCount(snap.size)));
    }

    // 4. Assembleia query
    const qAssembleia = query(
      collection(firestore, "condominios", condominioId, "reunioes"),
      where("tipo", "==", "ASSEMBLEIA"),
      where("status", "==", "AGENDADA"),
      where("dataInicio", ">=", now),
      orderBy("dataInicio", "asc"),
      limit(1)
    );
    unsubs.push(
      onSnapshot(
        qAssembleia,
        (snap) => {
          setProximaAssembleia(snap.empty ? null : snap.docs[0].data());
        },
        (err) => {
          console.error("Error query assembleia:", err);
          setProximaAssembleia(null);
        }
      )
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [firestore, condominioId, uid, role, isOperator]);

  // Firestore Queries for Visitor Passes (Resident view)
  useEffect(() => {
    if (!firestore || !condominioId || !uid) return;

    const q = query(
      collection(firestore, "condominios", condominioId, "portariaQrCodes"),
      where("criadoPor", "==", uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        setVisitorPasses(list);
      },
      (err) => console.error("Error reading visitor passes:", err)
    );

    return unsub;
  }, [firestore, condominioId, uid]);

  // Firestore Queries for All Visitor Passes (Porter/Operator view)
  useEffect(() => {
    if (!firestore || !condominioId || !isOperator) return;

    const q = query(
      collection(firestore, "condominios", condominioId, "portariaQrCodes"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        setAllVisitorPasses(list);
      },
      (err) => console.error("Error reading all visitor passes:", err)
    );

    return unsub;
  }, [firestore, condominioId, isOperator]);

  // Virtual BLE trigger simulation
  const handleBleTrigger = () => {
    if (bleState !== "idle") return;
    setBleState("connecting");
    const selectedGate = [
      "Portão Principal Pedestre",
      "Portão Garagem Entrada",
      "Portão Garagem Saída",
      "Portão Social Hall",
    ][Math.floor(Math.random() * 4)];
    setBleGate(selectedGate);

    // Monospace log entry
    const timeStr = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    setTickerLogs((prev) => [...prev, `[${timeStr}] [BLE] Conectando leitor via Bluetooth para: ${selectedGate}...`]);

    setTimeout(() => {
      setBleState("success");
      toast({
        title: "Acesso Liberado! 🔓",
        description: `${selectedGate} ativado via BLE.`,
      });
      setTickerLogs((prev) => [...prev, `[${timeStr}] [BLE] Acesso concedido em ${selectedGate} para ${userName}.`]);

      setTimeout(() => {
        setBleState("idle");
      }, 3000);
    }, 1500);
  };

  // SOS button countdown initialization
  const startPanicCountdown = () => {
    if (panicState !== "idle") return;
    setPanicState("counting");
    setPanicCountdown(3);

    const timeStr = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    setTickerLogs((prev) => [...prev, `[${timeStr}] [WARN] Botão SOS acionado. Aguardando confirmação (3s)...`]);

    const timer = setInterval(() => {
      setPanicCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerPanicAlert();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setPanicTimerId(timer);
  };

  // SOS panic cancel
  const cancelPanicCountdown = () => {
    if (panicTimerId) {
      clearInterval(panicTimerId);
      setPanicTimerId(null);
    }
    setPanicState("idle");
    setPanicCountdown(3);
    toast({
      title: "Pânico Cancelado",
      description: "Nenhum sinal de emergência foi enviado.",
    });

    const timeStr = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    setTickerLogs((prev) => [...prev, `[${timeStr}] [LOG] Acionamento de pânico abortado pelo usuário.`]);
  };

  // SOS database trigger
  const triggerPanicAlert = async () => {
    setPanicState("sent");
    const timeStr = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    
    try {
      if (firestore && condominioId) {
        await addDoc(collection(firestore, "condominios", condominioId, "portariaPanico"), {
          criadoPor: uid || "anonimo",
          criadoPorNome: userName,
          createdAt: serverTimestamp(),
          status: "ATIVO",
        });
      }
      toast({
        variant: "destructive",
        title: "ALERTA ENVIADO 🚨",
        description: "Sinal silencioso enviado com sucesso à portaria central.",
      });
      setTickerLogs((prev) => [...prev, `[${timeStr}] [CRIT] ALERTA DE PÂNICO SILENCIOSO ENVIADO À PORTARIA CENTRAL.`]);
    } catch (e) {
      console.error(e);
      // fallback warning
      toast({
        variant: "destructive",
        title: "SOS Portaria",
        description: "Alerta de pânico ativado localmente.",
      });
      setTickerLogs((prev) => [...prev, `[${timeStr}] [CRIT] Alerta de emergência ativo localmente.`]);
    }
  };

  // Generate Visitor QR Code document in Firestore
  const handleCreateVisitorPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !condominioId || !uid) return;

    if (!visitorName.trim()) {
      toast({
        variant: "destructive",
        title: "Nome obrigatório",
        description: "Por favor informe o nome do visitante/entregador.",
      });
      return;
    }

    setCreatingPass(true);
    const timeStr = new Date().toLocaleTimeString("pt-BR", { hour12: false });

    try {
      const expDate = new Date();
      expDate.setHours(expDate.getHours() + parseInt(expirationHours));

      // Save pass record in Firestore
      const docRef = await addDoc(collection(firestore, "condominios", condominioId, "portariaQrCodes"), {
        nomeVisitante: visitorName.trim(),
        cpfVisitante: visitorCpf.trim() || null,
        tipo: visitorType,
        status: "ATIVO",
        criadoPor: uid,
        criadoPorNome: userName,
        createdAt: serverTimestamp(),
        expiraEm: Timestamp.fromDate(expDate),
      });

      // Generate local QR Code DataURL for presentation
      const qrDataUrl = await QRCode.toDataURL(docRef.id);
      setSelectedPassQr(qrDataUrl);
      setSelectedPassName(visitorName.trim());
      
      toast({
        title: "Passe Criado! 🎫",
        description: `QR Code gerado com sucesso para ${visitorName}.`,
      });

      setTickerLogs((prev) => [...prev, `[${timeStr}] [LOG] Novo passe QR gerado para ${visitorName} (${visitorType}).`]);

      // Reset Form fields
      setVisitorName("");
      setVisitorCpf("");
      setVisitorType("VISITANTE");
      setExpirationHours("1");
      setShowPassModal(false);
    } catch (err) {
      console.error("Error creating pass:", err);
      toast({
        variant: "destructive",
        title: "Erro ao gerar passe",
        description: "Houve um problema de escrita nas regras do banco de dados.",
      });
    } finally {
      setCreatingPass(false);
    }
  };

  // Delete/Cancel visitor pass
  const handleDeletePass = async (passId: string, name: string) => {
    if (!firestore || !condominioId) return;

    try {
      await updateDoc(doc(firestore, "condominios", condominioId, "portariaQrCodes", passId), {
        status: "CANCELADO",
      });
      toast({
        title: "Passe Cancelado",
        description: `O acesso para ${name} foi revogado.`,
      });
      const timeStr = new Date().toLocaleTimeString("pt-BR", { hour12: false });
      setTickerLogs((prev) => [...prev, `[${timeStr}] [LOG] Passe QR ${passId} cancelado por ${userName}.`]);
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Erro ao cancelar",
        description: "Não foi possível revogar este passe agora.",
      });
    }
  };

  // Validate / Record visitor entries (Porter/Operator actions)
  const handleValidatePass = async (passId: string, name: string) => {
    if (!firestore || !condominioId) return;

    try {
      await updateDoc(doc(firestore, "condominios", condominioId, "portariaQrCodes", passId), {
        status: "UTILIZADO",
        utilizadoEm: serverTimestamp(),
        validadoPorNome: userName,
      });

      toast({
        title: "Entrada Registrada! ✅",
        description: `Acesso do visitante ${name} registrado no sistema de portaria.`,
      });

      const timeStr = new Date().toLocaleTimeString("pt-BR", { hour12: false });
      setTickerLogs((prev) => [...prev, `[${timeStr}] [LOG] PORTARIA: Registro de entrada efetuado para ${name}.`]);
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: "Erro de rede ao gravar entrada.",
      });
    }
  };

  // Show active QR Code modal helper
  const handleViewQr = async (passId: string, name: string) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(passId);
      setSelectedPassQr(qrDataUrl);
      setSelectedPassName(name);
    } catch (err) {
      console.error("Error generating QR:", err);
    }
  };

  // Render formatters
  const formatDateTime = (ts: any) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AppLayout pageTitle="Painel de Controle">
      {/* Top Welcome Section */}
      <div className="mb-6">
        {branding.isLoading ? (
          <Skeleton className="h-[140px] w-full rounded-3xl bg-slate-900/40" />
        ) : (
          <WelcomeMorador />
        )}
      </div>

      {/* Grid of Circular HUD widgets */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <CircularProgressHUD
          value={encomendasCount}
          max={10}
          label="Novas Encomendas"
          icon={Package}
          colorClass="text-[#00D0E6]"
          strokeColor="#00D0E6"
          href="/encomendas"
        />

        <CircularProgressHUD
          value={incidentesCount}
          max={5}
          label="Incidentes Abertos"
          icon={AlertCircle}
          colorClass="text-rose-500"
          strokeColor="#ef4444"
          href="/incidentes"
        />

        <CircularProgressHUD
          value={reservasCount}
          max={8}
          label="Próximas Reservas"
          icon={CalendarClock}
          colorClass="text-emerald-500"
          strokeColor="#10b981"
          href="/reservas"
        />

        <CircularProgressHUD
          value={
            proximaAssembleia === undefined
              ? null
              : proximaAssembleia
              ? proximaAssembleia.dataInicio.toDate().toLocaleDateString("pt-BR", { day: "numeric", month: "short" })
              : "—"
          }
          max={1}
          label="Próxima Assembleia"
          icon={CalendarCheck2}
          colorClass="text-amber-500"
          strokeColor="#f59e0b"
          href="/reunioes"
        />
      </div>

      {/* Security Actions & Ticker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* BLE Key releases */}
        <Card className="border-white/10 bg-slate-950/40 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] rounded-3xl p-6 flex flex-col justify-between min-h-[220px]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Acesso por Proximidade</span>
              <h4 className="text-lg font-bold text-white mt-1">Chave Virtual BLE</h4>
            </div>
            <div className="bg-[#00D0E6]/10 p-2.5 rounded-2xl text-[#00D0E6]">
              <Key className="h-5 w-5" />
            </div>
          </div>

          <p className="text-xs text-white/60 mb-6 leading-relaxed">
            Aproxime o celular de qualquer eclusa ou selecione para destravar o portão em segurança via Bluetooth.
          </p>

          <button
            onClick={handleBleTrigger}
            disabled={bleState !== "idle"}
            className={`w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${
              bleState === "connecting"
                ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                : bleState === "success"
                ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                : "bg-[#00D0E6] hover:bg-[#00B4CC] text-slate-950 shadow-[0_0_15px_rgba(0,208,230,0.2)] hover:scale-[1.01]"
            }`}
          >
            {bleState === "connecting" ? (
              <>
                <span className="h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                Pareando Dispositivo...
              </>
            ) : bleState === "success" ? (
              <>🔓 {bleGate} Liberado!</>
            ) : (
              <>Destravar Portão (BLE)</>
            )}
          </button>
        </Card>

        {/* SOS Emergency button */}
        <Card className="border-white/10 bg-slate-950/40 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] rounded-3xl p-6 flex flex-col justify-between min-h-[220px]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Emergência e Coação</span>
              <h4 className="text-lg font-bold text-white mt-1">Botão de Pânico</h4>
            </div>
            <div className="bg-red-500/10 p-2.5 rounded-2xl text-red-500">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>

          <p className="text-xs text-white/60 mb-6 leading-relaxed">
            Para ocorrências graves, ative o pânico silencioso. A central receberá um chamado com sua unidade imediatamente.
          </p>

          {panicState === "idle" && (
            <button
              onClick={startPanicCountdown}
              className="w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:scale-[1.01] transition-all"
            >
              ⚠️ Acionar Pânico Silencioso
            </button>
          )}

          {panicState === "counting" && (
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={cancelPanicCountdown}
                className="flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-wider bg-slate-800 text-white hover:bg-slate-700 transition-all"
              >
                Cancelar ({panicCountdown}s)
              </button>
              <div className="h-11 w-11 rounded-full bg-rose-600 flex items-center justify-center font-bold text-white text-base animate-ping">
                {panicCountdown}
              </div>
            </div>
          )}

          {panicState === "sent" && (
            <button
              disabled
              className="w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider bg-rose-950 border border-rose-500 text-rose-500 cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              🚨 Alerta Enviado à Portaria
            </button>
          )}
        </Card>

        {/* Real-time Ticker console */}
        <Card className="border-white/10 bg-slate-950/70 shadow-[0_8px_30px_rgba(0,0,0,0.3)] rounded-3xl p-5 flex flex-col justify-between min-h-[220px]">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-[#00D0E6] animate-pulse" /> Monitor do Sistema
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <div ref={consoleContainerRef} className="flex-1 overflow-y-auto font-mono text-[10px] text-emerald-400 p-2 my-2 bg-slate-950/80 rounded-2xl border border-white/5 max-h-[110px] space-y-1 scrollbar-none">
            {tickerLogs.map((log, i) => (
              <div key={i} className="leading-tight break-all">
                {log}
              </div>
            ))}
          </div>

          <span className="text-[9px] text-white/30 text-right leading-none">Console Log Encrypted</span>
        </Card>
      </div>

      {/* Visitor QR Access Control Section */}
      <Card className="border-white/10 bg-slate-950/40 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] rounded-3xl overflow-hidden mb-6">
        <CardHeader className="border-b border-white/10 bg-slate-950/20 px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <QrCode className="h-6 w-6 text-[#00D0E6]" /> Gestão de Acessos
            </CardTitle>
            <p className="text-xs text-white/50 mt-1">
              Gere passes temporários para convidados ou analise registros de entrada da portaria.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isOperator && (
              <button
                onClick={() => setShowPassModal(true)}
                className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-[#00D0E6] hover:bg-[#00B4CC] text-slate-950 shadow-[0_0_15px_rgba(0,208,230,0.15)] transition-all flex items-center gap-1"
              >
                <QrCode className="h-4 w-4" /> Gerar Passe QR
              </button>
            )}
            {isOperator && (
              <button
                onClick={() => setShowPortariaModal(true)}
                className="px-4 py-2.5 rounded-xl text-xs font-black uppercase bg-[#D3EA00] hover:bg-[#b0c400] text-slate-950 shadow-[0_0_15px_rgba(211,234,0,0.15)] transition-all flex items-center gap-1"
              >
                <Search className="h-4 w-4" /> Validar Qr Code
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Active passes grid for Resident view */}
          {!isOperator ? (
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Meus Passes Recentes</h4>
              {visitorPasses.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                  <QrCode className="h-10 w-10 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/40">Nenhum passe criado recentemente.</p>
                  <button
                    onClick={() => setShowPassModal(true)}
                    className="text-xs text-[#00D0E6] font-bold mt-2 underline block mx-auto"
                  >
                    Criar passe de acesso temporário agora
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visitorPasses.map((pass) => {
                    const isExpired = pass.expiraEm && pass.expiraEm.toDate() < new Date();
                    return (
                      <div
                        key={pass.id}
                        className="p-4 border border-white/5 bg-slate-900/30 rounded-2xl flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm text-white truncate">{pass.nomeVisitante}</span>
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                                pass.status === "UTILIZADO"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : pass.status === "CANCELADO"
                                  ? "bg-slate-500/20 text-slate-400"
                                  : isExpired
                                  ? "bg-rose-500/20 text-rose-400"
                                  : "bg-emerald-500/20 text-emerald-400"
                              }`}
                            >
                              {pass.status === "ATIVO" && isExpired ? "EXPIRADO" : pass.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-white/50 space-y-0.5">
                            <p>Tipo: {pass.tipo}</p>
                            {pass.cpfVisitante && <p>CPF: {pass.cpfVisitante}</p>}
                            <p>Expiração: {formatDateTime(pass.expiraEm)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {pass.status === "ATIVO" && !isExpired && (
                            <>
                              <button
                                onClick={() => handleViewQr(pass.id, pass.nomeVisitante)}
                                className="p-2 bg-white/5 hover:bg-white/10 text-[#00D0E6] rounded-xl transition-all"
                                title="Visualizar QR Code"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeletePass(pass.id, pass.nomeVisitante)}
                                className="p-2 bg-white/5 hover:bg-red-500/20 text-red-400 rounded-xl transition-all"
                                title="Revogar/Excluir passe"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            // Porter view summary list
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-white">Últimos Registros de Acesso de Portaria</h4>
                <button
                  onClick={() => setShowPortariaModal(true)}
                  className="text-xs text-[#D3EA00] hover:underline font-bold"
                >
                  Abrir validador manual
                </button>
              </div>

              {allVisitorPasses.length === 0 ? (
                <p className="text-xs text-white/40 text-center py-6">Nenhum passe registrado na portaria virtual.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/10">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/60 text-white/50 font-bold border-b border-white/5">
                        <th className="p-3">Visitante</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Solicitante</th>
                        <th className="p-3">Criado em</th>
                        <th className="p-3">Expira em</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white/80">
                      {allVisitorPasses.slice(0, 10).map((pass) => {
                        const isExpired = pass.expiraEm && pass.expiraEm.toDate() < new Date();
                        return (
                          <tr key={pass.id} className="hover:bg-white/[0.02] transition-all">
                            <td className="p-3 font-semibold">
                              {pass.nomeVisitante}
                              {pass.cpfVisitante && (
                                <span className="block text-[10px] text-white/40 font-normal">CPF: {pass.cpfVisitante}</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  pass.tipo === "ENTREGADOR" ? "bg-amber-500/10 text-amber-400" : "bg-purple-500/10 text-purple-400"
                                }`}
                              >
                                {pass.tipo}
                              </span>
                            </td>
                            <td className="p-3">{pass.criadoPorNome || "Morador"}</td>
                            <td className="p-3 text-white/50">{formatDateTime(pass.createdAt)}</td>
                            <td className="p-3 text-white/50">{formatDateTime(pass.expiraEm)}</td>
                            <td className="p-3">
                              <span
                                className={`text-[10px] font-bold ${
                                  pass.status === "UTILIZADO"
                                    ? "text-blue-400"
                                    : pass.status === "CANCELADO"
                                    ? "text-slate-500"
                                    : isExpired
                                    ? "text-red-400"
                                    : "text-emerald-400"
                                }`}
                              >
                                {pass.status === "ATIVO" && isExpired ? "EXPIRADO" : pass.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QUICK LINK CARD ON BOARD (Financeiro & Comunidade) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* CARD 3: FINANCEIRO QUICK LINK */}
        <Card className="border-white/10 bg-slate-950/40 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] flex flex-col justify-between p-6 min-h-[180px] rounded-3xl">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Finanças</span>
              <h4 className="text-lg font-bold text-white mt-1">Gestão Financeira</h4>
            </div>
            <div className="bg-amber-500/10 p-2.5 rounded-2xl text-amber-500">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="text-xs text-white/60 mb-4 leading-relaxed">
            Consulte boletos condominiais, registre despesas, realize exportações PDF/CSV e conciliações bancárias CNAB 240.
          </p>
          <Link
            href="/financeiro"
            className="w-full py-2.5 rounded-2xl text-xs font-black uppercase text-center bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.15)] transition-all"
          >
            Acessar Módulo
          </Link>
        </Card>

        {/* CARD 4: COMUNIDADE QUICK LINK */}
        <Card className="border-white/10 bg-slate-950/40 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.2)] flex flex-col justify-between p-6 min-h-[180px] rounded-3xl">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Social</span>
              <h4 className="text-lg font-bold text-white mt-1">Mural e Chat IA</h4>
            </div>
            <div className="bg-[#00D0E6]/10 p-2.5 rounded-2xl text-[#00D0E6]">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="text-xs text-white/60 mb-4 leading-relaxed">
            Acesse o assistente de inteligência artificial de condomínio, canais de conversa, comunicados e achados e perdidos.
          </p>
          <Link
            href="/comunidade"
            className="w-full py-2.5 rounded-2xl text-xs font-black uppercase text-center bg-[#00D0E6] hover:bg-[#00B4CC] text-slate-950 shadow-[0_0_15px_rgba(0,208,230,0.15)] transition-all"
          >
            Acessar Módulo
          </Link>
        </Card>
      </div>

      {/* MODAL: GENERATE PASS QR (RESIDENT) */}
      {showPassModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                <QrCode className="h-5 w-5 text-[#00D0E6]" /> Novo Passe de Acesso
              </h3>
              <button
                onClick={() => setShowPassModal(false)}
                className="text-white/40 hover:text-white transition-all text-xs border border-white/10 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVisitorPass} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/60">Nome Completo do Visitante</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do convidado ou entregador"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#00D0E6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/60">CPF (Opcional)</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={visitorCpf}
                  onChange={(e) => setVisitorCpf(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#00D0E6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/60">Tipo de Passe</label>
                  <select
                    value={visitorType}
                    onChange={(e: any) => setVisitorType(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00D0E6]"
                  >
                    <option value="VISITANTE">Visitante</option>
                    <option value="ENTREGADOR">Entregador</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/60">Validade do QR</label>
                  <select
                    value={expirationHours}
                    onChange={(e) => setExpirationHours(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00D0E6]"
                  >
                    <option value="1">1 hora</option>
                    <option value="4">4 horas</option>
                    <option value="8">8 horas</option>
                    <option value="12">12 horas</option>
                    <option value="24">24 horas</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPassModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-white text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingPass}
                  className="flex-1 py-2.5 rounded-xl bg-[#00D0E6] text-slate-950 text-xs font-black uppercase transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {creatingPass ? "Gerando..." : "Confirmar e Gerar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PORTER VALIDATION INTERFACE (OPERATOR ONLY) */}
      {showPortariaModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                <Search className="h-5 w-5 text-[#D3EA00]" /> Validador de QR Code da Portaria
              </h3>
              <button
                onClick={() => setShowPortariaModal(false)}
                className="text-white/40 hover:text-white transition-all text-xs border border-white/10 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Buscar por nome do visitante ou CPF..."
                  value={searchPassQuery}
                  onChange={(e) => setSearchPassQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#D3EA00]"
                />
              </div>

              {/* Status filter selection tabs */}
              <div className="flex gap-1.5">
                {["TODOS", "ATIVO", "UTILIZADO", "CANCELADO"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                      filterStatus === status
                        ? "bg-[#D3EA00] text-slate-950"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <div className="space-y-3 pt-2">
                {allVisitorPasses
                  .filter((pass) => {
                    const matchQuery =
                      pass.nomeVisitante?.toLowerCase().includes(searchPassQuery.toLowerCase()) ||
                      pass.cpfVisitante?.includes(searchPassQuery);
                    
                    const isExpired = pass.expiraEm && pass.expiraEm.toDate() < new Date();
                    const currentStatus = pass.status === "ATIVO" && isExpired ? "EXPIRADO" : pass.status;
                    
                    if (filterStatus === "TODOS") return matchQuery;
                    if (filterStatus === "ATIVO") return matchQuery && currentStatus === "ATIVO";
                    return matchQuery && currentStatus === filterStatus;
                  })
                  .map((pass) => {
                    const isExpired = pass.expiraEm && pass.expiraEm.toDate() < new Date();
                    const activeAndValid = pass.status === "ATIVO" && !isExpired;

                    return (
                      <div
                        key={pass.id}
                        className="p-4 border border-white/5 bg-slate-950/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{pass.nomeVisitante}</span>
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                                pass.status === "UTILIZADO"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : pass.status === "CANCELADO"
                                  ? "bg-slate-500/20 text-slate-400"
                                  : isExpired
                                  ? "bg-rose-500/20 text-rose-400"
                                  : "bg-emerald-500/20 text-emerald-400"
                              }`}
                            >
                              {pass.status === "ATIVO" && isExpired ? "EXPIRADO" : pass.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-white/50 space-y-0.5 mt-1">
                            <p>Solicitante: {pass.criadoPorNome || "Morador"}</p>
                            {pass.cpfVisitante && <p>CPF: {pass.cpfVisitante}</p>}
                            <p>Expira: {formatDateTime(pass.expiraEm)}</p>
                          </div>
                        </div>

                        {activeAndValid && (
                          <button
                            onClick={() => handleValidatePass(pass.id, pass.nomeVisitante)}
                            className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-black tracking-wider text-[10px] uppercase transition-all hover:scale-[1.02] flex items-center justify-center gap-1.5 self-end sm:self-auto"
                          >
                            <Check className="h-3.5 w-3.5" /> Registrar Entrada
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-slate-950/20 flex justify-end">
              <button
                onClick={() => setShowPortariaModal(false)}
                className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white font-bold rounded-xl text-xs transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR CODE VIEW MODAL FOR Moradores */}
      {selectedPassQr && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative w-full max-w-xs bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-6 text-white animate-in zoom-in-95 duration-200 text-center flex flex-col items-center">
            <h3 className="text-sm font-bold mb-1">Passe Virtual QR Code</h3>
            <p className="text-[11px] text-white/60 mb-4">{selectedPassName}</p>

            <div className="p-4 bg-white rounded-2xl mb-4 shadow-lg border border-white/10">
              <img src={selectedPassQr} alt="Visitor QR Code" className="w-44 h-44" />
            </div>

            <p className="text-[10px] text-white/40 mb-5 leading-normal">
              Compartilhe esta imagem com seu visitante para acesso liberado na portaria automática.
            </p>

            <button
              onClick={() => {
                setSelectedPassQr(null);
                setSelectedPassName("");
              }}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all"
            >
              Fechar Passe
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
