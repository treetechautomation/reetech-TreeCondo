"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Eye, Upload, Trash2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { SectionCard } from "@/components/layout/SectionCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  getDownloadURL,
  deleteObject,
  uploadBytesResumable,
} from "firebase/storage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CategoriaDoc = "BALANCETES" | "ATAS" | "REGIMENTO";

type DocItem = {
  id: string;
  categoria: CategoriaDoc;
  nome: string;
  storagePath: string;
  contentType?: string;
  tamanhoBytes?: number;
  publicacaoEm?: any; // Timestamp
  createdAt?: any;
  updatedAt?: any;
  createdByUid?: string;
  createdByNome?: string;
};

function isOperator(role?: string | null) {
  const r = String(role || "").toUpperCase();
  return ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"].includes(r);
}

function formatDateBR(ts: any) {
  if (!ts?.toDate) return "-";
  const d = ts.toDate() as Date;
  return d.toLocaleDateString("pt-BR");
}

function formatSize(bytes?: number) {
  if (!bytes || !Number.isFinite(bytes)) return "-";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

export default function DocumentosPage() {
  const firestore = useFirestore();
  const { session } = useSessionCtx();
  const { toast } = useToast();

  const condominioId = session?.activeCondominioId ?? null;
  const uid = session?.user?.uid ?? null;
  const role = session?.role ?? null;

  const canManage = isOperator(role);

  const [tab, setTab] = React.useState<CategoriaDoc>("BALANCETES");
  const [loading, setLoading] = React.useState(true);
  const [docs, setDocs] = React.useState<DocItem[]>([]);

  // Dialog states
  const [openUpload, setOpenUpload] = React.useState(false);
  const [openViewer, setOpenViewer] = React.useState(false);

  // Viewer states
  const [viewerUrl, setViewerUrl] = React.useState<string>("");
  const [viewerTitle, setViewerTitle] = React.useState<string>("");
  const [viewerType, setViewerType] = React.useState<string>("");

  // Form states
  const [categoria, setCategoria] = React.useState<CategoriaDoc>("BALANCETES");
  const [nome, setNome] = React.useState("");
  const [publicacao, setPublicacao] = React.useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [file, setFile] = React.useState<File | null>(null);
  const [progress, setProgress] = React.useState<number>(0);
  const [uploading, setUploading] = React.useState(false);

  // State for delete confirmation
  const [itemToDelete, setItemToDelete] = React.useState<DocItem | null>(null);

  // Firestore listener
  React.useEffect(() => {
    if (!firestore || !condominioId) {
      setDocs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = collection(firestore, `condominios/${condominioId}/documentos`);
    const qy = query(ref, orderBy("publicacaoEm", "desc"));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as DocItem[];
        setDocs(list);
        setLoading(false);
      },
      (err) => {
        console.error("[documentos] erro onSnapshot:", err);
        setDocs([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, condominioId]);

  // --- Action Handlers ---

  async function openDoc(item: DocItem) {
    if (!item.storagePath) {
      toast({
        variant: "destructive",
        title: "Erro ao abrir",
        description: "Documento sem caminho no Storage. Por favor, reenvie o arquivo.",
      });
      return;
    }
    try {
      const storage = getStorage();
      const url = await getDownloadURL(storageRef(storage, item.storagePath));
      setViewerUrl(url);
      setViewerTitle(item.nome || "Documento");
      setViewerType(item.contentType || "");
      setOpenViewer(true);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao abrir", description: String(e?.message || e) });
    }
  }

  async function downloadDoc(item: DocItem) {
    if (!item.storagePath) {
      toast({
        variant: "destructive",
        title: "Erro ao baixar",
        description: "Documento sem caminho no Storage. Por favor, reenvie o arquivo.",
      });
      return;
    }
    try {
      const storage = getStorage();
      const url = await getDownloadURL(storageRef(storage, item.storagePath));
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.download = item.nome || "documento";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao baixar", description: String(e?.message || e) });
    }
  }

  async function deleteDocItem(item: DocItem) {
    if (!canManage || !firestore || !condominioId) {
      toast({ variant: "destructive", title: "Sem permissão para excluir." });
      return;
    }
    try {
      if (item.storagePath) {
        const storage = getStorage();
        const sref = storageRef(storage, item.storagePath);
        await deleteObject(sref).catch(err => {
          if (err.code !== 'storage/object-not-found') {
            console.warn("Falha ao deletar arquivo do storage (pode já ter sido removido):", err);
          }
        });
      }
      await deleteDoc(doc(firestore, `condominios/${condominioId}/documentos`, item.id));
      toast({ title: "Documento excluído com sucesso." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao excluir", description: String(e.message || "Tente novamente.") });
    }
  }

  async function handleUpload() {
    if (!firestore || !condominioId || !uid || !file || !nome.trim()) {
      toast({ variant: "destructive", title: "Dados incompletos", description: "Selecione condomínio, arquivo e preencha o nome." });
      return;
    }

    const nomeOk = nome.trim();
    const [y, m, d] = publicacao.split("-").map(Number);
    const pubDate = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);

    setUploading(true);
    setProgress(0);

    const docRef = doc(collection(firestore, `condominios/${condominioId}/documentos`));
    const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
    const storagePath = `condominios/${condominioId}/documentos/${docRef.id}/${nomeOk}${ext}`;

    try {
      await setDoc(docRef, {
        categoria,
        nome: nomeOk,
        storagePath: storagePath,
        contentType: file.type || "application/octet-stream",
        tamanhoBytes: file.size,
        publicacaoEm: Timestamp.fromDate(pubDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByUid: uid,
        createdByNome: session?.user?.displayName || session?.user?.email || "Desconhecido",
      });

      const storage = getStorage();
      const sref = storageRef(storage, storagePath);
      const task = uploadBytesResumable(sref, file, { contentType: file.type });

      await new Promise<void>((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          (error) => reject(error),
          () => resolve()
        );
      });

      await updateDoc(docRef, { updatedAt: serverTimestamp() });

      toast({ title: "Documento enviado com sucesso!" });
      setOpenUpload(false);
      setNome("");
      setFile(null);

    } catch (e: any) {
      console.error("Erro no upload:", e);
      toast({ variant: "destructive", title: "Erro ao enviar", description: e.message || "Falha no upload para o Storage. Revertendo..." });
      await deleteDoc(docRef).catch(err => console.error("Falha ao reverter doc do Firestore:", err));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  const handleConfirmDelete = async () => {
      if (itemToDelete) {
          await deleteDocItem(itemToDelete);
      }
      setItemToDelete(null); // Close dialog
  };

  return (
    <AppLayout
      pageTitle="Documentos do Condomínio"
      headerActions={
        canManage ? (
          <Dialog open={openUpload} onOpenChange={setOpenUpload}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => { setCategoria(tab); setOpenUpload(true); }}>
                <Upload className="mr-2" />
                Carregar Documento
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[560px] tc-dialog-center">
              <DialogHeader>
                <DialogTitle>Carregar Documento</DialogTitle>
                <DialogDescription>
                  Envie um arquivo e organize por categoria.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="grid gap-1.5">
                  <Label>Categoria</Label>
                  <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaDoc)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BALANCETES">Balancetes</SelectItem>
                      <SelectItem value="ATAS">Atas</SelectItem>
                      <SelectItem value="REGIMENTO">Regimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="doc-nome">Nome do arquivo</Label>
                  <Input id="doc-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Balancete Mensal - Junho 2024" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="doc-pub">Data de Publicação</Label>
                  <Input id="doc-pub" type="date" value={publicacao} onChange={(e) => setPublicacao(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="doc-file">Arquivo</Label>
                  <Input
                    id="doc-file"
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  />
                  {uploading && <Progress value={progress} className="w-full" />}
                </div>
              </div>

              <DialogFooter>
                <Button onClick={handleUpload} disabled={uploading || !file || !nome}>
                  {uploading ? `Enviando... ${progress}%` : "Enviar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      <Card className="border bg-card">
        <CardHeader>
          <CardTitle>Documentos do Condomínio</CardTitle>
          <CardDescription>Organize arquivos importantes por categoria.</CardDescription>
        </CardHeader>

        <CardContent>
          {!condominioId ? (
            <div className="p-4 text-sm text-muted-foreground">
              Selecione um condomínio para ver os documentos.
            </div>
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as CategoriaDoc)}>
              <TabsList>
                <TabsTrigger value="BALANCETES">Balancetes</TabsTrigger>
                <TabsTrigger value="ATAS">Atas</TabsTrigger>
                <TabsTrigger value="REGIMENTO">Regimento</TabsTrigger>
              </TabsList>

              {(["BALANCETES", "ATAS", "REGIMENTO"] as CategoriaDoc[]).map((cat) => {
                const list = docs.filter((d) => d.categoria === cat);
                return (
                  <TabsContent key={cat} value={cat} className="mt-4">
                    <div className="w-full overflow-x-auto">
                      <div className="min-w-[720px]">
                        <div className="grid grid-cols-[minmax(220px,1fr),120px,160px,90px,140px] sm:grid-cols-[minmax(320px,1fr),160px,200px,120px,140px] px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-white/15">
                          <div>Nome do Arquivo</div>
                          <div className="text-right">Publicação</div>
                          <div className="text-right">Enviado por</div>
                          <div className="text-right">Tamanho</div>
                          <div className="text-right">Ações</div>
                        </div>

                        {loading ? (
                          <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
                        ) : list.length === 0 ? (
                          <div className="p-4 text-sm text-muted-foreground">Nenhum documento nesta categoria.</div>
                        ) : (
                          list.map((it) => (
                            <div
                              key={it.id}
                              className="grid grid-cols-[minmax(220px,1fr),120px,160px,90px,140px] sm:grid-cols-[minmax(320px,1fr),160px,200px,120px,140px] items-center px-3 py-4 border-b border-white/10 last:border-b-0"
                            >
                              <div className="text-sm font-medium text-foreground/90 truncate" title={it.nome}>{it.nome}</div>
                              <div className="text-right text-sm text-white/70">{formatDateBR(it.publicacaoEm)}</div>
                              <div className="text-right text-sm text-white/70 truncate" title={it.createdByNome}>{it.createdByNome || "-"}</div>
                              <div className="text-right text-sm text-white/70">{formatSize(it.tamanhoBytes)}</div>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="icon" className="h-9 w-9 border-border bg-muted/30 hover:bg-muted/50" onClick={() => openDoc(it)} title="Ver"><Eye className="h-4 w-4 text-white" /></Button>
                                <Button size="icon" className="h-9 w-9" onClick={() => downloadDoc(it)} title="Baixar"><Download className="h-4 w-4" /></Button>
                                {canManage && (
                                  <Button variant="destructive" size="icon" className="h-9 w-9" onClick={() => setItemToDelete(it)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>
    
      <Dialog open={openViewer} onOpenChange={setOpenViewer}>
        <DialogContent className="max-w-4xl tc-dialog-center">
          <DialogHeader>
            <DialogTitle>{viewerTitle}</DialogTitle>
          </DialogHeader>

          <div className="w-full h-[70vh]">
            {viewerType.startsWith("image/") ? (
              <img src={viewerUrl} alt={viewerTitle} className="w-full h-full object-contain" />
            ) : viewerType === "application/pdf" ? (
              <iframe src={viewerUrl} className="w-full h-full rounded-md" />
            ) : (
              <div className="text-sm text-muted-foreground flex items-center justify-center h-full">
                Preview não disponível para este tipo de arquivo. Use o botão de download.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                    Tem certeza que deseja excluir o documento <strong>{itemToDelete?.nome}</strong>?
                    <br />
                    Esta ação não pode ser desfeita.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
