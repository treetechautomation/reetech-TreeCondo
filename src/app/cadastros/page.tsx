"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import Link from "next/link";
import {
  Users,
  Building2,
  CarFront,
  BadgeCheck,
} from "lucide-react";

const cards = [
  {
    title: "Pessoas (moradores, síndicos, porteiros)",
    description:
      "Cadastre e gerencie todos os perfis vinculados ao condomínio.",
    icon: Users,
    href: "/cadastros/pessoas",
  },
  {
    title: "Unidades / Blocos",
    description:
      "Mantenha o cadastro das unidades e vincule responsáveis.",
    icon: Building2,
    href: "/cadastros/unidades",
    disabled: true,
  },
  {
    title: "Veículos",
    description:
      "Controle veículos de moradores e visitantes.",
    icon: CarFront,
    href: "/cadastros/veiculos",
    disabled: true,
  },
  {
    title: "Funcionários / Prestadores",
    description:
      "Cadastre equipe interna e prestadores de serviço.",
    icon: BadgeCheck,
    href: "/cadastros/funcionarios",
    disabled: true,
  },
];

export default function CadastrosPage() {
  return (
    <AppLayout pageTitle="Gestão de Cadastros">
      <div className="max-w-6xl mx-auto py-8">
        <p className="text-sm text-muted-foreground mb-6">
          Escolha um tipo de cadastro para gerenciar. Por enquanto só
          vamos ativar <strong>Pessoas</strong>, os demais ficam como
          “em breve”.
        </p>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            const content = (
              <div
                className={`group relative h-full rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md ${
                  card.disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-foreground mb-1">
                      {card.title}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {card.description}
                    </p>
                    {card.disabled && (
                      <p className="mt-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Em breve
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );

            if (card.disabled) {
              return (
                <div key={card.title} className="h-full">
                  {content}
                </div>
              );
            }

            return (
              <Link key={card.title} href={card.href} className="h-full">
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
