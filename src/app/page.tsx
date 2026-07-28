"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  ArrowRight, 
  ShieldCheck, 
  Calendar, 
  MessageSquare, 
  BookOpen, 
  FileText, 
  CheckCircle2, 
  UserCheck, 
  Menu,
  X
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [termsOpen, setTermsOpen] = React.useState(false);
  const [manualsOpen, setManualsOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="tc-login-bg min-h-screen text-white relative overflow-x-hidden tc-grain tc-typography pb-8">
      {/* HEADER NAVBAR */}
      <header className="relative z-50 border-b border-white/10 bg-slate-900/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 rounded-xl bg-white/[0.08] backdrop-blur flex items-center justify-center border border-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)] overflow-hidden">
              <Image
                src="/logo.png?v=2"
                alt="TreeCondo"
                width={48}
                height={48}
                priority
                className="object-contain"
              />
            </div>
            <div className="leading-tight">
              <div className="text-xl font-bold tracking-tight">
                <span className="text-[#00D0E6]">Tree</span>
                <span className="text-[#D3EA00]">Condo</span>
              </div>
              <div className="text-[10px] text-white/55 tracking-wider uppercase font-semibold">
                Treetech Automation
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => setTermsOpen(true)}
              className="text-sm text-white/70 hover:text-white transition font-medium"
            >
              Termos de Uso
            </button>
            <Link
              href="/guias"
              className="text-sm text-white/70 hover:text-white transition font-medium"
            >
              Guias de Uso
            </Link>
            <button 
              onClick={() => setManualsOpen(true)}
              className="text-sm text-white/70 hover:text-white transition font-medium"
            >
              Manuais
            </button>

            {/* Separador */}
            <span className="h-5 w-[1px] bg-white/20" />

            <Link href="/login">
              <Button variant="ghost" className="text-sm font-medium hover:bg-white/10 hover:text-white">
                Entrar
              </Button>
            </Link>
            <Link href="/login?tab=primeiro">
              <Button className="tc-btn-neon bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-semibold px-5 rounded-xl border-none">
                Primeiro Acesso
              </Button>
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-white/70 hover:text-white transition"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Dropdown Menu (Rendered outside header to prevent backdrop-filter composition layer issues on mobile) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/10 bg-slate-900/95 py-4 px-6 space-y-4 absolute w-full left-0 top-20 z-[60] backdrop-blur-2xl shadow-2xl">
          <button 
            onClick={() => { setMobileMenuOpen(false); setTermsOpen(true); }}
            className="block w-full text-left py-2 text-base text-white/80 hover:text-white"
          >
            Termos de Uso
          </button>
          <Link
            href="/guias"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base text-white/80 hover:text-white"
          >
            Guias de Uso
          </Link>
          <button 
            onClick={() => { setMobileMenuOpen(false); setManualsOpen(true); }}
            className="block w-full text-left py-2 text-base text-white/80 hover:text-white"
          >
            Manuais Rápidos
          </button>

          <div className="border-t border-white/10 pt-4 flex flex-col gap-2">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full text-white border-white/20 bg-transparent rounded-xl">
                Entrar
              </Button>
            </Link>
            <Link href="/login?tab=primeiro" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-semibold rounded-xl border-none">
                Primeiro Acesso
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 flex flex-col items-center text-center">
        {/* Badge superior */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/5 backdrop-blur-md text-xs font-semibold text-[#00D0E6] tracking-wider uppercase mb-8 shadow-sm">
          <ShieldCheck className="h-4 w-4" /> Plataforma Homologada & Segura
        </div>

        {/* Logo grande no Hero */}
        <div className="mb-8 p-6 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur shadow-[0_20px_50px_rgba(0,0,0,0.3)] inline-flex items-center justify-center">
          <Image
            src="/logo.png?v=2"
            alt="TreeCondo"
            width={128}
            height={128}
            priority
            className="object-contain"
          />
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.15]">
          Gestão inteligente. <br />
          <span className="bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] bg-clip-text text-transparent">
            Condomínios eficientes.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-xl text-white/70 max-w-2xl leading-relaxed">
          A plataforma definitiva para automatizar reservas, portaria, correspondências e assembleias de forma moderna, segura e em tempo real.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md">
          <Link href="/login" className="w-full sm:w-auto">
            <Button size="lg" className="tc-btn-neon w-full sm:w-auto bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 font-bold px-8 py-6 rounded-2xl shadow-lg border-none flex items-center justify-center gap-2">
              Acessar o Painel <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/login?tab=primeiro" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/20 hover:bg-white/10 text-white font-semibold px-8 py-6 rounded-2xl bg-white/5 backdrop-blur">
              Primeiro Acesso
            </Button>
          </Link>
        </div>

        {/* FEATURES GRID */}
        <section className="mt-24 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          <Card className="tc-card-signature bg-white/5 border-white/10 text-white rounded-3xl">
            <CardHeader className="pb-2">
              <Calendar className="text-[#00D0E6] h-8 w-8 mb-2" />
              <CardTitle className="text-lg font-bold">Reservas de Áreas</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-white/70 leading-relaxed">
              Agendamento simples de salão de festas, churrasqueira e quadras com fila de espera inteligente integrada.
            </CardContent>
          </Card>

          <Card className="tc-card-signature bg-white/5 border-white/10 text-white rounded-3xl">
            <CardHeader className="pb-2">
              <UserCheck className="text-[#D3EA00] h-8 w-8 mb-2" />
              <CardTitle className="text-lg font-bold">Portaria & Acessos</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-white/70 leading-relaxed">
              Moradores autorizam convidados e prestadores e a portaria acompanha e valida tudo instantaneamente.
            </CardContent>
          </Card>

          <Card className="tc-card-signature bg-white/5 border-white/10 text-white rounded-3xl">
            <CardHeader className="pb-2">
              <MessageSquare className="text-[#00D0E6] h-8 w-8 mb-2" />
              <CardTitle className="text-lg font-bold">Comunicação e Chats</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-white/70 leading-relaxed">
              Comunicados da administração do condomínio com suporte a enquetes e debates rápidos em tempo real.
            </CardContent>
          </Card>

          <Card className="tc-card-signature bg-white/5 border-white/10 text-white rounded-3xl">
            <CardHeader className="pb-2">
              <ShieldCheck className="text-[#D3EA00] h-8 w-8 mb-2" />
              <CardTitle className="text-lg font-bold">Assembleias & Voto</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-white/70 leading-relaxed">
              Acompanhamento de pautas, reuniões presenciais ou remotas e votação eletrônica segura no card da assembleia.
            </CardContent>
          </Card>
        </section>
      </main>
    </div>

    {/* GLOBAL MODALS (Single Instance, custom styled for stability and zero page scroll jumps) */}
    {mounted && (
      <>
        {/* Termos de Uso */}
        {termsOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
            <div className="relative w-full max-w-2xl bg-slate-900 border border-white/15 rounded-3xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden text-white animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="text-[#00D0E6] h-6 w-6" />
                  <h2 className="text-2xl font-bold">Termos de Uso do TreeCondo</h2>
                </div>
                <button 
                  onClick={() => setTermsOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {/* Content */}
              <div className="p-6 overflow-y-auto space-y-4 text-sm text-white/80 leading-relaxed">
                <p>
                  Bem-vindo ao <strong>TreeCondo</strong>, uma plataforma desenvolvida pela <strong>Treetech Automation</strong> para facilitar a gestão e a convivência em condomínios.
                </p>
                <h4 className="text-white font-semibold text-base mt-4">1. Aceitação dos Termos</h4>
                <p>
                  Ao acessar ou usar nossa plataforma, você concorda em cumprir e estar vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
                </p>
                <h4 className="text-white font-semibold text-base mt-4">2. Descrição do Serviço</h4>
                <p>
                  O TreeCondo fornece ferramentas para agendamento de áreas comuns, controle de acesso na portaria, comunicação interna de comunicados e avisos com suporte a enquetes, registro de incidentes e visualização de documentos condominiais.
                </p>
                <h4 className="text-white font-semibold text-base mt-4">3. Privacidade e Proteção de Dados (LGPD)</h4>
                <p>
                  Estamos comprometidos com a privacidade de seus dados. Tratamos todas as informações cadastrais de moradores, veículos, convidados e funcionários em estrita conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018). Os dados de portaria (registros de acessos) são guardados de forma segura e utilizados apenas para fins de segurança e controle interno do condomínio.
                </p>
                <h4 className="text-white font-semibold text-base mt-4">4. Obrigações do Usuário</h4>
                <p>
                  Cada usuário é responsável por manter a confidencialidade de sua senha de acesso. As informações inseridas no sistema (especialmente relativas a convidados autorizados na portaria e reservas) devem ser verídicas e de inteira responsabilidade do morador titular.
                </p>
                <h4 className="text-white font-semibold text-base mt-4">5. Propriedade Intelectual</h4>
                <p>
                  Todo o design, código-fonte, marcas e propriedade intelectual do aplicativo TreeCondo pertencem exclusivamente à Treetech Automation. É proibida qualquer reprodução, engenharia reversa ou distribuição não autorizada.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Central de Manuais */}
        {manualsOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
            <div className="relative w-full max-w-3xl bg-slate-900 border border-white/15 rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden text-white animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="text-[#D3EA00] h-6 w-6" />
                  <h2 className="text-2xl font-bold">Central de Ajuda & Manuais</h2>
                </div>
                <button 
                  onClick={() => setManualsOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {/* Content */}
              <div className="p-6 overflow-y-auto flex-1">
                <p className="text-white/60 text-sm mb-4">
                  Selecione o seu perfil para visualizar as instruções de uso do TreeCondo.
                </p>
                <Tabs defaultValue="morador" className="w-full">
                  <TabsList className="grid grid-cols-3 w-full rounded-2xl bg-white/10 border border-white/5 p-1">
                    <TabsTrigger className="rounded-xl text-xs sm:text-sm" value="morador">Morador</TabsTrigger>
                    <TabsTrigger className="rounded-xl text-xs sm:text-sm" value="sindico">Administração</TabsTrigger>
                    <TabsTrigger className="rounded-xl text-xs sm:text-sm" value="portaria">Portaria</TabsTrigger>
                  </TabsList>

                  <TabsContent value="morador" className="space-y-4 text-sm text-white/80 leading-relaxed pt-4">
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <CheckCircle2 className="text-[#D3EA00] shrink-0 h-5 w-5 animate-pulse" />
                        <div>
                          <strong className="text-white">Reservar Áreas Comuns:</strong> Acesse a aba <em>Reservas</em>, escolha o espaço (ex: Salão de Festas) e a data disponível. Se estiver ocupado, você poderá entrar na fila de espera para ser notificado em caso de cancelamento.
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <CheckCircle2 className="text-[#D3EA00] shrink-0 h-5 w-5 animate-pulse" />
                        <div>
                          <strong className="text-white">Autorizar Visitas / Convidados:</strong> Em <em>Reservas</em> (para festas) ou <em>Acessos</em>, cadastre o nome e os dados dos seus convidados. A portaria visualizará e liberará a entrada imediatamente ao chegarem.
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <CheckCircle2 className="text-[#D3EA00] shrink-0 h-5 w-5 animate-pulse" />
                        <div>
                          <strong className="text-white">Correspondências e Encomendas:</strong> Assim que chegar um pacote para você, a portaria registrará e você receberá um alerta em tempo real. Crie seu código PIN exclusivo nas configurações para retirar a encomenda de forma segura.
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <CheckCircle2 className="text-[#D3EA00] shrink-0 h-5 w-5 animate-pulse" />
                        <div>
                          <strong className="text-white">Votações em Assembleias:</strong> Em <em>Reuniões</em>, você pode ver as pautas da assembleia e votar de forma anônima e digital nas enquetes associadas diretamente no card da reunião.
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="sindico" className="space-y-4 text-sm text-white/80 leading-relaxed pt-4">
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <CheckCircle2 className="text-[#00D0E6] shrink-0 h-5 w-5 animate-pulse" />
                        <div>
                          <strong className="text-white">Criar Enquetes e Assembleias:</strong> Agende assembleias em <em>Reuniões</em>. Se houver votação, crie uma enquete na seção correspondente primeiro e depois vincule a enquete à reunião criada para liberar o voto eletrônico aos moradores.
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <CheckCircle2 className="text-[#00D0E6] shrink-0 h-5 w-5 animate-pulse" />
                        <div>
                          <strong className="text-white">Gerenciar Cadastros:</strong> Adicione moradores, síndicos adicionais, funcionários e porteiros na aba <em>Cadastros</em>. Você pode enviar códigos de convite para primeiro acesso diretamente.
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <CheckCircle2 className="text-[#00D0E6] shrink-0 h-5 w-5 animate-pulse" />
                        <div>
                          <strong className="text-white">Comunicados Importantes:</strong> Use a aba de <em>Mensagens</em> para enviar informativos globais (tipo Condomínio), por bloco ou por unidades específicas.
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="portaria" className="space-y-4 text-sm text-white/80 leading-relaxed pt-4">
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <CheckCircle2 className="text-[#00D0E6] shrink-0 h-5 w-5 animate-pulse" />
                        <div>
                          <strong className="text-white">Registrar Entradas / Visitas:</strong> Na recepção, consulte a lista de convidados ou reservas autorizadas. Se o visitante não estiver cadastrado, faça o registro em tempo real informando o destino.
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <CheckCircle2 className="text-[#00D0E6] shrink-0 h-5 w-5 animate-pulse" />
                        <div>
                          <strong className="text-white">Receber Encomendas:</strong> Ao receber um pacote de transportadoras, vá à seção <em>Encomendas</em>, registre para qual bloco/apartamento e morador se destina. O morador será notificado no mesmo instante.
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <CheckCircle2 className="text-[#00D0E6] shrink-0 h-5 w-5 animate-pulse" />
                        <div>
                          <strong className="text-white">Retirar Encomendas:</strong> Quando o morador for à portaria retirar, solicite o PIN de retirada gerado por ele. O sistema validará a entrega de forma segura e registrará a data/hora e o porteiro responsável.
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        )}
      </>
    )}

  </>
);
}
