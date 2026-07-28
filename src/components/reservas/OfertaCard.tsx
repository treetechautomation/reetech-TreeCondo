"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Calendar, CreditCard, Building2 } from "lucide-react";

export interface OfertaCardProps {
  areaNome: string;
  areaId: string;
  dateStr: string;
  blocoNome?: string;
  valorCentavos: number;
  offerExpiresAt: Date;
  onAccept: () => void;
  onReject: () => void;
}

function formatBRL(centavos: number): string {
  if (!centavos || centavos <= 0) return "Grátis";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(y, (m || 1) - 1, d || 1));
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function OfertaCard({
  areaNome,
  areaId,
  dateStr,
  blocoNome,
  valorCentavos,
  offerExpiresAt,
  onAccept,
  onReject,
}: OfertaCardProps) {
  const [remainingMs, setRemainingMs] = React.useState<number>(0);
  const rafRef = React.useRef<number>(0);

  React.useEffect(() => {
    function tick() {
      const now = Date.now();
      const diff = offerExpiresAt.getTime() - now;
      setRemainingMs(diff > 0 ? diff : 0);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [offerExpiresAt]);

  const expired = remainingMs <= 0;

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border-2 border-[#FFDE21] bg-gradient-to-b from-[#FFFBEB] to-white p-6 shadow-lg">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFDE21] text-[#8A6A00]">
          <Calendar className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[#8A6A00]">
            Oferta de reserva disponível
          </div>
          <div className="text-lg font-bold text-[#5A4400]">{areaNome}</div>
        </div>
      </div>

      <div className="mb-4 space-y-2 rounded-xl bg-white/80 p-4 text-sm">
        <div className="flex items-center gap-2 text-[#5A4400]">
          <Calendar className="h-4 w-4 shrink-0" />
          <span>{formatDate(dateStr)}</span>
        </div>
        <div className="flex items-center gap-2 text-[#5A4400]">
          <Clock className="h-4 w-4 shrink-0" />
          <span>Dia inteiro</span>
        </div>
        {blocoNome && (
          <div className="flex items-center gap-2 text-[#5A4400]">
            <Building2 className="h-4 w-4 shrink-0" />
            <span>Bloco {blocoNome}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-[#5A4400]">
          <CreditCard className="h-4 w-4 shrink-0" />
          <span>{formatBRL(valorCentavos)}</span>
        </div>
      </div>

      <div
        className={`mb-5 rounded-xl p-4 text-center ${
          expired
            ? "bg-red-50 border border-red-200"
            : "bg-[#FFDE21]/20 border border-[#FFDE21]/40"
        }`}
      >
        {expired ? (
          <div className="text-sm font-semibold text-red-600">
            Sua oferta expirou.
          </div>
        ) : (
          <div>
            <div className="text-xs font-medium text-[#8A6A00]">
              Tempo restante para aceitar
            </div>
            <div className="text-2xl font-bold tabular-nums tracking-tight text-[#5A4400]">
              {formatTimeRemaining(remainingMs)}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          className="flex-1 bg-green-600 text-white hover:bg-green-700"
          onClick={onAccept}
          disabled={expired}
        >
          Aceitar
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="flex-1"
          onClick={onReject}
        >
          Recusar
        </Button>
      </div>
    </div>
  );
}
