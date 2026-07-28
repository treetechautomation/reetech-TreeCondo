"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Search,
  BookOpen,
  ArrowLeft,
  CheckCircle2,
  Building2,
  Users,
  KeyRound,
  CalendarCheck2,
  Package,
  AlertTriangle,
  Megaphone,
  FileText,
  UsersRound,
  Wrench,
  Settings,
  BarChart3,
  ShieldCheck,
  ClipboardList,
  Bell,
  Star,
  Zap,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =====================================================
// TIPOS
// =====================================================
type Step = {
  title: string;
  description: string;
};

type GuideItem = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  category: string;
  summary: string;
  steps: Step[];
  tip?: string;
};

type Profile = "sindico" | "morador" | "porteiro";

// =====================================================
// GUIAS: SÍNDICO / ADMINISTRADOR
// =====================================================
const guiasSindico: GuideItem[] = [
  {
    id: "sindico-dashboard",
    icon: BarChart3,
    title: "Entendendo o Dashboard",
    category: "Primeiros Passos",
    summary: "Visão geral do painel de controle e métricas do condomínio.",
    steps: [
      {
        title: "Acesse o Dashboard",
        description:
          "Após o login, você será direcionado automaticamente ao Painel. Aqui você vê os KPIs: encomendas pendentes, incidentes abertos, próximas reservas e assembleia.",
      },
      {
        title: "Analise os gráficos",
        description:
          "Os gráficos de incidentes por mês, categorias e reservas estão disponíveis para administradores. Use-os para identificar padrões e agir preventivamente.",
      },
      {
        title: "Use os atalhos rápidos",
        description:
          'Os cards "Gestão de Reservas" e "Calendário de Reservas" dão acesso direto às visões administrativas. Clique em "Abrir" para navegar.',
      },
    ],
    tip: "Os dados do Dashboard são atualizados em tempo real via Firestore — recarregar a página não é necessário.",
  },
  {
    id: "sindico-cadastros",
    icon: Users,
    title: "Gerenciar Cadastros",
    category: "Gestão de Pessoas",
    summary: "Como cadastrar moradores, porteiros, zeladores e administradores.",
    steps: [
      {
        title: "Acesse Cadastros",
        description:
          'No menu lateral, clique em "Cadastros". Você verá abas separadas para Moradores, Funcionários e outros perfis.',
      },
      {
        title: "Adicione um novo morador",
        description:
          'Clique em "Novo Morador", preencha nome, e-mail e selecione o bloco/unidade. O sistema enviará um código de primeiro acesso (TC-XXXXXXXX) para o e-mail informado.',
      },
      {
        title: "Acompanhe o status de ativação",
        description:
          'Você pode verificar se o morador já ativou a conta pelo campo "Status". Moradores que ainda não fizeram o primeiro acesso aparecem como PENDENTE.',
      },
      {
        title: "Adicione funcionários",
        description:
          'Para porteiros e zeladores, use a aba correspondente. Defina o role (PORTEIRO, ZELADOR) e o sistema garantirá as permissões corretas automaticamente.',
      },
    ],
    tip: "O código de primeiro acesso expira em 72 horas. Se o morador não ativou, você pode reenviar pela tela de cadastros.",
  },
  {
    id: "sindico-reservas",
    icon: CalendarCheck2,
    title: "Aprovar e Gerenciar Reservas",
    category: "Reservas",
    summary: "Fluxo completo de aprovação de reservas de áreas comuns.",
    steps: [
      {
        title: "Visualize as solicitações",
        description:
          'Em "Reservas > Solicitações", você vê todas as reservas pendentes. As mais urgentes aparecem no topo.',
      },
      {
        title: "Aprove ou recuse",
        description:
          'Clique na reserva para ver os detalhes: quem solicitou, data, horário e área. Clique em "Aprovar" para liberar ou "Recusar" para rejeitar. O morador é notificado em tempo real.',
      },
      {
        title: "Gerencie o calendário",
        description:
          'Em "Reservas > Aprovadas", veja o calendário mensal com todas as reservas ativas. Útil para identificar conflitos.',
      },
      {
        title: "Configure as áreas",
        description:
          'Em "Configurações > Áreas Reserváveis", você pode definir horários de funcionamento, capacidade máxima, valor da taxa e regras específicas de cada área.',
      },
      {
        title: "Gerencie filas de espera",
        description:
          "Quando uma área é liberada por cancelamento, o sistema notifica automaticamente o próximo da fila de espera. Você pode visualizar a fila em cada área.",
      },
    ],
  },
  {
    id: "sindico-assembleias",
    icon: UsersRound,
    title: "Criar Assembleias e Enquetes",
    category: "Assembleias",
    summary: "Como criar reuniões, vincular enquetes e coletar votos digitais.",
    steps: [
      {
        title: "Crie uma enquete (se houver votação)",
        description:
          'Primeiro vá em "Enquetes" e crie a enquete com a pergunta e as opções de resposta. Defina o prazo de votação. Só depois crie a reunião.',
      },
      {
        title: "Crie a reunião/assembleia",
        description:
          'Em "Reuniões", clique em "Nova Reunião". Preencha o título, data, horário, local (ou link para videoconferência) e a pauta.',
      },
      {
        title: "Vincule a enquete à reunião",
        description:
          'Na tela de edição da reunião, você pode vincular enquetes previamente criadas. Os moradores verão e poderão votar direto no card da assembleia.',
      },
      {
        title: "Acompanhe os resultados",
        description:
          'Em "Enquetes", você visualiza os resultados em tempo real com gráfico de barras. Após encerrar, o resultado é salvo para atas.',
      },
    ],
    tip: "As votações são anônimas para moradores. Apenas o síndico vê o total de votos por opção.",
  },
  {
    id: "sindico-manutencao",
    icon: Wrench,
    title: "Manutenção Preventiva",
    category: "Infraestrutura",
    summary: "Configure rotinas de manutenção e acompanhe execuções.",
    steps: [
      {
        title: "Crie rotinas de manutenção",
        description:
          'Em "Manutenção Preventiva", clique em "Nova Rotina". Defina o nome (ex: Revisão da Bomba d\'Água), periodicidade (mensal, trimestral) e responsável.',
      },
      {
        title: "Registre execuções",
        description:
          'Quando uma manutenção for realizada, registre a execução: data, responsável, observações e fotos. O sistema calcula automaticamente a próxima data.',
      },
      {
        title: "Acompanhe o calendário",
        description:
          "O painel mostra todas as manutenções vencidas (em vermelho), próximas (em amarelo) e em dia (em verde). Priorize as vencidas.",
      },
      {
        title: "Gerencie fornecedores",
        description:
          'Em "Fornecedores", cadastre as empresas de manutenção com contato, especialidade e histórico de serviços prestados.',
      },
    ],
    tip: "Porteiros e zeladores também podem registrar execuções de manutenção, delegando responsabilidade operacional.",
  },
  {
    id: "sindico-comunicados",
    icon: Megaphone,
    title: "Enviar Comunicados",
    category: "Comunicação",
    summary: "Como enviar anúncios para todo o condomínio, blocos ou unidades.",
    steps: [
      {
        title: "Acesse Anúncios",
        description:
          'Em "Anúncios", clique em "Novo Comunicado". Você pode definir o público: todo o condomínio, um bloco específico, ou uma unidade.',
      },
      {
        title: "Escreva o comunicado",
        description:
          "Adicione título, mensagem e, se desejar, imagens ou documentos em anexo. Use a pré-visualização para verificar como ficará na tela do morador.",
      },
      {
        title: "Publique e notifique",
        description:
          'Ao clicar em "Publicar", o comunicado aparece no feed de anúncios dos moradores selecionados e eles recebem uma notificação push instantânea.',
      },
    ],
    tip: "Comunicados urgentes devem ser marcados com a flag 'Urgente' — eles aparecem com destaque vermelho no feed dos moradores.",
  },
  {
    id: "sindico-incidentes",
    icon: AlertTriangle,
    title: "Gerenciar Incidentes",
    category: "Operacional",
    summary: "Como acompanhar, responder e resolver ocorrências registradas.",
    steps: [
      {
        title: "Visualize os incidentes",
        description:
          'Em "Incidentes", você vê todos os registros com status ABERTO e EM_ANDAMENTO. Ordene por data ou tipo para priorizar.',
      },
      {
        title: "Atualize o status",
        description:
          'Clique no incidente e altere o status para "Em Andamento" quando iniciar o atendimento, e "Resolvido" quando concluído. O morador é notificado a cada mudança.',
      },
      {
        title: "Adicione ao histórico",
        description:
          "Registre no histórico do incidente cada passo tomado (contato com empresa, visita técnica, etc.). Isso cria uma trilha de auditoria completa.",
      },
    ],
  },
  {
    id: "sindico-documentos",
    icon: FileText,
    title: "Gerenciar Documentos",
    category: "Documentação",
    summary: "Como publicar atas, regulamentos e documentos do condomínio.",
    steps: [
      {
        title: "Faça upload de documentos",
        description:
          'Em "Documentos", clique em "Novo Documento". Selecione o arquivo (PDF recomendado) e adicione um título e descrição clara.',
      },
      {
        title: "Categorize adequadamente",
        description:
          "Escolha a categoria do documento: Ata, Regulamento, Financeiro, Contrato, etc. Isso facilita a busca pelos moradores.",
      },
      {
        title: "Controle a visibilidade",
        description:
          "Documentos publicados ficam visíveis para todos os membros do condomínio. Apenas o síndico pode excluir ou substituir arquivos.",
      },
    ],
  },
  {
    id: "sindico-configuracoes",
    icon: Settings,
    title: "Configurações do Condomínio",
    category: "Sistema",
    summary: "Personalize o sistema, logotipos, e permissões do condomínio.",
    steps: [
      {
        title: "Configure o branding",
        description:
          'Em "Configurações", você pode enviar o logo do condomínio que aparece na tela de login e no painel dos moradores.',
      },
      {
        title: "Ajuste permissões do menu",
        description:
          "Você pode habilitar ou desabilitar módulos específicos para cada role (morador, porteiro) — por exemplo, restringir o acesso a enquetes para porteiros.",
      },
      {
        title: "Configure notificações",
        description:
          "Defina quais eventos geram notificação push: novas encomendas, incidentes críticos, aprovação de reservas, etc.",
      },
    ],
  },
];

// =====================================================
// GUIAS: MORADOR
// =====================================================
const guiasMorador: GuideItem[] = [
  {
    id: "morador-primeiroacesso",
    icon: KeyRound,
    title: "Primeiro Acesso ao Sistema",
    category: "Primeiros Passos",
    summary: "Como ativar sua conta com o código enviado pelo síndico.",
    steps: [
      {
        title: "Receba o código de ativação",
        description:
          'Você receberá um e-mail do condomínio com um código no formato "TC-XXXXXXXX". Guarde este código.',
      },
      {
        title: "Acesse a tela de login",
        description:
          'Abra o TreeCondo pelo navegador ou app e clique em "Primeiro Acesso" (aba superior direita).',
      },
      {
        title: "Informe e-mail e código",
        description:
          "Preencha o e-mail cadastrado pelo síndico e o código de ativação. Clique em Validar.",
      },
      {
        title: "Crie sua senha",
        description:
          "Após validar, defina sua senha pessoal (mínimo 8 caracteres). Ela é criptografada e o condomínio não tem acesso.",
      },
    ],
    tip: "O código expira em 72 horas. Se venceu, solicite ao síndico a renovação.",
  },
  {
    id: "morador-reservas",
    icon: CalendarCheck2,
    title: "Reservar Áreas Comuns",
    category: "Reservas",
    summary: "Como agendar salão de festas, churrasqueira, quadra e outras áreas.",
    steps: [
      {
        title: "Acesse Reservas",
        description:
          'No menu ou no ícone de calendário na barra inferior, acesse "Reservas". Você verá as áreas disponíveis do seu condomínio.',
      },
      {
        title: "Escolha a área e a data",
        description:
          "Clique na área desejada (ex: Salão de Festas) e veja o calendário de disponibilidade. Datas em cinza estão ocupadas.",
      },
      {
        title: "Envie a solicitação",
        description:
          "Selecione a data disponível e confirme os horários. Sua solicitação é enviada ao síndico para aprovação.",
      },
      {
        title: "Aguarde a aprovação",
        description:
          "Você receberá uma notificação quando a reserva for aprovada ou recusada. Reservas aprovadas aparecem no seu histórico.",
      },
      {
        title: "Fila de espera",
        description:
          "Se a data estiver ocupada, você pode entrar na fila de espera. Se o titular cancelar, você será notificado automaticamente.",
      },
    ],
    tip: "Algumas áreas têm horários e taxas específicas definidas pelo síndico. Veja as regras clicando em 'Ver Detalhes' da área.",
  },
  {
    id: "morador-convidados",
    icon: Users,
    title: "Autorizar Visitas e Convidados",
    category: "Acessos",
    summary: "Como cadastrar convidados para que a portaria libere a entrada.",
    steps: [
      {
        title: "Acesse Acessos",
        description:
          'No menu, acesse "Acesso". Aqui você pode autorizar visitantes, prestadores de serviço e entregas.',
      },
      {
        title: "Autorize um convidado",
        description:
          'Clique em "Novo Acesso", informe o nome do visitante, data/horário previsto e, se desejar, o documento (RG/CPF). A portaria verá essa autorização em tempo real.',
      },
      {
        title: "Para festas: use a reserva",
        description:
          "Se você tem uma reserva aprovada para festa, pode adicionar a lista de convidados diretamente pela tela da reserva — mais prático para listas grandes.",
      },
      {
        title: "Prestadores de serviço",
        description:
          "Para encanadores, eletricistas, etc., autorize em Acessos com a categoria 'Prestador'. Informe o período de trabalho previsto.",
      },
    ],
    tip: "Mantenha sua lista de acessos atualizada. Autorizações sem previsão de data têm validade de 24 horas por padrão.",
  },
  {
    id: "morador-encomendas",
    icon: Package,
    title: "Encomendas e PIN de Retirada",
    category: "Encomendas",
    summary: "Como receber notificações e retirar encomendas na portaria com segurança.",
    steps: [
      {
        title: "Receba a notificação",
        description:
          "Quando um pacote chegar para você, a portaria registra e você recebe uma notificação push imediata com o nome do remetente.",
      },
      {
        title: "Crie seu PIN de retirada",
        description:
          'Em "Configurações > Meu PIN", crie um PIN numérico de 4 dígitos. Esse PIN é exclusivo seu e será solicitado pela portaria na hora da retirada.',
      },
      {
        title: "Retire a encomenda",
        description:
          "Vá à portaria, informe ao porteiro que vai retirar, forneça seu PIN quando solicitado. O sistema registra data/hora e o porteiro responsável pela entrega.",
      },
      {
        title: "Histórico de encomendas",
        description:
          'Em "Encomendas", você vê todas as encomendas recebidas, entregues e pendentes. Útil para contestar entregas.',
      },
    ],
    tip: "Se esquecer seu PIN, redefina-o em Configurações a qualquer momento. O PIN antigo é invalidado imediatamente.",
  },
  {
    id: "morador-incidentes",
    icon: AlertTriangle,
    title: "Registrar Incidentes",
    category: "Operacional",
    summary: "Como reportar problemas e acompanhar a resolução.",
    steps: [
      {
        title: "Acesse Incidentes",
        description:
          'No menu, vá em "Incidentes" e clique em "Novo Incidente".',
      },
      {
        title: "Descreva o problema",
        description:
          "Informe o tipo de incidente (vazamento, barulho, danos, etc.), a localização e uma descrição detalhada. Você pode adicionar fotos para melhor visualização.",
      },
      {
        title: "Acompanhe a resolução",
        description:
          "Você receberá notificações quando o status mudar: 'Em Andamento' (síndico está tratando) e 'Resolvido'. Você pode avaliar a resolução ao final.",
      },
    ],
    tip: "Para emergências urgentes (vazamento grave, incêndio), sempre ligue para o porteiro ou síndico diretamente antes de registrar no sistema.",
  },
  {
    id: "morador-enquetes",
    icon: BarChart3,
    title: "Participar de Votações",
    category: "Assembleias",
    summary: "Como votar em enquetes e assembleias de forma anônima.",
    steps: [
      {
        title: "Receba a notificação de votação",
        description:
          "Quando o síndico criar uma enquete, você recebe uma notificação. As votações abertas aparecem no seu feed de notificações.",
      },
      {
        title: "Vote na enquete",
        description:
          'Em "Enquetes" ou diretamente no card da reunião em "Reuniões", selecione sua opção e confirme. O voto é anônimo — apenas o total é visível.',
      },
      {
        title: "Voto único e imutável",
        description:
          "Cada morador pode votar apenas uma vez por enquete. Após confirmado, o voto não pode ser alterado — reflita bem antes de confirmar.",
      },
    ],
  },
  {
    id: "morador-anuncios",
    icon: Megaphone,
    title: "Receber Comunicados",
    category: "Comunicação",
    summary: "Como acessar e ler os comunicados do condomínio.",
    steps: [
      {
        title: "Veja os comunicados",
        description:
          'Em "Anúncios", você encontra todos os comunicados publicados pelo síndico. Os não lidos aparecem com destaque.',
      },
      {
        title: "Notificações push",
        description:
          "Novos comunicados geram uma notificação automática. Certifique-se de ter as notificações habilitadas no seu dispositivo para o TreeCondo.",
      },
    ],
    tip: "Comunicados marcados como 'Urgente' aparecem no topo com borda vermelha. Não ignore esses avisos.",
  },
];

// =====================================================
// GUIAS: PORTEIRO
// =====================================================
const guiasPorteiro: GuideItem[] = [
  {
    id: "porteiro-login",
    icon: KeyRound,
    title: "Acessando o Sistema",
    category: "Primeiros Passos",
    summary: "Como fazer login e navegar pela interface da portaria.",
    steps: [
      {
        title: "Faça login com suas credenciais",
        description:
          "Use o e-mail e senha fornecidos pelo síndico. Se for seu primeiro acesso, siga o processo de ativação com o código TC-XXXXXXXX.",
      },
      {
        title: "Interface da portaria",
        description:
          "Como porteiro, você terá acesso às telas de Acessos, Encomendas e Reservas. O menu é simplificado para focar no essencial da sua função.",
      },
      {
        title: "Notificações em tempo real",
        description:
          "O sistema envia alertas em tempo real: novos acessos autorizados por moradores, entregas registradas por outros porteiros, etc.",
      },
    ],
  },
  {
    id: "porteiro-acesso-entrada",
    icon: ShieldCheck,
    title: "Registrar Entradas e Saídas",
    category: "Controle de Acesso",
    summary: "Como verificar autorizações e registrar o acesso de visitantes.",
    steps: [
      {
        title: "Consulte a lista de autorizados",
        description:
          'Em "Acesso", veja os visitantes autorizados pelos moradores. A lista é atualizada em tempo real — moradores podem adicionar convidados a qualquer momento.',
      },
      {
        title: "Registre a entrada",
        description:
          "Localize o visitante na lista pelo nome ou documento. Clique em 'Registrar Entrada' para registrar a entrada com data e hora automáticos.",
      },
      {
        title: "Visitante não cadastrado",
        description:
          "Se o visitante não está na lista, você pode ligar para o morador responsável ou registrar um acesso avulso informando nome, documento e destino.",
      },
      {
        title: "Registre a saída",
        description:
          "Quando o visitante sair, localize o registro ativo e clique em 'Registrar Saída'. O sistema mantém o histórico completo.",
      },
    ],
    tip: "Para convidados de festas com reserva aprovada, acesse a reserva em 'Reservas' para ver a lista completa de convidados do evento.",
  },
  {
    id: "porteiro-encomendas-receber",
    icon: Package,
    title: "Receber Encomendas",
    category: "Encomendas",
    summary: "Como registrar um pacote recebido de transportadoras.",
    steps: [
      {
        title: "Acesse Encomendas",
        description:
          'No menu, vá em "Encomendas" e clique em "Nova Encomenda".',
      },
      {
        title: "Preencha os dados",
        description:
          "Informe o bloco/unidade de destino (obrigatório), o nome do remetente (ex: Amazon, Mercado Livre) e uma descrição do pacote. Você pode tirar uma foto do pacote.",
      },
      {
        title: "Morador é notificado",
        description:
          "Ao salvar, o morador recebe uma notificação push imediata informando que a encomenda chegou. Guarde o pacote em local seguro.",
      },
    ],
    tip: "Se a unidade não estiver no sistema, entre em contato com o síndico para verificar o cadastro do morador.",
  },
  {
    id: "porteiro-encomendas-entregar",
    icon: CheckCircle2,
    title: "Entregar Encomendas",
    category: "Encomendas",
    summary: "Como registrar a retirada de encomendas pelo morador com PIN.",
    steps: [
      {
        title: "Morador vem retirar",
        description:
          'Quando o morador chegar para retirar, acesse "Encomendas" e localize o pacote pelo bloco/unidade ou nome.',
      },
      {
        title: "Solicite o PIN",
        description:
          "Peça o PIN de 4 dígitos que o morador configurou no sistema. O PIN é pessoal e intransferível.",
      },
      {
        title: "Valide e registre a entrega",
        description:
          "Insira o PIN no campo de validação. Se correto, clique em 'Registrar Entrega'. O sistema registra data, hora e seu nome como porteiro responsável.",
      },
      {
        title: "PIN incorreto",
        description:
          "Se o PIN estiver errado, o sistema bloqueará após 5 tentativas. Oriente o morador a redefinir o PIN no app.",
      },
    ],
    tip: "Nunca entregue uma encomenda sem validar o PIN — isso é uma medida de segurança para proteger o morador.",
  },
  {
    id: "porteiro-reservas",
    icon: CalendarCheck2,
    title: "Controlar Acesso nas Festas",
    category: "Reservas",
    summary: "Como verificar reservas aprovadas e liberar convidados de eventos.",
    steps: [
      {
        title: "Consulte as reservas do dia",
        description:
          'Em "Reservas", você vê as reservas aprovadas para o dia atual. Clique em uma reserva para ver os detalhes e a lista de convidados.',
      },
      {
        title: "Verifique convidados",
        description:
          "A lista de convidados cadastrada pelo morador aparece na reserva. Confira o nome do visitante na lista antes de liberar a entrada.",
      },
      {
        title: "Registre a entrada do convidado",
        description:
          "Clique no convidado e use 'Registrar Entrada' para marcar o horário de chegada. Isso mantém o controle da ocupação da área.",
      },
    ],
  },
  {
    id: "porteiro-incidentes",
    icon: AlertTriangle,
    title: "Registrar Ocorrências",
    category: "Operacional",
    summary: "Como documentar incidentes que ocorrem durante seu turno.",
    steps: [
      {
        title: "Registre o incidente imediatamente",
        description:
          'Em "Incidentes", clique em "Novo Incidente". Registre qualquer ocorrência: dano ao patrimônio, comportamento inadequado, falha de equipamento, etc.',
      },
      {
        title: "Seja detalhado",
        description:
          "Informe horário exato, local, pessoas envolvidas e o que aconteceu. Adicione fotos quando possível. Isso facilita a investigação posterior.",
      },
      {
        title: "Notifique o síndico",
        description:
          "Para incidentes graves (segurança, emergências), além de registrar no sistema, ligue diretamente ao síndico ou responsável de plantão.",
      },
    ],
    tip: "Seu registro é fundamental para o síndico ter visibilidade do que acontece no condomínio fora do horário comercial.",
  },
  {
    id: "porteiro-manutencao",
    icon: Wrench,
    title: "Registrar Execuções de Manutenção",
    category: "Manutenção",
    summary: "Como confirmar que uma manutenção programada foi realizada.",
    steps: [
      {
        title: "Verifique as manutenções do dia",
        description:
          'Em "Manutenção Preventiva", veja as rotinas programadas para execução. As atrasadas aparecem em vermelho.',
      },
      {
        title: "Registre a execução",
        description:
          "Após a manutenção ser feita (pelo zelador ou fornecedor), clique na rotina e registre a execução: data, observações e, se disponível, fotos.",
      },
      {
        title: "Atualize o status",
        description:
          "Após o registro, a rotina é marcada como concluída e a próxima data é calculada automaticamente.",
      },
    ],
  },
];

// =====================================================
// COMPONENTES
// =====================================================

function GuideCard({ guide }: { guide: GuideItem }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div
      className={cn(
        "rounded-2xl border transition-all duration-300",
        open
          ? "border-[#00D0E6]/40 bg-white/[0.08] shadow-[0_8px_40px_rgba(0,208,230,0.12)]"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/20"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left p-5 flex items-start gap-4 focus:outline-none"
      >
        <div
          className={cn(
            "shrink-0 h-11 w-11 rounded-2xl flex items-center justify-center border transition-colors",
            open
              ? "bg-[#00D0E6]/20 border-[#00D0E6]/40"
              : "bg-white/[0.08] border-white/10"
          )}
        >
          <guide.icon
            className={cn(
              "h-5 w-5 transition-colors",
              open ? "text-[#00D0E6]" : "text-white/70"
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">
              {guide.category}
            </span>
          </div>
          <div className="mt-0.5 text-sm font-semibold text-white/90 leading-snug">
            {guide.title}
          </div>
          <div className="mt-1 text-xs text-white/55 leading-relaxed">
            {guide.summary}
          </div>
        </div>

        <div className="shrink-0 mt-1">
          {open ? (
            <ChevronUp className="h-4 w-4 text-[#00D0E6]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-white/40" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div className="h-[1px] bg-white/10" />

          {/* Steps */}
          <ol className="space-y-4">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <div className="shrink-0 h-7 w-7 rounded-full bg-[#00D0E6]/20 border border-[#00D0E6]/30 flex items-center justify-center text-[11px] font-bold text-[#00D0E6] mt-0.5">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/90 leading-snug">
                    {step.title}
                  </div>
                  <div className="mt-1 text-xs text-white/65 leading-relaxed">
                    {step.description}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {/* Tip */}
          {guide.tip && (
            <div className="rounded-xl border border-[#D3EA00]/25 bg-[#D3EA00]/[0.06] px-4 py-3 flex gap-2.5">
              <Star className="h-4 w-4 text-[#D3EA00] shrink-0 mt-0.5" />
              <p className="text-xs text-[#D3EA00]/90 leading-relaxed">
                <strong className="text-[#D3EA00] font-semibold">Dica: </strong>
                {guide.tip}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PROFILE_CONFIG = {
  sindico: {
    label: "Síndico / Administrador",
    icon: Building2,
    color: "#00D0E6",
    description:
      "Gerencie seu condomínio com eficiência: cadastros, reservas, assembleias, comunicados e muito mais.",
    guides: guiasSindico,
  },
  morador: {
    label: "Morador",
    icon: Users,
    color: "#D3EA00",
    description:
      "Tudo que você precisa saber para aproveitar ao máximo o TreeCondo no seu dia a dia.",
    guides: guiasMorador,
  },
  porteiro: {
    label: "Porteiro / Segurança",
    icon: ShieldCheck,
    color: "#22C55E",
    description:
      "Domine as ferramentas de controle de acesso, encomendas e ocorrências do seu turno.",
    guides: guiasPorteiro,
  },
};

// =====================================================
// PAGE
// =====================================================
export default function GuiasPage() {
  const [profile, setProfile] = React.useState<Profile>("morador");
  const [search, setSearch] = React.useState("");

  const config = PROFILE_CONFIG[profile];
  const allGuides = config.guides;

  const filtered = search.trim()
    ? allGuides.filter(
        (g) =>
          g.title.toLowerCase().includes(search.toLowerCase()) ||
          g.summary.toLowerCase().includes(search.toLowerCase()) ||
          g.category.toLowerCase().includes(search.toLowerCase()) ||
          g.steps.some(
            (s) =>
              s.title.toLowerCase().includes(search.toLowerCase()) ||
              s.description.toLowerCase().includes(search.toLowerCase())
          )
      )
    : allGuides;

  // Agrupa por categoria
  const grouped = filtered.reduce((acc, guide) => {
    if (!acc[guide.category]) acc[guide.category] = [];
    acc[guide.category].push(guide);
    return acc;
  }, {} as Record<string, GuideItem[]>);

  const ProfileIcon = config.icon;

  return (
    <div className="tc-login-bg relative min-h-screen overflow-hidden tc-grain tc-typography">
      {/* HEADER */}
      <header className="relative z-20 border-b border-white/10 bg-slate-900/60 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium hidden sm:block">Início</span>
          </Link>

          <div className="h-5 w-[1px] bg-white/20" />

          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#00D0E6]" />
            <span className="font-bold text-white text-sm sm:text-base">
              Central de Guias
            </span>
            <span className="hidden sm:inline text-white/40 text-sm">— TreeCondo</span>
          </div>

          <div className="ml-auto">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] px-4 py-1.5 text-xs font-bold text-slate-900 hover:opacity-90 transition"
            >
              <Zap className="h-3.5 w-3.5" />
              Entrar no Sistema
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/15 bg-white/5 text-[#00D0E6] text-xs font-semibold tracking-wider uppercase mb-6">
          <HelpCircle className="h-3.5 w-3.5" />
          Documentação & Tutoriais
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Como usar o{" "}
          <span className="bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] bg-clip-text text-transparent">
            TreeCondo
          </span>
        </h1>

        <p className="mt-4 text-white/60 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
          Guias passo-a-passo para cada perfil do sistema. Selecione seu perfil e
          encontre respostas rapidamente.
        </p>

        {/* Seletores de perfil */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
          {(Object.entries(PROFILE_CONFIG) as [Profile, typeof config][]).map(
            ([key, cfg]) => {
              const Icon = cfg.icon;
              const isActive = profile === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setProfile(key); setSearch(""); }}
                  className={cn(
                    "w-full sm:w-auto flex items-center gap-3 rounded-2xl px-5 py-3.5 border transition-all duration-200 text-left",
                    isActive
                      ? "border-white/20 bg-white/[0.10] shadow-[0_0_0_1.5px_rgba(255,255,255,0.20)]"
                      : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/15"
                  )}
                  style={isActive ? { boxShadow: `0 0 0 1.5px ${cfg.color}40, 0 8px 30px ${cfg.color}18` } : {}}
                >
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${cfg.color}22`, border: `1px solid ${cfg.color}40` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white/90">{cfg.label}</div>
                    <div className="text-[11px] text-white/45">
                      {cfg.guides.length} guias disponíveis
                    </div>
                  </div>
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* BARRA DE BUSCA */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar nos guias de ${config.label.toLowerCase()}...`}
            className="w-full h-11 rounded-2xl bg-white/[0.06] border border-white/12 pl-11 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00D0E6]/50 focus:ring-1 focus:ring-[#00D0E6]/30 backdrop-blur-xl transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {search && (
          <p className="mt-2 text-xs text-white/40">
            {filtered.length === 0
              ? "Nenhum guia encontrado."
              : `${filtered.length} guia(s) encontrado(s) para "${search}"`}
          </p>
        )}
      </div>

      {/* CONTEÚDO DOS GUIAS */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        {/* Descrição do perfil ativo */}
        {!search && (
          <div
            className="mb-8 rounded-2xl border p-5 flex gap-4 items-start"
            style={{
              background: `${config.color}08`,
              borderColor: `${config.color}25`,
            }}
          >
            <ProfileIcon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: config.color }} />
            <div>
              <div className="text-sm font-semibold text-white/90">{config.label}</div>
              <div className="text-xs text-white/55 mt-0.5 leading-relaxed">{config.description}</div>
            </div>
          </div>
        )}

        {/* Guias agrupados por categoria */}
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <Search className="h-10 w-10 mx-auto mb-4 opacity-30" />
            <p className="text-sm">Nenhum guia encontrado para sua busca.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(grouped).map(([category, guides]) => (
              <section key={category}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white/40">
                    {category}
                  </h2>
                  <div className="flex-1 h-[1px] bg-white/10" />
                  <span className="text-[10px] text-white/30">
                    {guides.length} guia{guides.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="space-y-3">
                  {guides.map((guide) => (
                    <GuideCard key={guide.id} guide={guide} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* CTA final */}
        <div className="mt-16 rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00D0E6]/25 bg-[#00D0E6]/[0.08] px-3 py-1 text-[#00D0E6] text-xs font-semibold mb-4">
            <Zap className="h-3.5 w-3.5" />
            Pronto para começar?
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
            Acesse o TreeCondo agora
          </h3>
          <p className="text-sm text-white/55 mb-6 max-w-md mx-auto">
            Login para síndico, morador ou porteiro. Gestão moderna do seu condomínio.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#00D0E6] to-[#D3EA00] px-6 py-3 text-sm font-bold text-slate-900 hover:opacity-90 transition shadow-lg"
            >
              Acessar o Painel <ArrowLeft className="h-4 w-4 rotate-180" />
            </Link>
            <Link
              href="/login?tab=primeiro"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white hover:bg-white/[0.10] transition"
            >
              Primeiro Acesso
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Importação do X que faltou no topo
function X({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
