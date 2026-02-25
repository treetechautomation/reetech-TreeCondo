"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type Props = {
  label?: string;
  className?: string;
};

export default function BackButton({ label = "Voltar", className }: Props) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      className={`tc-btn-soft flex items-center gap-2 ${className ?? ""}`}
      onClick={() => router.back()}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
