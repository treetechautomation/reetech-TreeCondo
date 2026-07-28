"use client";

import React, { useState, useRef, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, User, Send, ArrowLeft, HelpCircle } from "lucide-react";
import Link from "next/link";

type Message = {
  sender: "bot" | "user";
  text: string;
  time: string;
};

const FAQ_QUESTIONS = [
  { label: "🔇 Horário de Silêncio", query: "Qual o horário de silêncio permitido no condomínio?" },
  { label: "📦 Retirada de Encomendas", query: "Como funciona a entrega de pacotes e encomendas?" },
  { label: "🐕 Regras para Pets", query: "Quais são as regras para animais de estimação?" },
  { label: "🚚 Agendar Mudanças", query: "Quais os dias e horários permitidos para mudança?" },
  { label: "🗑️ Descarte de Lixo", query: "Onde devo descartar lixo comum e reciclável?" },
  { label: "🎉 Reservas de Áreas", query: "Qual o valor e limite para reservar o Salão de Festas?" }
];

export default function RulesChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Olá! Sou o assistente virtual do TreeCondo. Posso ajudar você com dúvidas sobre o Regimento Interno, horários, reservas de áreas e regras gerais de convivência. Pergunte-me qualquer coisa!",
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }
  ]);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const parseRulesResponse = (query: string): string => {
    const text = query.toLowerCase();
    
    if (text.includes("silenc") || text.includes("barulho") || text.includes("som") || text.includes("ruido")) {
      return "🔇 **Regras de Silêncio:**\nDe acordo com a Convenção do Condomínio, o horário de silêncio rigoroso inicia-se às **22h** e encerra-se às **08h** do dia seguinte. O uso de aparelhos de som e instrumentos nas áreas comuns ou unidades privativas deve manter-se em nível moderado durante o dia.";
    }
    
    if (text.includes("encomenda") || text.includes("pacote") || text.includes("correio") || text.includes("entrega")) {
      return "📦 **Retirada de Encomendas:**\nToda encomenda entregue no condomínio é recebida e registrada na portaria pela equipe com registro fotográfico do pacote. Você receberá uma notificação em tempo real no aplicativo com um PIN exclusivo de retirada. Dirija-se à portaria com o PIN para receber a sua encomenda.";
    }

    if (text.includes("pet") || text.includes("animal") || text.includes("cachorro") || text.includes("gato") || text.includes("bicho")) {
      return "🐕 **Animais de Estimação (Pets):**\nAnimais domésticos de pequeno/médio porte são permitidos nas unidades privativas. Nas áreas comuns (corredores, elevadores e garagens), os pets devem ser mantidos estritamente no colo ou em guias curtas/coleiras. É expressamente proibida a permanência de animais nas áreas da academia e piscina.";
    }

    if (text.includes("mudanc") || text.includes("carreto") || text.includes("mudar") || text.includes("caminhao")) {
      return "🚚 **Regras de Mudança:**\nAs mudanças devem ser pré-agendadas com antecedência mínima de 48 horas junto à administração.\n* **Segunda a Sexta:** das 08h às 18h\n* **Sábados:** das 09h às 13h\n* **Domingos e Feriados:** Expressamente proibido.";
    }

    if (text.includes("lixo") || text.includes("descarte") || text.includes("coleta") || text.includes("recicla")) {
      return "🗑️ **Descarte de Resíduos:**\n* **Lixo Orgânico / Comum:** Deve ser ensacado adequadamente e depositado nas lixeiras localizadas no hall de serviço de cada andar até as 20h.\n* **Lixo Reciclável:** Pedimos a separação correta. Papéis, plásticos e vidros devem ser levados à central de reciclagem no subsolo G1.";
    }

    if (text.includes("reserva") || text.includes("festa") || text.includes("salao") || text.includes("churrasqueira") || text.includes("alug")) {
      return "🎉 **Reservas de Áreas Comuns:**\nAs reservas devem ser feitas pelo painel do morador com taxas debitadas na fatura condominial:\n* **Salão de Festas:** R$ 150,00 por evento (capacidade máxima de 30 convidados).\n* **Churrasqueira:** R$ 50,00 por período.\n* **Cancelamentos:** Devem ser feitos com até 24h de antecedência para reembolso.";
    }

    if (text.includes("visitante") || text.includes("portaria") || text.includes("entregador") || text.includes("acesso") || text.includes("porteiro")) {
      return "🔑 **Acesso de Visitantes e Prestadores:**\nTodos os visitantes devem ser cadastrados na portaria apresentando documento de identificação com foto. Para maior agilidade e segurança, moradores podem emitir passes por **QR Code Temporário** diretamente no painel principal do aplicativo.";
    }

    if (text.includes("panico") || text.includes("emergencia") || text.includes("perigo") || text.includes("seguranca")) {
      return "🚨 **Situações de Emergência:**\nSe estiver sob risco ou ameaça, ative o **Botão de Pânico Silencioso** localizado no seu painel principal. Um alerta vermelho será enviado instantaneamente ao monitor da portaria de segurança para que providências sejam tomadas.";
    }

    return "🤖 Desculpe, não encontrei uma regra específica em nosso regimento interno sobre essa questão. Recomendamos que você entre em contato direto com a administração do condomínio ou abra um chamado na nossa seção de **Incidentes**.";
  };

  const handleSend = (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      sender: "user",
      text: textToSend,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setIsTyping(true);

    setTimeout(() => {
      const botReply = parseRulesResponse(textToSend);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: botReply,
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        }
      ]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <AppLayout pageTitle="TreeIA — Assistente de Regras">
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <Link href="/comunidade">
            <Button variant="ghost" className="text-white hover:bg-white/10 rounded-xl gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar para Comunidade
            </Button>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <HelpCircle className="h-4 w-4 text-[#00D0E6]" /> Respostas instantâneas do regimento interno
          </div>
        </div>

        <Card className="bg-slate-900/40 border-white/10 text-white rounded-3xl overflow-hidden flex flex-col h-[600px] shadow-2xl">
          <CardHeader className="border-b border-white/10 bg-slate-950/20 p-4 sm:p-6 flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#00D0E6]/10 border border-[#00D0E6]/30 flex items-center justify-center text-[#00D0E6] shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-md sm:text-lg font-bold">Assistente de Regras & Convivência</CardTitle>
              <CardDescription className="text-white/50 text-xs">Conectado ao Regimento Interno do condomínio.</CardDescription>
            </div>
          </CardHeader>

          {/* HISTÓRICO DE MENSAGENS */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-[300px]">
            {messages.map((msg, index) => {
              const isBot = msg.sender === "bot";
              return (
                <div key={index} className={`flex items-start gap-2.5 max-w-[85%] ${isBot ? "mr-auto" : "ml-auto flex-row-reverse"}`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border ${
                    isBot ? "bg-slate-800 border-white/15 text-[#00D0E6]" : "bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] border-none text-slate-900"
                  }`}>
                    {isBot ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-md whitespace-pre-line ${
                    isBot ? "bg-white/5 border border-white/10 text-white/95" : "bg-[#00D0E6]/15 border border-[#00D0E6]/30 text-white"
                  }`}>
                    {msg.text}
                    <div className="text-[9px] text-white/35 mt-1.5 text-right">{msg.time}</div>
                  </div>
                </div>
              );
            })}
            
            {isTyping && (
              <div className="flex items-start gap-2.5 mr-auto">
                <div className="h-8 w-8 rounded-full bg-slate-800 border border-white/15 text-[#00D0E6] flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-1">
                  <span className="h-2 w-2 bg-white/40 rounded-full animate-bounce duration-500" />
                  <span className="h-2 w-2 bg-white/40 rounded-full animate-bounce [animation-delay:0.2s] duration-500" />
                  <span className="h-2 w-2 bg-white/40 rounded-full animate-bounce [animation-delay:0.4s] duration-500" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* PERGUNTAS RÁPIDAS (FAQS) */}
          <div className="px-4 sm:px-6 py-3 border-t border-white/5 bg-slate-950/10">
            <span className="text-[10px] text-white/40 uppercase tracking-wider block mb-2">Sugestões rápidas:</span>
            <div className="flex flex-wrap gap-2">
              {FAQ_QUESTIONS.map((faq, index) => (
                <button
                  key={index}
                  onClick={() => handleSend(faq.query)}
                  className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:border-[#00D0E6] text-xs transition"
                >
                  {faq.label}
                </button>
              ))}
            </div>
          </div>

          {/* CAIXA DE ENTRADA DO CHAT */}
          <div className="p-4 border-t border-white/10 bg-slate-950/20">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputVal);
              }}
              className="flex gap-2"
            >
              <Input
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Pergunte sobre mudanças, silêncio, pets, lixo..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-[#00D0E6] rounded-xl h-11"
              />
              <Button
                type="submit"
                disabled={!inputVal.trim() || isTyping}
                className="bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] text-slate-900 border-none rounded-xl h-11 px-4 flex items-center justify-center hover:scale-105 transition"
              >
                <Send className="h-4.5 w-4.5" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
