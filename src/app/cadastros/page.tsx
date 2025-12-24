"use client";

import {
  Users,
  Building2,
  CarFront,
  BadgeCheck,
  Dog,
  Truck,
} from "lucide-react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { useCondominio } from "@/contexts/CondominioContext";

const cards = [
  {
    title: "Moradores",
    description: "Gerencie moradores, síndicos e membros da administração.",
    icon: Users,
    href: "/cadastros/moradores",
    disabled: false,
  },
  {
    title: "Funcionários",
    description: "Cadastre porteiros, zeladores e outros funcionários.",
    icon: BadgeCheck,
    href: "/cadastros/funcionarios",
    disabled: true,
  },
  {
    title: "Fornecedores",
    description: "Gerencie empresas e prestadores de serviço terceirizados.",
    icon: Truck,
    href: "/cadastros/fornecedores",
    disabled: true,
  },
  {
    title: "Unidades",
    description: "Visualize e edite a estrutura de blocos e apartamentos.",
    icon: Building2,
    href: "/cadastros/unidades",
    disabled: true,
  },
  {
    title: "Veículos",
    description: "Controle os veículos cadastrados para cada unidade.",
    icon: CarFront,
    href: "/cadastros/veiculos",
    disabled: true,
  },
  {
    title: "Pets",
    description: "Mantenha um registro dos animais de estimação do condomínio.",
    icon: Dog,
    href: "/cadastros/pets",
    disabled: true,
  },
];

export default function CadastrosPage() {
  const { condominioAtivoId } = useCondominio();

  const CardItem = ({
    title,
    description,
    icon: Icon,
    href,
    disabled,
  }: (typeof cards)[0]) => {
    const cardContent = (
      <Card
        className={`group h-full p-5 transition-all ${
          disabled
            ? "cursor-not-allowed bg-card/60"
            : "hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              disabled
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-card-foreground group-hover:text-accent-foreground">
              {title}
            </h2>
            <p className="text-xs text-muted-foreground group-hover:text-accent-foreground">
              {description}
            </p>
            {disabled && (
              <div className="mt-2 inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Em breve
              </div>
            )}
          </div>
        </div>
      </Card>
    );

    if (disabled) {
      return <div>{cardContent}</div>;
    }

    return <Link href={href}>{cardContent}</Link>;
  };

  return (
    <AppLayout pageTitle="Gestão de Cadastros">
      {!condominioAtivoId ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p>Selecione um condomínio para gerenciar os cadastros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <CardItem key={card.title} {...card} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
