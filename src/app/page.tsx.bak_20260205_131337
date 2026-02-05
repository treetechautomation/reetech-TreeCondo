"use client";

import { useEffect, useState } from "react";
import WelcomeMorador from "@/components/welcome/WelcomeMorador";
import AppLayout from "@/components/layout/AppLayout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import { collection, query, where, onSnapshot, Timestamp, orderBy, limit } from "firebase/firestore";
import { Package, AlertCircle, CalendarClock, CalendarCheck2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranding } from "@/contexts/BrandingContext";

export default function Dashboard() {
  const { session } = useSessionCtx();
  const firestore = useFirestore();
  const branding = useBranding();
  
  const condominioId = session?.activeCondominioId;
  const uid = session?.user?.uid;
  const role = session?.role;

  const [encomendasCount, setEncomendasCount] = useState<number | null>(null);
  const [incidentesCount, setIncidentesCount] = useState<number | null>(null);
  const [reservasCount, setReservasCount] = useState<number | null>(null);
  const [proximaAssembleia, setProximaAssembleia] = useState<any | undefined>(undefined);

  useEffect(() => {
    if (!firestore || !condominioId) {
      setEncomendasCount(0);
      setIncidentesCount(0);
      setReservasCount(0);
      setProximaAssembleia(null);
      return;
    }

    const isOperator = role && ["SINDICO", "ADMIN", "PORTEIRO", "ADMIN_CONDOMINIO", "SUPER_ADMIN"].includes(role);
    const unsubs: (() => void)[] = [];

    // 1. Encomendas (Sempre geral para o condomínio)
    const qEncomendas = query(
      collection(firestore, "condominios", condominioId, "encomendas"),
      where("status", "==", "AGUARDANDO")
    );
    unsubs.push(onSnapshot(qEncomendas, (snap) => setEncomendasCount(snap.size)));

    // 2. Incidentes (Filtrado para morador)
    const incidentesRef = collection(firestore, "condominios", condominioId, "incidentes");
    let qIncidentes;
    if (isOperator) {
      qIncidentes = query(incidentesRef, where("status", "in", ["ABERTO", "EM_ANDAMENTO"]));
    } else if (uid) {
      qIncidentes = query(incidentesRef, where("criadoPorUid", "==", uid), where("status", "in", ["ABERTO", "EM_ANDAMENTO"]));
    }
    if (qIncidentes) {
      unsubs.push(onSnapshot(qIncidentes, (snap) => setIncidentesCount(snap.size)));
    }


    // 3. Reservas (Filtrado para morador)
    const reservasRef = collection(firestore, "condominios", condominioId, "reservas");
    const now = Timestamp.now();
    let qReservas;
    if (isOperator) {
      qReservas = query(reservasRef, where("status", "==", "APROVADA"), where("data", ">=", now));
    } else if (uid) {
      qReservas = query(reservasRef, where("uid", "==", uid), where("status", "==", "APROVADA"), where("data", ">=", now));
    }
    if (qReservas) {
      unsubs.push(onSnapshot(qReservas, (snap) => setReservasCount(snap.size)));
    }


    // 4. Assembleia (Sempre geral para o condomínio)
    const qAssembleia = query(
      collection(firestore, "condominios", condominioId, "reunioes"),
      where("tipo", "==", "ASSEMBLEIA"),
      where("status", "==", "AGENDADA"),
      where("dataInicio", ">=", now),
      orderBy("dataInicio", "asc"),
      limit(1)
    );
    unsubs.push(onSnapshot(qAssembleia, (snap) => {
      setProximaAssembleia(snap.empty ? null : snap.docs[0].data());
    }));

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [firestore, condominioId, uid, role]);
  
  return (
    <AppLayout pageTitle="Painel">
      <div className="mb-6">
        {branding.isLoading ? (
          <Skeleton className="h-[160px] w-full rounded-2xl" />
        ) : (
          <WelcomeMorador />
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Novas Encomendas
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {encomendasCount === null ? (
              <Skeleton className="h-8 w-10 mt-1" />
            ) : (
              <div className="text-2xl font-bold">{encomendasCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Aguardando retirada na portaria
            </p>
          </CardContent>
        </Card>

        <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Incidentes Abertos
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {incidentesCount === null ? (
               <Skeleton className="h-8 w-10 mt-1" />
            ) : (
              <div className="text-2xl font-bold">{incidentesCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Aguardando resolução
            </p>
          </CardContent>
        </Card>

        <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Próximas Reservas
            </CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {reservasCount === null ? (
              <Skeleton className="h-8 w-10 mt-1" />
            ) : (
              <div className="text-2xl font-bold">{reservasCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Suas reservas de áreas comuns aprovadas
            </p>
          </CardContent>
        </Card>

        <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Próxima Assembleia
            </CardTitle>
            <CalendarCheck2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {proximaAssembleia === undefined ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : proximaAssembleia ? (
              <div className="text-2xl font-bold">
                {proximaAssembleia.dataInicio.toDate().toLocaleDateString('pt-BR', {
                    day: 'numeric',
                    month: 'long',
                })}
              </div>
            ) : (
              <div className="text-2xl font-bold">-</div>
            )}
            <p className="text-xs text-muted-foreground">
              {proximaAssembleia === undefined 
                ? 'Buscando...'
                : proximaAssembleia?.titulo || "Nenhuma assembleia agendada"}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
