"use client";

import React from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { useSessionCtx } from "@/contexts/SessionContext";
import { fetchMenuPermissions, DEFAULT_PERMS, type MenuKey, type MenuPermissions } from "@/lib/menuPermissions";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { navIconColor } from "@/lib/navigationIconColors";

import {
  CalendarCheck2,
  ClipboardList,
  Package,
  Megaphone,
  AlertTriangle,
  Users,
  Building2,
  KeyRound,
  FileText,
  BarChart3,
  UsersRound,
  Wrench,
  Settings,
  Shield,
  User,
  ShoppingBag,
  DollarSign,
  ArrowLeft,
  LayoutDashboard,
} from "lucide-react";

type Item = {
  key: MenuKey;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc?: string;
};

type Category = {
  title: string;
  items: Item[];
};

function Tile({
  item,
  selected,
  onPick,
}: {
  item: any;
  selected: boolean;
  onPick: (key: string, href: string) => void;
}) {
  const iconColor = navIconColor(item.key);

  return (
    <button
      type="button"
      onClick={() => onPick(item.key, item.href)}
      aria-pressed={selected}
      className={[
        "group w-full text-left rounded-2xl p-5",
        "bg-white/[0.06] hover:bg-white/[0.09] transition-all",
        "border border-white/12",
        "shadow-[0_10px_30px_rgba(0,0,0,.18)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d0e6]/70",
        selected ? "ring-2 ring-[#00d0e6]/60 shadow-[0_0_0_2px_rgba(0,208,230,.20),0_20px_60px_rgba(0,208,230,.10)]" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-4 min-w-0">
        <div className="h-10 w-10 shrink-0 rounded-2xl border border-white/12 bg-black/20 flex items-center justify-center">
          <item.icon
            className="h-5 w-5 transition-all group-hover:drop-shadow-[0_0_10px_rgba(0,208,230,.35)]"
            style={{ color: selected ? "#00d0e6" : iconColor }}
          />
        </div>

        <div className="min-w-0">
          <div className="font-semibold text-[13px] leading-tight text-white/90 whitespace-normal break-words transition-all group-hover:text-[#00d0e6] group-hover:drop-shadow-[0_0_10px_rgba(0,208,230,.55)]">
            {item.label}
          </div>
          <div className="mt-1 text-[12px] leading-snug text-white/65 whitespace-normal break-words">
            {item.desc}
          </div>
        </div>
      </div>
    </button>
  );
}


export default function MenuPage() {
  const { session, isSessionLoading } = useSessionCtx();

  const router = useRouter();
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

  const handleCardClick = (key: string, href: string) => {
    if (selectedKey === key) {
      router.push(href);
      return;
    }
    setSelectedKey(key);
  };


  const isSuper =
    Boolean((session as any)?.superAdmin) ||
    Boolean((session as any)?.isSuperAdmin) ||
    Boolean((session as any)?.super_admin) ||
    String((session as any)?.role || session?.role || "").toUpperCase() === "SUPER_ADMIN";

  const [perms, setPerms] = React.useState<MenuPermissions | null>(null);

  React.useEffect(() => {
    if (isSessionLoading || !session?.activeCondominioId) {
      setPerms(null);
      return;
    }

    (async () => {
      try {
        const condoId = session.activeCondominioId;
        const p = condoId ? await fetchMenuPermissions(condoId) : null;
        setPerms(p);
      } catch {
        setPerms(null);
      }
    })();
  }, [isSessionLoading, session?.activeCondominioId]);

  function isAllowed(menuKey: MenuKey) {
    if (!session) return false;

    if (isSuper) {
      // mantém a mesma regra do AppLayout
      return menuKey !== "administrador_global" || session.user.email === "treecommunity@treetechautomation.com";
    }

    const role = session.role;
    if (!role || role === "SUPER_ADMIN") return false;

    const docPerms = perms?.[role]?.[menuKey];
    if (typeof docPerms === "boolean") return docPerms;

    const fallback = DEFAULT_PERMS?.[role]?.[menuKey];
    return !!fallback;
  }

  const categories: Category[] = [
    {
      title: "Operacional",
      items: [
        { key: "dashboard", href: "/painel", label: "Dashboard", icon: LayoutDashboard, desc: "Painel de controle principal" },
        { key: "reservas", href: "/reservas", label: "Reservas", icon: CalendarCheck2, desc: "Agendar áreas comuns" },
        { key: "reservas_solicitacoes", href: "/reservas/solicitacoes", label: "Solicitações de Reservas", icon: ClipboardList, desc: "Aprovar / recusar" },
        { key: "encomendas", href: "/encomendas", label: "Encomendas", icon: Package, desc: "Controle de entregas" },
        { key: "anuncios", href: "/anuncios", label: "Anúncios", icon: Megaphone, desc: "Comunicados do condomínio" },
        { key: "incidentes", href: "/incidentes", label: "Incidentes", icon: AlertTriangle, desc: "Ocorrências e registros" },
        { key: "comunidade", href: "/comunidade", label: "Comunidade", icon: ShoppingBag, desc: "Mural social, classificados e indicações" },
      ],
    },
    {
      title: "Gestão",
      items: [
        { key: "cadastros", href: "/cadastros", label: "Cadastros", icon: Users, desc: "Moradores, síndicos, etc." },
        { key: "meus_dados", href: "/cadastros/meus-dados", label: "Meus Dados", icon: User, desc: "Seus veículos e pets" },
        { key: "financeiro", href: "/financeiro", label: "Financeiro", icon: DollarSign, desc: "Mensalidades e boletos Pix" },
        { key: "condominios", href: "/condominios", label: "Condomínios", icon: Building2, desc: "Gerir condomínios" },
        { key: "acesso", href: "/acesso", label: "Acesso", icon: KeyRound, desc: "Usuários e permissões" },
        { key: "documentos", href: "/documentos", label: "Documentos", icon: FileText, desc: "Arquivos e atas" },
        { key: "enquetes", href: "/enquetes", label: "Enquetes", icon: BarChart3, desc: "Votações rápidas" },
        { key: "reunioes", href: "/reunioes", label: "Reuniões", icon: UsersRound, desc: "Pautas e presença" },
        { key: "manutencao_preventiva", href: "/manutencao-preventiva", label: "Manutenção Preventiva", icon: Wrench, desc: "Rotinas e checklists" },
      ],
    },
    {
      title: "Sistema",
      items: [
        { key: "configuracoes", href: "/configuracoes", label: "Configurações", icon: Settings, desc: "Preferências do sistema" },
        { key: "whatsapp_logs", href: "/admin/whatsapp-logs", label: "Logs de WhatsApp", icon: Megaphone, desc: "Histórico de disparos de notificações" },
        { key: "administrador_global", href: "/administrador-global", label: "Administrador Global", icon: Shield, desc: "Somente super-admin" },
      ],
    },
  ];

  const filtered = categories
    .map((c) => ({ ...c, items: c.items.filter((i) => isAllowed(i.key)) }))
    .filter((c) => c.items.length > 0);

  return (
    <AppLayout
      pageTitle={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-xl p-1 text-slate-900 hover:text-[#00d0e6] transition-colors"
            onClick={() => router.push("/painel")}
            title="Voltar ao Painel"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span>Menu</span>
        </div>
      }
      hideMobileMenuButton={true}
    >
      <div className="p-4 lg:p-6 space-y-6">
        <div className="space-y-1">
          <p className="text-white/70">Atalhos e navegação.</p>
        </div>

        {filtered.map((cat) => (
          <section key={cat.title} className="space-y-3">
            <div className="flex flex-col items-start gap-2">
              <h2 className="text-sm font-semibold text-white/85 tracking-wide">{cat.title.toUpperCase()}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cat.items.map((it) => (
                <Tile
                    key={it.href}
                    item={it}
                    selected={selectedKey === it.key}
                    onPick={handleCardClick}
                  />
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppLayout>
  );
}
