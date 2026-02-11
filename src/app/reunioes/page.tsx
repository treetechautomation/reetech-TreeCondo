"use client";

import * as React from "react";
import { PlusCircle, FileDown, CalendarDays } from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

import { useToast } from "@/hooks/use-toast";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";

import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  type Firestore,
  doc, updateDoc
} from "firebase/firestore";

import { CalendarMonthReunioes } from "@/components/reunioes/CalendarMonthReunioes";

type ReuniaoTipo = "ASSEMBLEIA" | "CONSELHO" | "REUNIAO" | "OUTRA";
type ReuniaoStatus = "AGENDADA" | "ENCERRADA" | "CANCELADA";

type Reuniao = {
  id: string;
  titulo: string;
  tipo: ReuniaoTipo;
  local: string;
  dataInicio: any;
  status: ReuniaoStatus;
  pautas: string[];
  createdAt?: any;
  updatedAt?: any;
  createdByUid?: string;
  createdByNome?: string;
};

function toISODateLocal(d: Date) {
  if (!d || !(d instanceof Date)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function sameIsoDay(dateValue: any, isoDay: string) {
  if (!dateValue?.toDate) return false;
  const d = dateValue.toDate() as Date;
  return toISODateLocal(d) === isoDay;
}
function formatDateTimeBR(v: any) {
  if (!v?.toDate) return "-";
  const d = v.toDate() as Date;
  return d.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
}
function isOperator(role?: string | null) {
  const r = String(role || "").toUpperCase();
  return ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"].includes(r);
}
function buildDateFromDayAndTime(day: Date, hhmm: string) {
  const [hh, mm] = String(hhmm || "").split(":").map((x) => Number(x));
  const h = Number.isFinite(hh) ? hh : 0;
  const m = Number.isFinite(mm) ? mm : 0;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
}

function ReuniaoCard({ reuniao, canManage, onEdit, onCancel }: { reuniao: Reuniao; canManage: boolean; onEdit: (r: Reuniao) => void; onCancel: (id: string) => void; }) {
    return (
        <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-base">{reuniao.titulo}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                            {formatDateTimeBR(reuniao.dataInicio)}
                        </CardDescription>
                    </div>
                    <Badge variant={reuniao.status === 'AGENDADA' ? 'default' : 'secondary'}>{reuniao.status}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground"><strong>Local:</strong> {reuniao.local}</p>
                {reuniao.pautas?.length > 0 && (
                    <div>
                        <p className="text-sm font-medium">Pautas:</p>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground">
                            {reuniao.pautas.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                    </div>
                )}
            </CardContent>
            {canManage && (
                <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(reuniao)} disabled={reuniao.status !== 'AGENDADA'}>Editar</Button>
                    <Button variant="destructive" size="sm" onClick={() => onCancel(reuniao.id)} disabled={reuniao.status !== 'AGENDADA'}>Cancelar</Button>
                </CardFooter>
            )}
        </Card>
    )
}

export default function ReunioesPage() {
  const firestore = useFirestore();
  const { session } = useSessionCtx();
  const { toast } = useToast();

  const condominioId = session?.activeCondominioId ?? null;

  const uid = session?.user?.uid ?? null;
  const role = session?.role ?? null;

  const canManage = isOperator(role);

  const [selectedDateStr, setSelectedDateStr] = React.useState(() => toISODateLocal(new Date()));

  const [loading, setLoading] = React.useState(true);
  const [reunioes, setReunioes] = React.useState<Reuniao[]>([]);

  const [openDialog, setOpenDialog] = React.useState(false);
  const [titulo, setTitulo] = React.useState("");
  const [tipo, setTipo] = React.useState<ReuniaoTipo>("ASSEMBLEIA");
  const [local, setLocal] = React.useState("Salão de Festas");
  const [localOutro, setLocalOutro] = React.useState("");
  const localOutroRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (local === "__OUTRO__") {
      const t = setTimeout(() => {
        localOutroRef.current?.focus();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [local]);

  const [day, setDay] = React.useState<Date>(() => new Date());
  const [startTime, setStartTime] = React.useState("19:00");
  const [pautasText, setPautasText] = React.useState("");
  
  const [editingId, setEditingId] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    if (!firestore || !condominioId) {
      setReunioes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = collection(firestore, `condominios/${condominioId}/reunioes`);
    const qy = query(ref, orderBy("dataInicio", "desc"));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Reuniao[];
        setReunioes(list);
        setLoading(false);
      },
      (err) => {
        console.error("[reunioes] erro onSnapshot:", err);
        setReunioes([]);
        setLoading(false);
      }
    );

    return unsub;
  }, [firestore, condominioId]);

  const reunioesDoDia = React.useMemo(() => {
    return reunioes
      .filter((r) => sameIsoDay(r.dataInicio, selectedDateStr))
      .sort((a, b) => {
        const da = a.dataInicio?.toDate?.()?.getTime?.() ?? 0;
        const db = b.dataInicio?.toDate?.()?.getTime?.() ?? 0;
        return da - db;
      });
  }, [reunioes, selectedDateStr]);

  const proximas = React.useMemo(() => {
    const now = Date.now();
    return reunioes
      .filter((r) => (r.dataInicio?.toDate?.()?.getTime?.() ?? 0) >= (now - 24 * 3600 * 1000))
      .sort((a, b) => {
        const da = a.dataInicio?.toDate?.()?.getTime?.() ?? 0;
        const db = b.dataInicio?.toDate?.()?.getTime?.() ?? 0;
        return da - db;
      })
      .slice(0, 50);
  }, [reunioes]);

  async function handleCreate() {
    if (!firestore || !condominioId || !uid) return;

    const tituloOk = titulo.trim();
    if (!tituloOk) {
      toast({ variant: "destructive", title: "Título obrigatório" });
      return;
    }

    const dataInicio = buildDateFromDayAndTime(day, startTime);
    if (!(dataInicio instanceof Date) || isNaN(dataInicio.getTime())) {
      toast({ variant: "destructive", title: "Data/Horário inválidos" });
      return;
    }

    const pautas = String(pautasText || "")
      .split("\n")
      .map((x) => x.replace(/^\s*\d+\.\s*/, "").trim())
      .filter(Boolean);

    const localFinal = local === "__OUTRO__" ? String(localOutro || "").trim() : String(local || "").trim();
    if (!localFinal) {
      toast({ variant: "destructive", title: "Informe o local" });
      return;
    }

    try {
      const payload = {
        titulo: tituloOk,
        tipo,
        local: localFinal,
        dataInicio: Timestamp.fromDate(dataInicio),
        pautas,
        status: "AGENDADA",
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(firestore, `condominios/${condominioId}/reunioes/${editingId}`), payload);
        toast({ title: "Reunião atualizada!" });
      } else {
        await addDoc(collection(firestore, `condominios/${condominioId}/reunioes`), {
          ...payload,
          createdAt: serverTimestamp(),
          createdByUid: uid,
          createdByNome: ((session as any)?.user?.nome || (session as any)?.user?.displayName || session?.user?.email || ""),
        });
        toast({ title: "Reunião agendada!" });
      }

      setOpenDialog(false);
      setEditingId(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: String(e?.message || e) });
    }
  }


  function startEdit(r: any) {
    // abre modal já preenchido
    setEditingId(String(r.id || ""));
    setTitulo(String(r.titulo || ""));
    setTipo((String(r.tipo || "REUNIAO").toUpperCase()) as any);

    const dt = r.dataInicio?.toDate ? r.dataInicio.toDate() : (r.dataInicio instanceof Date ? r.dataInicio : new Date());
    setDay(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0));
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    setStartTime(`${hh}:${mm}`);

    const loc = String(r.local || "").trim();
    const known = ["Salão de Festas", "Sala de Reuniões", "Churrasqueira"];
    if (known.includes(loc)) {
      setLocal(loc);
      setLocalOutro("");
    } else {
      setLocal("__OUTRO__");
      setLocalOutro(loc);
    }

    const pautas = Array.isArray(r.pautas) ? r.pautas : [];
    setPautasText(pautas.join("\n"));

    setOpenDialog(true);
  }

  async function cancelReuniao(id: string) {
    if (!firestore || !condominioId) return;
    try {
      await updateDoc(doc(firestore, `condominios/${condominioId}/reunioes/${id}`), {
        status: "CANCELADA",
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Reunião cancelada." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao cancelar", description: String(e?.message || e) });
    }
  }


  return (
    <AppLayout
      pageTitle="Reuniões"
      headerActions={
          canManage ? (
            <Dialog open={openDialog} onOpenChange={(v) => { if(!v) setEditingId(null); setOpenDialog(v); }}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingId(null);
                    setTitulo('');
                    setTipo('ASSEMBLEIA');
                    setLocal('Salão de Festas');
                    setLocalOutro('');
                    setDay(new Date());
                    setStartTime('19:00');
                    setPautasText('');
                    setOpenDialog(true);
                  }}
                >
                  <PlusCircle className="mr-2" />
                  <span className="hidden sm:inline-block">Nova Reunião</span>
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar Reunião" : "Agendar Nova Reunião"}</DialogTitle>
                  <DialogDescription>
                    {editingId ? "Atualize os detalhes da reunião." : "Preencha os detalhes para agendar e notificar os moradores."}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="reuniao-titulo" className="text-right">Título</Label>
                    <Input id="reuniao-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="reuniao-tipo" className="text-right">Tipo</Label>
                      <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                          <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="ASSEMBLEIA">Assembleia</SelectItem>
                              <SelectItem value="CONSELHO">Reunião do Conselho</SelectItem>
                              <SelectItem value="REUNIAO">Reunião Geral</SelectItem>
                              <SelectItem value="OUTRA">Outra</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="reuniao-data" className="text-right">Data</Label>
                      <Input id="reuniao-data" type="date" value={toISODateLocal(day)} onChange={(e) => setDay(new Date(e.target.value.replace(/-/g, '/')))} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="reuniao-hora" className="text-right">Horário</Label>
                      <Input id="reuniao-hora" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="reuniao-local" className="text-right">Local</Label>
                      <Select value={local} onValueChange={setLocal}>
                          <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="Salão de Festas">Salão de Festas</SelectItem>
                              <SelectItem value="Sala de Reuniões">Sala de Reuniões</SelectItem>
                              <SelectItem value="Churrasqueira">Churrasqueira</SelectItem>
                              <SelectItem value="__OUTRO__">Outro...</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  {local === "__OUTRO__" && (
                      <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="reuniao-local-outro" className="text-right">Qual?</Label>
                          <Input id="reuniao-local-outro" ref={localOutroRef} value={localOutro} onChange={(e) => setLocalOutro(e.target.value)} className="col-span-3" />
                      </div>
                  )}
                  <div className="grid grid-cols-4 items-start gap-4">
                      <Label htmlFor="reuniao-pautas" className="text-right pt-2">Pautas</Label>
                      <Textarea id="reuniao-pautas" value={pautasText} onChange={(e) => setPautasText(e.target.value)} placeholder="1. Assunto 1\n2. Assunto 2" className="col-span-3 min-h-[100px]" />
                  </div>
                </div>

                <DialogFooter>
                    <Button onClick={handleCreate}>
                        {editingId ? "Salvar Alterações" : "Agendar Reunião"}
                    </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
    >
        <div className="grid gap-4 lg:gap-6 md:grid-cols-1 lg:grid-cols-2 lg:grid-cols-[380px_1fr]">
            <div>
                <CalendarMonthReunioes
                    firestore={firestore}
                    condominioId={condominioId}
                    selectedDateStr={selectedDateStr}
                    onSelectDateStr={setSelectedDateStr}
                />
            </div>
            <div className="space-y-4">
                <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
                    <CardHeader>
                        <CardTitle>Próximas Reuniões</CardTitle>
                        <CardDescription>Eventos agendados a partir de hoje.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? <p>Carregando...</p> : proximas.length === 0 ? <p>Nenhuma reunião futura.</p> : (
                            <div className="space-y-3">
                                {proximas.map(r => <ReuniaoCard key={r.id} reuniao={r} canManage={canManage} onEdit={startEdit} onCancel={cancelReuniao} />)}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-black/5 bg-white/55 backdrop-blur-xl shadow-sm">
                    <CardHeader>
                        <CardTitle>Reuniões do dia {selectedDateStr}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <p>Carregando...</p> : reunioesDoDia.length === 0 ? <p>Nenhuma reunião para este dia.</p> : (
                            <div className="space-y-3">
                                {reunioesDoDia.map(r => <ReuniaoCard key={r.id} reuniao={r} canManage={canManage} onEdit={startEdit} onCancel={cancelReuniao} />)}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    </AppLayout>
  );
}