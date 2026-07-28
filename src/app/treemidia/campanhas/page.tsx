"use client";

import * as React from "react";
import {
  collection,
  addDoc,
  setDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, initializeFirebase } from "@/firebase";
import { useSessionCtx } from "@/contexts/SessionContext";
import { 
  Megaphone, 
  AlertTriangle, 
  Heart, 
  Coins, 
  Lightbulb, 
  Newspaper, 
  Calendar, 
  Info,
  Clock,
  Plus
} from "lucide-react";

type Campanha = {
  id: string;
  titulo: string;
  descricao: string;
  tipo:
    | "comunicado"
    | "aviso"
    | "saude"
    | "financas"
    | "voce_sabia"
    | "noticia"
    | "evento"
    | "anuncio"
    | "patrocinado";
  imagemUrl: string | null;
  ativo: boolean;
  duracaoSegundos: number;
  prioridade: number;
  dataInicio?: Timestamp | null;
  dataFim?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

const TIPO_LABELS: Record<Campanha["tipo"], string> = {
  comunicado: "Comunicado",
  aviso: "Aviso",
  saude: "Saúde",
  financas: "Finanças",
  voce_sabia: "Você Sabia",
  noticia: "Notícia",
  evento: "Evento",
  anuncio: "Anúncio",
  patrocinado: "Patrocinado",
};

export default function CampanhasPage() {
  const firestore = useFirestore();
  const { session, isSessionLoading } = useSessionCtx();
  const { toast } = useToast();

  const [campanhas, setCampanhas] = React.useState<Campanha[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [current, setCurrent] = React.useState<Campanha | null>(null);

  // Form states
  const [titulo, setTitulo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [tipo, setTipo] = React.useState<Campanha["tipo"]>("comunicado");
  const [ativo, setAtivo] = React.useState(true);
  const [duracaoSegundos, setDuracaoSegundos] = React.useState(10);
  const [prioridade, setPrioridade] = React.useState(5);
  const [dataInicio, setDataInicio] = React.useState("");
  const [dataFim, setDataFim] = React.useState("");
  const [fotoFile, setFotoFile] = React.useState<File | null>(null);
  const [fotoUrlPreview, setFotoUrlPreview] = React.useState<string | null>(null);
  const [aspectWarning, setAspectWarning] = React.useState(false);

  const condominioAtivoId = session?.activeCondominioId || null;

  // Permissões de acesso
  const isAllowed = React.useMemo(() => {
    if (!session) return false;
    const allowedRoles = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];
    return allowedRoles.includes(session.role);
  }, [session]);

  React.useEffect(() => {
    if (!firestore || !condominioAtivoId || !isAllowed) {
      setCampanhas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = collection(firestore, `condominios/${condominioAtivoId}/treemidia_campanhas`);
    const q = query(ref, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setCampanhas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Campanha)));
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast({ variant: "destructive", title: "Erro ao carregar campanhas." });
      setLoading(false);
    });
    return unsub;
  }, [firestore, condominioAtivoId, isAllowed, toast]);

  const openDialog = (item: Campanha | null) => {
    setCurrent(item);
    setTitulo(item?.titulo ?? "");
    setDescricao(item?.descricao ?? "");
    setTipo(item?.tipo ?? "comunicado");
    setAtivo(item?.ativo ?? true);
    setDuracaoSegundos(item?.duracaoSegundos ?? 10);
    setPrioridade(item?.prioridade ?? 5);
    setDataInicio(item?.dataInicio ? new Date(item.dataInicio.seconds * 1000).toISOString().split("T")[0] : "");
    setDataFim(item?.dataFim ? new Date(item.dataFim.seconds * 1000).toISOString().split("T")[0] : "");
    setFotoFile(null);
    setFotoUrlPreview(item?.imagemUrl ?? null);
    setAspectWarning(false);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !condominioAtivoId) return;
    if (!titulo.trim() || !descricao.trim()) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Título e descrição são obrigatórios.",
      });
      return;
    }

    if (duracaoSegundos < 5 || duracaoSegundos > 60) {
      toast({
        variant: "destructive",
        title: "Duração inválida",
        description: "A duração deve ser entre 5 e 60 segundos.",
      });
      return;
    }

    if (prioridade < 1 || prioridade > 10) {
      toast({
        variant: "destructive",
        title: "Prioridade inválida",
        description: "A prioridade deve ser entre 1 e 10.",
      });
      return;
    }

    setSaving(true);
    try {
      const { app } = initializeFirebase();
      const storage = getStorage(app);
      const collectionRef = collection(firestore, `condominios/${condominioAtivoId}/treemidia_campanhas`);
      
      let docRef;
      let docId;

      if (current) {
        docRef = doc(collectionRef, current.id);
        docId = current.id;
      } else {
        docRef = doc(collectionRef);
        docId = docRef.id;
      }

      let finalImagemUrl = current?.imagemUrl ?? null;

      if (fotoFile) {
        // Envia imagem para Firebase Storage
        const fileExt = fotoFile.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const storageRef = ref(storage, `condominios/${condominioAtivoId}/treemidia/campanhas/${docId}/${fileName}`);
        
        await uploadBytes(storageRef, fotoFile);
        finalImagemUrl = await getDownloadURL(storageRef);
      }

      const payload = {
        titulo,
        descricao,
        tipo,
        imagemUrl: finalImagemUrl,
        ativo,
        duracaoSegundos,
        prioridade,
        dataInicio: dataInicio ? Timestamp.fromDate(new Date(dataInicio + "T00:00:00")) : null,
        dataFim: dataFim ? Timestamp.fromDate(new Date(dataFim + "T23:59:59")) : null,
        updatedAt: serverTimestamp(),
      };

      if (current) {
        await updateDoc(docRef, payload);
        toast({ title: "Campanha atualizada com sucesso!" });
      } else {
        await setDoc(docRef, {
          ...payload,
          id: docId,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Campanha criada com sucesso!" });
      }
      setOpen(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: e.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Campanha) => {
    if (!firestore || !condominioAtivoId) return;
    if (!confirm("Tem certeza que deseja remover esta campanha?")) return;
    try {
      // Deleta documento do Firestore
      await deleteDoc(doc(firestore, `condominios/${condominioAtivoId}/treemidia_campanhas`, item.id));

      // Deleta imagem correspondente do Storage se houver
      if (item.imagemUrl) {
        try {
          const { app } = initializeFirebase();
          const storage = getStorage(app);
          // O Storage ref pode ser extraído da própria URL ou podemos tentar deletar usando a referência direta.
          // Como as imagens estão salvas em treemidia/campanhas/{campanhaId}/{fileName}, podemos instanciar.
          // Mas uma forma segura e direta é obter o ref a partir da URL.
          const storageRef = ref(storage, item.imagemUrl);
          await deleteObject(storageRef);
        } catch (storageErr) {
          console.warn("Erro ao deletar imagem do Storage (pode já ter sido removida):", storageErr);
        }
      }

      toast({ title: "Campanha excluída." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: e.message,
      });
    }
  };

  const getStatusCampanha = (camp: Campanha) => {
    const now = new Date();
    
    if (camp.dataFim) {
      const dataFim = new Date(camp.dataFim.seconds * 1000);
      if (now > dataFim) return "expirada";
    }
    
    if (camp.dataInicio) {
      const dataInicio = new Date(camp.dataInicio.seconds * 1000);
      if (now < dataInicio) return "agendada";
    }
    
    return camp.ativo ? "ativa" : "inativa";
  };

  // KPIs
  const stats = React.useMemo(() => {
    const total = campanhas.length;
    let ativas = 0;
    let agendadas = 0;
    let expiradas = 0;

    campanhas.forEach((c) => {
      const status = getStatusCampanha(c);
      if (status === "ativa") {
        ativas++;
      } else if (status === "agendada") {
        agendadas++;
      } else if (status === "expirada") {
        expiradas++;
      }
    });

    const tipos = campanhas.reduce((acc, c) => {
      acc[c.tipo] = (acc[c.tipo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, ativas, agendadas, expiradas, tipos };
  }, [campanhas]);

  if (isSessionLoading) {
    return (
      <AppLayout pageTitle="Mídia — Campanhas e Conteúdos">
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-slate-600 dark:text-slate-300">Carregando sessão...</p>
        </div>
      </AppLayout>
    );
  }

  if (!isAllowed) {
    return (
      <AppLayout pageTitle="Mídia — Acesso Restrito">
        <Card className="border-white/20 bg-white/20 backdrop-blur-2xl shadow-lg text-white">
          <CardHeader>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription className="text-white/70">
              Esta área é exclusiva para gestores e administradores do condomínio.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-white/80">
            Caso precise gerenciar campanhas da TreeMídia, solicite permissão ao administrador do condomínio.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      pageTitle="Mídia — Campanhas e Conteúdos"
      headerActions={
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold rounded-xl"
          onClick={() => openDialog(null)}
        >
          Nova Campanha
        </Button>
      }
    >
      <div className="space-y-6">
        {/* KPI Section */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-white/10 bg-white/10 backdrop-blur-md text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Total de Campanhas</CardDescription>
              <CardTitle className="text-3xl font-extrabold">{stats.total}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-white/10 bg-white/10 backdrop-blur-md text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Ativas</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-emerald-400 flex items-center gap-2">
                <span>🟢</span> {stats.ativas}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-white/10 bg-white/10 backdrop-blur-md text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Agendadas</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-yellow-400 flex items-center gap-2">
                <span>🟡</span> {stats.agendadas}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-white/10 bg-white/10 backdrop-blur-md text-white">
            <CardHeader className="pb-2">
              <CardDescription className="text-white/60 text-xs font-semibold uppercase tracking-wider">Expiradas</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-red-400 flex items-center gap-2">
                <span>🔴</span> {stats.expiradas}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* List Table Card */}
        <Card className="border-white/20 bg-white/20 backdrop-blur-2xl shadow-[0_18px_55px_rgba(2,6,23,0.14)] text-white">
          <CardHeader>
            <CardTitle className="text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.30)]">Campanhas Programadas</CardTitle>
            <CardDescription className="text-white/70">
              Gerencie avisos, comunicados e anúncios veiculados nas telas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!condominioAtivoId ? (
              <p className="text-white/75">Selecione um condomínio para visualizar.</p>
            ) : loading ? (
              <p className="text-white/75">Carregando...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campanhas.length === 0 ? (
                  <div className="col-span-full text-center text-white/75 py-12 bg-white/5 rounded-2xl border border-white/10">
                    Nenhuma campanha cadastrada neste condomínio.
                  </div>
                ) : (
                  campanhas.map((item) => {
                    const status = getStatusCampanha(item);
                    
                    let bgGradient = "from-slate-800 to-slate-900";
                    let iconColor = "text-[#00beea]";
                    let IconComponent = Megaphone;

                    switch (item.tipo) {
                      case "voce_sabia":
                        bgGradient = "from-indigo-950 to-slate-900";
                        iconColor = "text-indigo-400";
                        IconComponent = Lightbulb;
                        break;
                      case "saude":
                        bgGradient = "from-emerald-950 to-slate-900";
                        iconColor = "text-emerald-400";
                        IconComponent = Heart;
                        break;
                      case "financas":
                        bgGradient = "from-amber-950 to-slate-900";
                        iconColor = "text-amber-400";
                        IconComponent = Coins;
                        break;
                      case "evento":
                        bgGradient = "from-purple-950 to-slate-900";
                        iconColor = "text-purple-400";
                        IconComponent = Calendar;
                        break;
                      case "anuncio":
                        bgGradient = "from-cyan-950 to-slate-900";
                        iconColor = "text-cyan-400";
                        IconComponent = Megaphone;
                        break;
                      case "aviso":
                        bgGradient = "from-rose-950 to-slate-900";
                        iconColor = "text-rose-400";
                        IconComponent = AlertTriangle;
                        break;
                      case "noticia":
                        bgGradient = "from-blue-950 to-slate-900";
                        iconColor = "text-blue-400";
                        IconComponent = Newspaper;
                        break;
                      default:
                        bgGradient = "from-slate-800 to-slate-900";
                        iconColor = "text-slate-400";
                        IconComponent = Info;
                        break;
                    }

                    return (
                      <div key={item.id} className="border border-white/10 bg-white/5 backdrop-blur-md text-white shadow-lg rounded-2xl flex flex-col overflow-hidden hover:bg-white/[0.08] transition duration-200">
                        {/* Upper Preview Section */}
                        <div className="h-44 relative flex items-center justify-center border-b border-white/5 overflow-hidden">
                          {item.imagemUrl ? (
                            <img
                              src={item.imagemUrl}
                              alt={item.titulo}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${bgGradient} flex flex-col items-center justify-center p-4 text-center relative`}>
                              <div className="absolute inset-0 bg-black/20" />
                              <div className="relative z-10 space-y-2">
                                <IconComponent className={`h-12 w-12 ${iconColor} mx-auto animate-pulse`} />
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded border border-white/10">
                                  {TIPO_LABELS[item.tipo] || item.tipo}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Top Right Status Badge */}
                          <div className="absolute top-3 right-3 z-20">
                            {status === "ativa" && (
                              <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                                🟢 Ativa
                              </span>
                            )}
                            {status === "agendada" && (
                              <span className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                                🟡 Agendada
                              </span>
                            )}
                            {status === "expirada" && (
                              <span className="bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                                🔴 Expirada
                              </span>
                            )}
                            {status === "inativa" && (
                              <span className="bg-white/10 border border-white/20 text-white/60 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                                ⚪ Inativa
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Info Content */}
                        <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                          <div className="space-y-1">
                            <h4 className="font-bold text-base text-[#00beea] truncate">{item.titulo}</h4>
                            <p className="text-white/60 text-xs line-clamp-2">{item.descricao}</p>
                          </div>

                          <div className="space-y-3">
                            {/* Metadata */}
                            <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-white/50 border-t border-white/5 pt-3">
                              <div>
                                ⏱ Duração: <span className="text-white">{item.duracaoSegundos}s</span>
                              </div>
                              <div>
                                ⚡ Prioridade: <span className="text-white">{item.prioridade}/10</span>
                              </div>
                              <div className="col-span-2 mt-1 truncate">
                                📅 Início: <span className="text-white">{item.dataInicio ? new Date(item.dataInicio.seconds * 1000).toLocaleDateString("pt-BR") : "Sempre"}</span>
                              </div>
                              <div className="col-span-2 truncate">
                                📅 Fim: <span className="text-white">{item.dataFim ? new Date(item.dataFim.seconds * 1000).toLocaleDateString("pt-BR") : "Sempre"}</span>
                              </div>
                            </div>

                            {/* Actions Row */}
                            <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-3">
                              <Button
                                variant="outline"
                                className="border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25 text-white size-sm rounded-xl font-medium"
                                size="sm"
                                onClick={() => openDialog(item)}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white shadow-sm rounded-xl font-medium"
                                onClick={() => handleDelete(item)}
                              >
                                Excluir
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Creation/Edition Dialog Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="tc-dialog-center max-w-md bg-slate-900 border border-white/20 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {current ? "✏️ Editar Campanha" : "📢 Nova Campanha"}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Insira as informações de conteúdo para a campanha de TreeMídia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1">
              <Label htmlFor="titulo" className="text-xs font-semibold text-white/80">Título da Campanha</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Assembleia Geral do Condomínio"
                className="bg-black/45 border-white/10 text-white rounded-xl placeholder:text-white/35 focus-visible:ring-[#00beea]"
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="descricao" className="text-xs font-semibold text-white/80">Descrição / Texto Alternativo</Label>
              <Input
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Próxima terça-feira no salão de festas às 20h"
                className="bg-black/45 border-white/10 text-white rounded-xl placeholder:text-white/35 focus-visible:ring-[#00beea]"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="tipo" className="text-xs font-semibold text-white/80">Tipo de Campanha</Label>
              <select
                id="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as any)}
                className="w-full bg-black/45 border border-white/10 text-white rounded-xl h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#00beea]"
              >
                {Object.entries(TIPO_LABELS).map(([k, label]) => (
                  <option key={k} className="bg-slate-900" value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="duracao" className="text-xs font-semibold text-white/80">Duração (5s - 60s)</Label>
                <Input
                  id="duracao"
                  type="number"
                  min={5}
                  max={60}
                  value={duracaoSegundos}
                  onChange={(e) => setDuracaoSegundos(Number(e.target.value))}
                  className="bg-black/45 border-white/10 text-white rounded-xl focus-visible:ring-[#00beea]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="prioridade" className="text-xs font-semibold text-white/80">Prioridade (1 - 10)</Label>
                <Input
                  id="prioridade"
                  type="number"
                  min={1}
                  max={10}
                  value={prioridade}
                  onChange={(e) => setPrioridade(Number(e.target.value))}
                  className="bg-black/45 border-white/10 text-white rounded-xl focus-visible:ring-[#00beea]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-white/80">Imagem da Campanha</Label>
              
              {/* Informative Banner */}
              <div className="bg-slate-900/40 border border-white/10 rounded-xl p-3.5 mb-3 text-xs space-y-2">
                <div className="font-bold text-white flex items-center gap-1.5 text-slate-300">
                  <span>📱</span> Formato de Mídia Recomendado
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
                  <ul className="list-disc list-inside text-white/70 space-y-1">
                    <li>Resolução ideal: <strong className="text-white">1080 x 1920 px</strong></li>
                    <li>Proporção: <strong className="text-white">Vertical (9:16)</strong></li>
                    <li>Formatos: <strong className="text-white">PNG, JPG, WEBP</strong></li>
                    <li>Tamanho: <strong className="text-white">Até 10MB</strong></li>
                  </ul>
                  <div className="flex flex-col items-center gap-1 bg-black/60 border border-white/10 rounded-lg p-2 shrink-0">
                    <div className="w-8 h-14 border-2 border-[#00beea]/60 rounded bg-slate-950 flex flex-col justify-between items-center text-[7px] font-black text-[#00beea] p-1">
                      <span>📱</span>
                      <span>9:16</span>
                    </div>
                    <span className="text-[9px] font-bold text-white/40">Vertical</span>
                  </div>
                </div>
              </div>

              {/* Upload area & preview */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center border border-dashed border-white/20 hover:bg-white/5 transition rounded-xl h-20 cursor-pointer p-2 text-center text-xs text-white/60">
                    <span>📸 Escolher Imagem (Até 10MB)</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.currentTarget.files?.[0];
                        if (!file) return;
                        
                        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
                        if (!allowedTypes.includes(file.type)) {
                          toast({ variant: "destructive", title: "Formato inválido", description: "Use JPG, JPEG, PNG ou WEBP." });
                          return;
                        }

                        if (file.size > 10 * 1024 * 1024) {
                          toast({ variant: "destructive", title: "Arquivo excedeu 10MB", description: "Escolha uma imagem menor." });
                          return;
                        }

                        setFotoFile(file);
                        const previewUrl = URL.createObjectURL(file);
                        setFotoUrlPreview(previewUrl);

                        // Check aspect ratio
                        const img = new Image();
                        img.src = previewUrl;
                        img.onload = () => {
                          const aspect = img.width / img.height;
                          // ideal aspect is 9/16 = 0.5625. Warn if deviates outside 0.5 and 0.65
                          if (aspect < 0.5 || aspect > 0.65) {
                            setAspectWarning(true);
                          } else {
                            setAspectWarning(false);
                          }
                        };
                      }}
                    />
                  </label>

                  {fotoUrlPreview && (
                    <div className="relative shrink-0">
                      <img
                        src={fotoUrlPreview}
                        alt="Preview"
                        className="h-20 w-11 object-cover rounded-md border border-white/20 shadow-md"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFotoFile(null);
                          setFotoUrlPreview(null);
                          setAspectWarning(false);
                        }}
                        className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-md hover:bg-red-500 transition"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                {aspectWarning && (
                  <div className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5">
                    <span>⚠️</span> Esta imagem não está no formato ideal para elevadores.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="dataInicio" className="text-xs font-semibold text-white/80">Data de Início (Opcional)</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="bg-black/45 border-white/10 text-white rounded-xl focus-visible:ring-[#00beea]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dataFim" className="text-xs font-semibold text-white/80">Data de Fim (Opcional)</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="bg-black/45 border-white/10 text-white rounded-xl focus-visible:ring-[#00beea]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="status" className="text-xs font-semibold text-white/80">Status de Exibição</Label>
              <select
                id="status"
                value={ativo ? "true" : "false"}
                onChange={(e) => setAtivo(e.target.value === "true")}
                className="w-full bg-black/45 border border-white/10 text-white rounded-xl h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#00beea]"
              >
                <option className="bg-slate-900" value="true">🟢 Ativa</option>
                <option className="bg-slate-900" value="false">⚪ Inativa</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-white/10 bg-transparent text-white hover:bg-white/5 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#00beea] hover:bg-[#00beea]/80 text-slate-950 font-bold rounded-xl"
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
