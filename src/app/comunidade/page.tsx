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
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ShoppingBag, 
  HelpCircle, 
  Wrench, 
  Plus, 
  Trash2, 
  MessageCircle, 
  Search,
  CheckCircle,
  Bot,
  Video
} from "lucide-react";
import Link from "next/link";

import { useCondominio } from "@/contexts/CondominioContext";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

type Classificado = {
  id: string;
  titulo: string;
  descricao: string;
  preco: number;
  categoria: string;
  status: "ativo" | "vendido";
  criadoPor: string;
  criadoPorNome: string;
  contato: string;
  createdAt: any;
};

type AchadoPerdido = {
  id: string;
  item: string;
  descricao: string;
  local: string;
  tipo: "achado" | "perdido";
  status: "ativo" | "devolvido";
  criadoPor: string;
  criadoPorNome: string;
  createdAt: any;
};

type ServicoIndicado = {
  id: string;
  nomeProfissional: string;
  categoria: string;
  telefone: string;
  indicadoPor: string;
  indicadoPorNome: string;
  recomendacao: string;
  createdAt: any;
};

export default function ComunidadePage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { session } = useSessionCtx();
  const { condominioAtivoId, vinculoAtivo } = useCondominio();

  const isOperator =
    !!session?.superAdmin ||
    vinculoAtivo?.role === "SINDICO" ||
    vinculoAtivo?.role === "ADMIN" ||
    vinculoAtivo?.role === "ADMIN_CONDOMINIO";

  const currentUid = session?.user?.uid ?? "";
  const currentUserName = (session as any)?.userName || session?.user?.displayName || "Morador";

  // Firestore collections & queries
  const classificadosRef = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId) return null;
    return query(collection(firestore, `condominios/${condominioAtivoId}/classificados`), orderBy("createdAt", "desc"));
  }, [firestore, condominioAtivoId]);

  const { data: classificadosRaw, isLoading: isLoadingClassificados } = useCollection<Classificado>(classificadosRef);
  const classificados = useMemo(() => (classificadosRaw || []) as Classificado[], [classificadosRaw]);

  const achadosRef = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId) return null;
    return query(collection(firestore, `condominios/${condominioAtivoId}/achados-perdidos`), orderBy("createdAt", "desc"));
  }, [firestore, condominioAtivoId]);

  const { data: achadosRaw, isLoading: isLoadingAchados } = useCollection<AchadoPerdido>(achadosRef);
  const achados = useMemo(() => (achadosRaw || []) as AchadoPerdido[], [achadosRaw]);

  const servicosRef = useMemoFirebase(() => {
    if (!firestore || !condominioAtivoId) return null;
    return query(collection(firestore, `condominios/${condominioAtivoId}/servicos-indicados`), orderBy("createdAt", "desc"));
  }, [firestore, condominioAtivoId]);

  const { data: servicosRaw, isLoading: isLoadingServicos } = useCollection<ServicoIndicado>(servicosRef);
  const servicos = useMemo(() => (servicosRaw || []) as ServicoIndicado[], [servicosRaw]);

  // Modals visibility states
  const [classificadoOpen, setClassificadoOpen] = useState(false);
  const [achadoOpen, setAchadoOpen] = useState(false);
  const [servicoOpen, setServicoOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states — Classificado
  const [clTitulo, setClTitulo] = useState("");
  const [clDescricao, setClDescricao] = useState("");
  const [clPreco, setClPreco] = useState("");
  const [clCategoria, setClCategoria] = useState("Móveis");
  const [clContato, setClContato] = useState("");

  // Form states — Achado e Perdido
  const [acItem, setAcItem] = useState("");
  const [acDescricao, setAcDescricao] = useState("");
  const [acLocal, setAcLocal] = useState("");
  const [acTipo, setAcTipo] = useState<"achado" | "perdido">("achado");

  // Form states — Serviço Indicado
  const [seNome, setSeNome] = useState("");
  const [seCategoria, setSeCategoria] = useState("Eletricista");
  const [seTelefone, setSeTelefone] = useState("");
  const [seRecomendacao, setSeRecomendacao] = useState("");

  // Search filter states
  const [searchQuery, setSearchQuery] = useState("");

  // Formatação de link do WhatsApp
  const formatWhatsappUrl = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const ddiPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    return `https://wa.me/${ddiPhone}?text=${encodeURIComponent(text)}`;
  };

  // handlers - Classificados
  const handleSaveClassificado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !condominioAtivoId) return;
    if (!clTitulo.trim() || !clContato.trim()) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Informe o título do desapego e o WhatsApp de contato." });
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(firestore, `condominios/${condominioAtivoId}/classificados`), {
        titulo: clTitulo.trim(),
        descricao: clDescricao.trim(),
        preco: Number(clPreco) || 0,
        categoria: clCategoria,
        status: "ativo",
        criadoPor: currentUid,
        criadoPorNome: currentUserName,
        contato: clContato.trim(),
        createdAt: serverTimestamp(),
      });
      toast({ title: "Anúncio publicado nos classificados!" });
      setClassificadoOpen(false);
      setClTitulo("");
      setClDescricao("");
      setClPreco("");
      setClContato("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao publicar anúncio", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleMarcarVendido = async (id: string) => {
    if (!firestore || !condominioAtivoId) return;
    try {
      await updateDoc(doc(firestore, `condominios/${condominioAtivoId}/classificados`, id), {
        status: "vendido",
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Anúncio atualizado como vendido!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao atualizar anúncio", description: err.message });
    }
  };

  const handleDeleteClassificado = async (id: string) => {
    if (!confirm("Excluir este anúncio?") || !firestore || !condominioAtivoId) return;
    try {
      await deleteDoc(doc(firestore, `condominios/${condominioAtivoId}/classificados`, id));
      toast({ title: "Anúncio excluído." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao excluir", description: err.message });
    }
  };

  // handlers - Achados e Perdidos
  const handleSaveAchado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !condominioAtivoId) return;
    if (!acItem.trim()) {
      toast({ variant: "destructive", title: "Nome do item é obrigatório" });
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(firestore, `condominios/${condominioAtivoId}/achados-perdidos`), {
        item: acItem.trim(),
        descricao: acDescricao.trim(),
        local: acLocal.trim(),
        tipo: acTipo,
        status: "ativo",
        criadoPor: currentUid,
        criadoPorNome: currentUserName,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Item registrado no Mural de Achados & Perdidos!" });
      setAchadoOpen(false);
      setAcItem("");
      setAcDescricao("");
      setAcLocal("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao registrar item", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleMarcarDevolvido = async (id: string) => {
    if (!firestore || !condominioAtivoId) return;
    try {
      await updateDoc(doc(firestore, `condominios/${condominioAtivoId}/achados-perdidos`, id), {
        status: "devolvido",
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Status atualizado para devolvido." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao atualizar status", description: err.message });
    }
  };

  const handleDeleteAchado = async (id: string) => {
    if (!confirm("Excluir registro de achados/perdidos?") || !firestore || !condominioAtivoId) return;
    try {
      await deleteDoc(doc(firestore, `condominios/${condominioAtivoId}/achados-perdidos`, id));
      toast({ title: "Registro removido." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao excluir", description: err.message });
    }
  };

  // handlers - Serviços
  const handleSaveServico = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !condominioAtivoId) return;
    if (!seNome.trim() || !seTelefone.trim() || !seRecomendacao.trim()) {
      toast({ variant: "destructive", title: "Campos obrigatórios", description: "Por favor, preencha todos os campos do profissional." });
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(firestore, `condominios/${condominioAtivoId}/servicos-indicados`), {
        nomeProfissional: seNome.trim(),
        categoria: seCategoria,
        telefone: seTelefone.trim(),
        indicadoPor: currentUid,
        indicadoPorNome: currentUserName,
        recomendacao: seRecomendacao.trim(),
        createdAt: serverTimestamp(),
      });
      toast({ title: "Indicação registrada!" });
      setServicoOpen(false);
      setSeNome("");
      setSeTelefone("");
      setSeRecomendacao("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao indicar serviço", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteServico = async (id: string) => {
    if (!confirm("Excluir esta indicação de serviço?") || !firestore || !condominioAtivoId) return;
    try {
      await deleteDoc(doc(firestore, `condominios/${condominioAtivoId}/servicos-indicados`, id));
      toast({ title: "Indicação excluída." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao excluir", description: err.message });
    }
  };

  // Filtragem de dados por termo de pesquisa
  const filteredClassificados = useMemo(() => {
    return classificados.filter(
      (c) =>
        c.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.categoria.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [classificados, searchQuery]);

  const filteredAchados = useMemo(() => {
    return achados.filter(
      (a) =>
        a.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.local.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [achados, searchQuery]);

  const filteredServicos = useMemo(() => {
    return servicos.filter(
      (s) =>
        s.nomeProfissional.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.categoria.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.recomendacao.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [servicos, searchQuery]);

  if (!condominioAtivoId) {
    return (
      <AppLayout pageTitle="Comunidade">
        <Card className="tc-card-signature">
          <CardHeader>
            <CardTitle>Nenhum condomínio ativo</CardTitle>
            <CardDescription>Selecione um condomínio para acessar a área da comunidade.</CardDescription>
          </CardHeader>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Mural da Comunidade">
      <div className="space-y-6">
        {/* Barra de Filtro de Pesquisa e Chatbot */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar nos murais..."
              className="pl-11 h-11 rounded-xl bg-slate-900/50 border-white/10 text-white placeholder:text-white/30 focus:border-[#00D0E6] focus:ring-1 focus:ring-[#00D0E6]"
            />
          </div>
          <Link href="/comunidade/chatbot">
            <Button className="rounded-xl border border-[#00D0E6]/30 bg-[#00D0E6]/10 text-[#00D0E6] hover:bg-[#00D0E6]/20 font-bold flex items-center gap-1.5 transition">
              <Bot className="h-4.5 w-4.5" /> Conversar com TreeIA (Regras)
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="classificados" className="w-full">
          <TabsList className="grid grid-cols-4 w-full bg-white/5 border border-white/10 p-1 rounded-2xl mb-6">
            <TabsTrigger value="classificados" className="rounded-xl flex items-center gap-1.5 text-xs sm:text-sm">
              <ShoppingBag className="h-4 w-4" /> Classificados
            </TabsTrigger>
            <TabsTrigger value="achados" className="rounded-xl flex items-center gap-1.5 text-xs sm:text-sm">
              <HelpCircle className="h-4 w-4" /> Achados & Perdidos
            </TabsTrigger>
            <TabsTrigger value="servicos" className="rounded-xl flex items-center gap-1.5 text-xs sm:text-sm">
              <Wrench className="h-4 w-4" /> Serviços Indicados
            </TabsTrigger>
            <TabsTrigger value="cameras" className="rounded-xl flex items-center gap-1.5 text-xs sm:text-sm">
              <Video className="h-4 w-4" /> Câmeras CFTV
            </TabsTrigger>
          </TabsList>

          {/* CLASSIFICADOS CONTENT */}
          <TabsContent value="classificados" className="space-y-4 outline-none">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Classificados do Condomínio</h2>
                <p className="text-sm text-white/50">Negocie móveis, eletrônicos ou serviços com seus vizinhos com segurança.</p>
              </div>
              <Button 
                onClick={() => setClassificadoOpen(true)}
                className="rounded-xl bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none flex items-center gap-1.5 hover:scale-105 transition shrink-0"
              >
                <Plus className="h-4 w-4" /> Anunciar Item
              </Button>
            </div>

            {isLoadingClassificados ? (
              <p className="py-12 text-center text-white/50">Carregando classificados...</p>
            ) : filteredClassificados.length === 0 ? (
              <p className="py-12 text-center text-white/50">Nenhum anúncio encontrado.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClassificados.map((c) => (
                  <Card key={c.id} className="relative overflow-hidden bg-slate-950/40 border-white/10 text-white rounded-3xl flex flex-col justify-between">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-white/5 border border-white/10 text-[#00D0E6]">
                          {c.categoria}
                        </span>
                        {c.status === "vendido" && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-red-500/20 border border-red-500/30 text-red-400">
                            Vendido
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-lg font-bold text-white line-clamp-1">{c.titulo}</CardTitle>
                      <div className="text-xl font-black text-[#D3EA00] pt-1">
                        {c.preco > 0 ? `R$ ${c.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Doação / Grátis"}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                      <p className="text-sm text-white/70 min-h-[40px] line-clamp-3 leading-relaxed">{c.descricao}</p>
                      <div className="text-[11px] text-white/40 pt-2 border-t border-white/5">
                        Anunciado por: <span className="font-semibold text-white/60">{c.criadoPorNome}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        {c.status === "ativo" && (
                          <a
                            href={formatWhatsappUrl(c.contato, `Olá ${c.criadoPorNome}, vi seu anúncio do item "${c.titulo}" no mural do TreeCondo e gostaria de mais informações.`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                          >
                            <MessageCircle className="h-4 w-4" /> Falar com Vendedor
                          </a>
                        )}
                        {c.criadoPor === currentUid && c.status === "ativo" && (
                          <Button variant="outline" size="sm" className="h-10 text-xs text-white border-white/20 hover:bg-white/10 rounded-xl" onClick={() => handleMarcarVendido(c.id)}>
                            Marcar Vendido
                          </Button>
                        )}
                        {(c.criadoPor === currentUid || isOperator) && (
                          <Button size="icon" variant="ghost" className="h-10 w-10 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl" onClick={() => handleDeleteClassificado(c.id)}>
                            <Trash2 className="h-4.5 w-4.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ACHADOS E PERDIDOS CONTENT */}
          <TabsContent value="achados" className="space-y-4 outline-none">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Mural de Achados & Perdidos</h2>
                <p className="text-sm text-white/50">Ajude vizinhos a encontrar pets, documentos ou pertences perdidos.</p>
              </div>
              <Button 
                onClick={() => setAchadoOpen(true)}
                className="rounded-xl bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none flex items-center gap-1.5 hover:scale-105 transition shrink-0"
              >
                <Plus className="h-4 w-4" /> Registrar Item
              </Button>
            </div>

            {isLoadingAchados ? (
              <p className="py-12 text-center text-white/50">Carregando achados e perdidos...</p>
            ) : filteredAchados.length === 0 ? (
              <p className="py-12 text-center text-white/50">Nenhum item registrado no mural.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAchados.map((a) => (
                  <Card key={a.id} className="relative overflow-hidden bg-slate-950/40 border-white/10 text-white rounded-3xl flex flex-col justify-between">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${
                          a.tipo === "achado" 
                            ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" 
                            : "bg-amber-500/20 border-amber-500/30 text-amber-400"
                        }`}>
                          {a.tipo === "achado" ? "Achado" : "Perdido"}
                        </span>
                        {a.status === "devolvido" && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-white/10 border border-white/15 text-white/60">
                            Resolvido / Devolvido
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-lg font-bold text-white line-clamp-1">{a.item}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                      <p className="text-sm text-white/70 min-h-[40px] line-clamp-3 leading-relaxed">{a.descricao}</p>
                      <div className="text-xs bg-white/5 rounded-xl p-3 space-y-1">
                        <div><span className="text-white/40">Local aproximado:</span> <span className="font-semibold text-white/80">{a.local}</span></div>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-2">
                        {a.status === "ativo" && (isOperator || a.criadoPor === currentUid) && (
                          <Button size="sm" className="h-10 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-xl flex items-center gap-1" onClick={() => handleMarcarDevolvido(a.id)}>
                            <CheckCircle className="h-4 w-4" /> Marcar Devolvido
                          </Button>
                        )}
                        {(a.criadoPor === currentUid || isOperator) && (
                          <Button size="icon" variant="ghost" className="h-10 w-10 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl" onClick={() => handleDeleteAchado(a.id)}>
                            <Trash2 className="h-4.5 w-4.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* SERVIÇOS INDICADOS CONTENT */}
          <TabsContent value="servicos" className="space-y-4 outline-none">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Serviços Indicados</h2>
                <p className="text-sm text-white/50">Prestadores de serviços avaliados e recomendados pelos vizinhos.</p>
              </div>
              <Button 
                onClick={() => setServicoOpen(true)}
                className="rounded-xl bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none flex items-center gap-1.5 hover:scale-105 transition shrink-0"
              >
                <Plus className="h-4 w-4" /> Indicar Prestador
              </Button>
            </div>

            {isLoadingServicos ? (
              <p className="py-12 text-center text-white/50">Carregando indicações...</p>
            ) : filteredServicos.length === 0 ? (
              <p className="py-12 text-center text-white/50">Nenhuma indicação de serviço encontrada.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredServicos.map((s) => (
                  <Card key={s.id} className="relative overflow-hidden bg-slate-950/40 border-white/10 text-white rounded-3xl flex flex-col justify-between">
                    <CardHeader className="pb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[#D3EA00]/10 border border-[#D3EA00]/20 text-[#D3EA00] w-fit mb-2">
                        {s.categoria}
                      </span>
                      <CardTitle className="text-lg font-bold text-white line-clamp-1">{s.nomeProfissional}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                      <p className="text-sm text-white/70 italic min-h-[40px] leading-relaxed">"{s.recomendacao}"</p>
                      <div className="text-[10px] text-white/40 pt-2 border-t border-white/5">
                        Indicado por: <span className="font-semibold text-white/60">{s.indicadoPorNome || "Morador"}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <a
                          href={formatWhatsappUrl(s.telefone, `Olá ${s.nomeProfissional}, encontrei sua indicação como ${s.categoria} no mural do condomínio TreeCondo e gostaria de orçar um serviço.`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <MessageCircle className="h-4 w-4" /> Contatar Prestador
                        </a>
                        {(s.indicadoPor === currentUid || isOperator) && (
                          <Button size="icon" variant="ghost" className="h-10 w-10 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl" onClick={() => handleDeleteServico(s.id)}>
                            <Trash2 className="h-4.5 w-4.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* CÂMERAS CFTV CONTENT */}
          <TabsContent value="cameras" className="space-y-4 outline-none">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Monitoramento CFTV</h2>
                <p className="text-sm text-white/50">Câmeras de segurança das áreas comuns em tempo real (transmissão ativa).</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Câmera 1 */}
              <Card className="bg-slate-950/40 border-white/10 text-white rounded-3xl overflow-hidden shadow-lg flex flex-col justify-between">
                <CardHeader className="pb-3 bg-slate-950/20 border-b border-white/5 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-white">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                      CAM-01 — Portaria Principal (Entrada)
                    </CardTitle>
                    <CardDescription className="text-white/40 text-[10px]">Acesso de pedestres e veículos</CardDescription>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#00D0E6]/10 text-[#00D0E6] uppercase tracking-wider">Ao Vivo</span>
                </CardHeader>
                <CardContent className="p-0 relative bg-black aspect-video flex items-center justify-center overflow-hidden">
                  <video
                    src="https://assets.mixkit.co/videos/preview/mixkit-pedestrians-crossing-a-street-on-a-rainy-day-4437-large.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                    REC • HD • {new Date().toLocaleDateString("pt-BR")}
                  </div>
                </CardContent>
              </Card>

              {/* Câmera 2 */}
              <Card className="bg-slate-950/40 border-white/10 text-white rounded-3xl overflow-hidden shadow-lg flex flex-col justify-between">
                <CardHeader className="pb-3 bg-slate-950/20 border-b border-white/5 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-white">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                      CAM-02 — Garagem Subsolo G1
                    </CardTitle>
                    <CardDescription className="text-white/40 text-[10px]">Circulação de veículos e vagas</CardDescription>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#00D0E6]/10 text-[#00D0E6] uppercase tracking-wider">Ao Vivo</span>
                </CardHeader>
                <CardContent className="p-0 relative bg-black aspect-video flex items-center justify-center overflow-hidden">
                  <video
                    src="https://assets.mixkit.co/videos/preview/mixkit-interior-of-a-modern-empty-underground-parking-lot-41710-large.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                    REC • HD • {new Date().toLocaleDateString("pt-BR")}
                  </div>
                </CardContent>
              </Card>

              {/* Câmera 3 */}
              <Card className="bg-slate-950/40 border-white/10 text-white rounded-3xl overflow-hidden shadow-lg flex flex-col justify-between">
                <CardHeader className="pb-3 bg-slate-950/20 border-b border-white/5 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-white">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                      CAM-03 — Hall de Elevadores (Bloco A)
                    </CardTitle>
                    <CardDescription className="text-white/40 text-[10px]">Hall social e elevadores</CardDescription>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#00D0E6]/10 text-[#00D0E6] uppercase tracking-wider">Ao Vivo</span>
                </CardHeader>
                <CardContent className="p-0 relative bg-black aspect-video flex items-center justify-center overflow-hidden">
                  <video
                    src="https://assets.mixkit.co/videos/preview/mixkit-corridor-of-a-modern-hospital-44754-large.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                    REC • HD • {new Date().toLocaleDateString("pt-BR")}
                  </div>
                </CardContent>
              </Card>

              {/* Câmera 4 */}
              <Card className="bg-slate-950/40 border-white/10 text-white rounded-3xl overflow-hidden shadow-lg flex flex-col justify-between">
                <CardHeader className="pb-3 bg-slate-950/20 border-b border-white/5 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-white">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                      CAM-04 — Área de Lazer & Piscina
                    </CardTitle>
                    <CardDescription className="text-white/40 text-[10px]">Piscina externa e deck</CardDescription>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#00D0E6]/10 text-[#00D0E6] uppercase tracking-wider">Ao Vivo</span>
                </CardHeader>
                <CardContent className="p-0 relative bg-black aspect-video flex items-center justify-center overflow-hidden">
                  <video
                    src="https://assets.mixkit.co/videos/preview/mixkit-deck-chairs-and-swimming-pool-44026-large.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                    REC • HD • {new Date().toLocaleDateString("pt-BR")}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* CLASSIFICADO FORM MODAL */}
      {classificadoOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSaveClassificado}>
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-bold">Anunciar Desapego / Item</h3>
                <button type="button" onClick={() => setClassificadoOpen(false)} className="text-white/60 hover:text-white">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="clTitulo">Título do Anúncio</Label>
                  <Input id="clTitulo" value={clTitulo} onChange={(e) => setClTitulo(e.target.value)} placeholder="Ex: Bicicleta Aro 29 em ótimo estado" className="bg-white/5 border-white/10 text-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="clPreco">Preço (R$)</Label>
                    <Input id="clPreco" type="number" value={clPreco} onChange={(e) => setClPreco(e.target.value)} placeholder="Ex: 850 (deixe em branco se for grátis)" className="bg-white/5 border-white/10 text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="clCategoria">Categoria</Label>
                    <Select value={clCategoria} onValueChange={clCategoria ? setClCategoria : undefined}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 text-white border-white/15">
                        <SelectItem value="Móveis">Móveis</SelectItem>
                        <SelectItem value="Eletrônicos">Eletrônicos</SelectItem>
                        <SelectItem value="Vestuário">Vestuário</SelectItem>
                        <SelectItem value="Esportes">Esportes</SelectItem>
                        <SelectItem value="Outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clContato">WhatsApp de Contato</Label>
                  <Input id="clContato" value={clContato} onChange={(e) => setClContato(e.target.value)} placeholder="Ex: (11) 99999-9999" className="bg-white/5 border-white/10 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clDescricao">Descrição do Item</Label>
                  <textarea id="clDescricao" value={clDescricao} onChange={(e) => setClDescricao(e.target.value)} placeholder="Detalhes sobre o estado do produto, entrega, etc." className="w-full h-24 rounded-xl bg-white/5 border border-white/10 text-white p-3 text-sm placeholder:text-white/30 focus:border-[#00D0E6] focus:ring-1 focus:ring-[#00D0E6] outline-none" />
                </div>
              </div>
              <div className="p-6 border-t border-white/10 flex justify-end gap-2 bg-slate-950/20">
                <Button type="button" variant="outline" className="border-white/10 hover:bg-white/10 text-white rounded-xl" onClick={() => setClassificadoOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none rounded-xl">
                  {saving ? "Publicando..." : "Publicar Anúncio"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACHADO FORM MODAL */}
      {achadoOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSaveAchado}>
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-bold">Registrar Achado / Perdido</h3>
                <button type="button" onClick={() => setAcItem("")} className="text-white/60 hover:text-white">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>O item foi...</Label>
                    <Select value={acTipo} onValueChange={(v: any) => setAcTipo(v)}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 text-white border-white/15">
                        <SelectItem value="achado">Achado / Encontrado</SelectItem>
                        <SelectItem value="perdido">Perdido / Sumido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="acItem">Nome do Item</Label>
                    <Input id="acItem" value={acItem} onChange={(e) => setAcItem(e.target.value)} placeholder="Ex: Chaveiro com controle" className="bg-white/5 border-white/10 text-white" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="acLocal">Local de Encontro / Perda</Label>
                  <Input id="acLocal" value={acLocal} onChange={(e) => setAcLocal(e.target.value)} placeholder="Ex: Garagem Bloco A, Hall Social" className="bg-white/5 border-white/10 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="acDescricao">Descrição e Detalhes</Label>
                  <textarea id="acDescricao" value={acDescricao} onChange={(e) => setAcDescricao(e.target.value)} placeholder="Escreva marcas, cores, marcas de uso ou observações para devolução." className="w-full h-24 rounded-xl bg-white/5 border border-white/10 text-white p-3 text-sm placeholder:text-white/30 focus:border-[#00D0E6] focus:ring-1 focus:ring-[#00D0E6] outline-none" />
                </div>
              </div>
              <div className="p-6 border-t border-white/10 flex justify-end gap-2 bg-slate-950/20">
                <Button type="button" variant="outline" className="border-white/10 hover:bg-white/10 text-white rounded-xl" onClick={() => setAchadoOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none rounded-xl">
                  {saving ? "Salvando..." : "Registrar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SERVIÇO FORM MODAL */}
      {servicoOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200">
            <form onSubmit={handleSaveServico}>
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-bold">Indicar Prestador de Serviço</h3>
                <button type="button" onClick={() => setServicoOpen(false)} className="text-white/60 hover:text-white">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="seNome">Nome do Profissional / Empresa</Label>
                  <Input id="seNome" value={seNome} onChange={(e) => setSeNome(e.target.value)} placeholder="Ex: Roberto Eletricista" className="bg-white/5 border-white/10 text-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="seCategoria">Categoria</Label>
                    <Select value={seCategoria} onValueChange={seCategoria ? setSeCategoria : undefined}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 text-white border-white/15">
                        <SelectItem value="Eletricista">Eletricista</SelectItem>
                        <SelectItem value="Encanador">Encanador</SelectItem>
                        <SelectItem value="Pintor">Pintor</SelectItem>
                        <SelectItem value="Diarista">Diarista</SelectItem>
                        <SelectItem value="Pedreiro">Pedreiro</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="seTelefone">WhatsApp de Contato</Label>
                    <Input id="seTelefone" value={seTelefone} onChange={(e) => setSeTelefone(e.target.value)} placeholder="Ex: (11) 98888-8888" className="bg-white/5 border-white/10 text-white" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="seRecomendacao">Sua Avaliação / Recomendação</Label>
                  <textarea id="seRecomendacao" value={seRecomendacao} onChange={(e) => setSeRecomendacao(e.target.value)} placeholder="Descreva brevemente a qualidade do serviço executado." className="w-full h-24 rounded-xl bg-white/5 border border-white/10 text-white p-3 text-sm placeholder:text-white/30 focus:border-[#00D0E6] focus:ring-1 focus:ring-[#00D0E6] outline-none" />
                </div>
              </div>
              <div className="p-6 border-t border-white/10 flex justify-end gap-2 bg-slate-950/20">
                <Button type="button" variant="outline" className="border-white/10 hover:bg-white/10 text-white rounded-xl" onClick={() => setServicoOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold border-none rounded-xl">
                  {saving ? "Cadastrando..." : "Cadastrar Indicação"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
