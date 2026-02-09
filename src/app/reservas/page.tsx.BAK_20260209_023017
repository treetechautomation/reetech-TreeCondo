"use client";

import * as React from "react";
import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useCondominio } from "@/contexts/CondominioContext";
import { useFirestore, useMemoFirebase } from "@/firebase";
import { useReservas, type AreaReservavel } from "@/hooks/useReservas";
import { isSunday, getPoliticasReservas, getStatusForNewReserva } from "@/lib/reservasPoliticas";
import { isDiaDisponivelPorArea } from "@/lib/reservasDisponibilidade";
import { addDoc, collection, serverTimestamp, Timestamp, query, where, orderBy, onSnapshot} from "firebase/firestore";

import { AreaCard } from "@/components/reservas/AreaCard";
import { CalendarMonth } from "@/components/reservas/CalendarMonth";
import { AreaOpcaoDialog } from "@/components/reservas/AreaOpcaoDialog";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfTodayTs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
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
  const { condominioAtivoId } = useCondominio();
  const firestore = useFirestore();
  const { toast } = useToast();

  const condId = condominioAtivoId ?? (session as any)?.activeCondominioId ?? session?.activeCondominioId ?? null;
  const uid = session?.user?.uid ?? null;


  const roleRaw: any = (session as any)?.role ?? session?.role ?? null;
  const roleUpper = String(roleRaw ?? "").toUpperCase().trim();
  const isPorteiro = roleUpper === "PORTEIRO";
  const [dateStr, setDateStr] = React.useState(() => toISODateLocal(new Date()));
  const { areas, loadingAreas } = useReservas(condId, dateStr);

  const [selectedAreaId, setSelectedAreaId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [minhasReservasFuturas, setMinhasReservasFuturas] = React.useState<Reserva[]>([]);
  const [isLoadingMinhasReservas, setIsLoadingMinhasReservas] = React.useState(true);
  const [historicoReservas, setHistoricoReservas] = React.useState<Reserva[]>([]);
  const [isLoadingHistorico, setIsLoadingHistorico] = React.useState(true);

  React.useEffect(() => {
    if (!firestore || !condId || !uid) {
      setMinhasReservasFuturas([]);
      setIsLoadingMinhasReservas(false);
      setHistoricoReservas([]);
      setIsLoadingHistorico(false);
      return;
    }

    setIsLoadingMinhasReservas(true);
    setIsLoadingHistorico(true);

    const base = collection(firestore, "condominios", String(condId), "reservas");
    const today = startOfTodayTs();
    const uidsToQuery = ['uid', 'userId', 'moradorUid', 'createdByUid'];

    // --- Futuras ---
    const futureQueries = uidsToQuery.map(field => 
        query(base, where(field, "==", uid), where("data", ">=", today), orderBy("data", "asc"))
    );
    const futureMap = new Map();
    let pendingFuture = futureQueries.length;
    const unsubFuture = futureQueries.map((q) => 
        onSnapshot(q, (snap) => {
            snap.forEach((d) => futureMap.set(d.id, { id: d.id, ...(d.data() || {}) }));
            pendingFuture--;
            if (pendingFuture <= 0) {
                const arr = Array.from(futureMap.values())
                    .filter((r: any) => r && r.data && typeof r.data.toDate === "function")
                    .sort((a, b) => (a.data?.toMillis?.() ?? 0) - (b.data?.toMillis?.() ?? 0));
                setMinhasReservasFuturas(arr as Reserva[]);
                setIsLoadingMinhasReservas(false);
            }
        }, (err) => { 
            console.error("[reservas] erro ao carregar minhas reservas futuras:", err);
            pendingFuture--;
            if(pendingFuture <= 0) setIsLoadingMinhasReservas(false);
        })
    );

    // --- Histórico ---
    const pastQueries = uidsToQuery.map(field => 
        query(base, where(field, "==", uid), where("data", "<", today), orderBy("data", "desc"))
    );
    const pastMap = new Map();
    let pendingPast = pastQueries.length;
    const unsubPast = pastQueries.map((q) => 
        onSnapshot(q, (snap) => {
            snap.forEach((d) => pastMap.set(d.id, { id: d.id, ...(d.data() || {}) }));
            pendingPast--;
            if (pendingPast <= 0) {
                const arr = Array.from(pastMap.values())
                    .filter((r: any) => r && r.data && typeof r.data.toDate === "function")
                    .sort((a, b) => (b.data?.toMillis?.() ?? 0) - (a.data?.toMillis?.() ?? 0));
                setHistoricoReservas(arr as Reserva[]);
                setIsLoadingHistorico(false);
            }
        }, (err) => {
             console.error("[reservas] erro ao carregar histórico de reservas:", err);
            pendingPast--;
            if(pendingPast <= 0) setIsLoadingHistorico(false);
        })
    );

    return () => {
      unsubFuture.forEach(u => u());
      unsubPast.forEach(u => u());
    };
  }, [firestore, condId, uid]);


  // state para o dialog de opções
  const [showOptionsDialog, setShowOptionsDialog] = React.useState(false);
  const [areaForOptions, setAreaForOptions] = React.useState<AreaReservavel | null>(null);

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
        <Tabs defaultValue="proximas">
            <TabsList>
                <TabsTrigger value="proximas">Próximas Reservas</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="proximas">
                <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
                    <CardHeader>
                        <CardTitle>Minhas Próximas Reservas</CardTitle>
                        <CardDescription>Gerencie a lista de convidados para suas reservas futuras.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingMinhasReservas ? (
                            <p>Carregando suas reservas...</p>
                        ) : minhasReservasFuturas && minhasReservasFuturas.length > 0 ? (
                            <div className="space-y-2">
                                {minhasReservasFuturas.map(reserva => (
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
                                            <Link href={isPorteiro ? `/reservas/convidados-checkin/${reserva.id}` : `/reservas/convidados/${reserva.id}`}>
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
            </TabsContent>
            <TabsContent value="historico">
                <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
                    <CardHeader>
                        <CardTitle>Histórico de Reservas</CardTitle>
                        <CardDescription>Suas reservas passadas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingHistorico ? (
                            <p>Carregando seu histórico...</p>
                        ) : historicoReservas && historicoReservas.length > 0 ? (
                            <div className="space-y-2">
                                {historicoReservas.map(reserva => (
                                    <div key={reserva.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 border rounded-lg gap-3 opacity-70">
                                        <div>
                                            <p className="font-semibold">{reserva.areaNome}</p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm text-muted-foreground">
                                                    {reserva.data.toDate().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                </p>
                                                <Badge variant={reserva.status === 'CANCELADA' || reserva.status === 'REJEITADA' ? 'destructive' : 'secondary'}>{reserva.status}</Badge>
                                            </div>
                                        </div>
                                        <Button asChild variant="outline" size="sm">
                                            <Link href={isPorteiro ? `/reservas/convidados-checkin/${reserva.id}` : `/reservas/convidados/${reserva.id}`}>
                                                <List className="mr-2 h-4 w-4" />
                                                Ver Detalhes
                                            </Link>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Nenhuma reserva em seu histórico.</p>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

        <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm mt-6">
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
