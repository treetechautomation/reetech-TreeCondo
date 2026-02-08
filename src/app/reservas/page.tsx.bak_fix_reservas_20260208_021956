"use client";

import * as React from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useReservas, type AreaReservavel } from "@/hooks/useReservas";
import { isSunday, getPoliticasReservas, getStatusForNewReserva } from "@/lib/reservasPoliticas";
import { isDiaDisponivelPorArea } from "@/lib/reservasDisponibilidade";
import { addDoc, collection, serverTimestamp, Timestamp, query, where, orderBy } from "firebase/firestore";

import { AreaCard } from "@/components/reservas/AreaCard";
import { CalendarMonth } from "@/components/reservas/CalendarMonth";
import { AreaOpcaoDialog } from "@/components/reservas/AreaOpcaoDialog";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { List } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Reserva = {
  id: string;
  areaId: string;
  status: string;
  uid: string;
  condominioId: string;
  data: Timestamp;
  dataFim?: Timestamp;
  valorCobrado?: number; // centavos
  criadoEm?: Timestamp;
  areaNome?: string;
};

export default function ReservasPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const firestore = useFirestore();
  const { toast } = useToast();

  const condId = session?.activeCondominioId ?? null;
  const uid = session?.user?.uid ?? null;

  const [dateStr, setDateStr] = React.useState(() => toISODateLocal(new Date()));
  const { areas, loadingAreas } = useReservas(condId, dateStr);

  const [selectedAreaId, setSelectedAreaId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // state para o dialog de opções
  const [showOptionsDialog, setShowOptionsDialog] = React.useState(false);
  const [areaForOptions, setAreaForOptions] = React.useState<AreaReservavel | null>(null);

  const minhasReservasQuery = useMemoFirebase(() => {
    if (!firestore || !condId || !uid) return null;
    return query(
        collection(firestore, "condominios", condId, "reservas"),
        where("uid", "==", uid),
        where("data", ">=", Timestamp.now()),
        orderBy("data", "asc")
    );
  }, [firestore, condId, uid]);

  const { data: minhasReservas, isLoading: isLoadingMinhasReservas } = useCollection<Reserva>(minhasReservasQuery);
  
  const handleSelectArea = (areaId: string) => {
    if (selectedAreaId === areaId) {
      setSelectedAreaId(null); // toggle off
    } else {
      setSelectedAreaId(areaId);
    }
  };
  
  async function handleConfirmReserva(
    area: AreaReservavel,
    selectedDate: string,
    opcao?: { opcaoId: string; opcaoNome: string; precoCentavos: number; bloqueiaAreaId?: string | null; }
  ) {
    if (!firestore || !condId || !uid) {
      toast({ variant: "destructive", title: "Erro", description: "Sessão inválida." });
      return;
    }
    
    setBusy(true);
    
    try {
      // 1. Validar políticas
      const politicas = await getPoliticasReservas(firestore, condId);
      if (politicas.bloquearDomingo && isSunday(selectedDate)) {
        throw new Error("Não é permitido reservar aos domingos.");
      }

      // 2. Validar disponibilidade
      const { disponivel } = await isDiaDisponivelPorArea(firestore, condId, area.id, selectedDate);
      if (!disponivel) {
        throw new Error("Esta data não está mais disponível para a área selecionada.");
      }
      
      const status = getStatusForNewReserva(selectedDate, politicas);
      
      const [y, m, d] = selectedDate.split("-").map(Number);
      const dataReserva = Timestamp.fromDate(new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0))); // Salva ao meio-dia UTC

      const payload: any = {
        areaId: area.id,
        areaNome: area.nome,
        data: dataReserva,
        status,
        uid,
        condominioId: condId,
        criadoEm: serverTimestamp(),
        valorCobrado: opcao ? opcao.precoCentavos : area.preco,
        opcaoId: opcao?.opcaoId ?? null,
        opcaoNome: opcao?.opcaoNome ?? null,
        bloqueiaAreaId: opcao?.bloqueiaAreaId ?? null,
      };

      await addDoc(collection(firestore, "condominios", condId, "reservas"), payload);

      toast({
        title: "Reserva solicitada!",
        description: `Sua reserva para ${area.nome} em ${selectedDate} foi enviada. Status: ${status}`,
      });
      
      setSelectedAreaId(null);

    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao reservar", description: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectDate(area: AreaReservavel, selectedDate: string) {
    setDateStr(selectedDate);
    
    if (area.opcoes && area.opcoes.length > 0) {
      setAreaForOptions(area);
      setShowOptionsDialog(true);
    } else {
      await handleConfirmReserva(area, selectedDate);
    }
  }

  if (isSessionLoading) return <AppLayout pageTitle="Reservas">Carregando...</AppLayout>;
  if (!condId) return <AppLayout pageTitle="Reservas">Selecione um condomínio.</AppLayout>;

  return (
    <AppLayout pageTitle="Reservar Área Comum">
      <div className="space-y-6">
        <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
            <CardHeader>
                <CardTitle>Minhas Próximas Reservas</CardTitle>
                <CardDescription>Gerencie a lista de convidados para suas reservas futuras.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingMinhasReservas ? (
                    <p>Carregando suas reservas...</p>
                ) : minhasReservas && minhasReservas.length > 0 ? (
                    <div className="space-y-2">
                        {minhasReservas.map(reserva => (
                            <div key={reserva.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 border rounded-lg gap-3">
                                <div>
                                    <p className="font-semibold">{reserva.areaNome}</p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm text-muted-foreground">
                                            {reserva.data.toDate().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                        <Badge variant={reserva.status === 'APROVADA' ? 'default' : 'secondary'}>{reserva.status}</Badge>
                                    </div>
                                </div>
                                <Button asChild variant="outline" size="sm">
                                    <Link href={`/reservas/convidados/${reserva.id}`}>
                                        <List className="mr-2 h-4 w-4" />
                                        Lista de Convidados
                                    </Link>
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Você não tem nenhuma reserva futura.</p>
                )}
            </CardContent>
        </Card>

        <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
            <CardHeader>
                <CardTitle>Reservar Nova Área</CardTitle>
                <CardDescription>Selecione uma área abaixo para ver a disponibilidade e reservar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            {loadingAreas ? (
              <p>Carregando áreas...</p>
            ) : areas.length === 0 ? (
              <p>Nenhuma área de reserva encontrada para este condomínio.</p>
            ) : (
              areas.map((area) => (
                <AreaCard
                  key={area.id}
                  area={area}
                  selected={selectedAreaId === area.id}
                  onSelect={() => handleSelectArea(area.id)}
                >
                  {selectedAreaId === area.id && (
                    <CalendarMonth
                      firestore={firestore}
                      condominioId={condId}
                      areaId={area.id}
                      selectedDateStr={dateStr}
                      onSelectDateStr={(newDate) => handleSelectDate(area, newDate)}
                    />
                  )}
                </AreaCard>
              ))
            )}
            </CardContent>
        </Card>
      </div>
      
      {areaForOptions && (
        <AreaOpcaoDialog
            open={showOptionsDialog}
            onOpenChange={setShowOptionsDialog}
            areaNome={areaForOptions.nome}
            precoBaseCentavos={areaForOptions.preco}
            opcoes={areaForOptions.opcoes ?? []}
            selectedOpcaoId={null} // Começa sem seleção
            onConfirm={(opcaoSelecionada) => {
                handleConfirmReserva(areaForOptions, dateStr, opcaoSelecionada);
                setShowOptionsDialog(false);
            }}
        />
      )}
    </AppLayout>
  );
}
