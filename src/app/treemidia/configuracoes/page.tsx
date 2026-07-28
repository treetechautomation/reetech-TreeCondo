"use client";

import * as React from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useSessionCtx } from "@/contexts/SessionContext";
import { useFirestore } from "@/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  QrCode, 
  MapPin, 
  CloudSun, 
  Save, 
  Loader2 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ConfiguracoesPage() {
  const { session, isSessionLoading } = useSessionCtx();
  const firestore = useFirestore();
  const { toast } = useToast();
  const condominioAtivoId = session?.activeCondominioId || null;

  // Form states
  const [urlQrCode, setUrlQrCode] = React.useState("");
  const [cidade, setCidade] = React.useState("");
  const [estado, setEstado] = React.useState("");

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const isAllowed = React.useMemo(() => {
    if (!session) return false;
    const allowedRoles = ["SUPER_ADMIN", "ADMIN_CONDOMINIO", "ADMIN", "SINDICO"];
    return allowedRoles.includes(session.role);
  }, [session]);

  React.useEffect(() => {
    if (!firestore || !condominioAtivoId || !isAllowed) {
      setLoading(false);
      return;
    }

    async function loadConfig() {
      try {
        setLoading(true);
        // Step 1: Try to load from subcollection config/treemidia
        const configRef = doc(firestore, `condominios/${condominioAtivoId}/config/treemidia`);
        const configSnap = await getDoc(configRef);
        
        if (configSnap.exists()) {
          const data = configSnap.data();
          setUrlQrCode(data.urlQrCode || "");
          setCidade(data.cidade || "");
          setEstado(data.estado || "");
        } else {
          // Step 2: Fallback to main condo document for city/state
          const condoRef = doc(firestore, `condominios/${condominioAtivoId}`);
          const condoSnap = await getDoc(condoRef);
          if (condoSnap.exists()) {
            const data = condoSnap.data();
            setCidade(data.cidade || "");
            setEstado(data.estado || "");
          }
        }
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
        toast({ variant: "destructive", title: "Erro de conexão", description: "Não foi possível carregar as configurações." });
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [firestore, condominioAtivoId, isAllowed, toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !condominioAtivoId) return;

    if (urlQrCode) {
      try {
        new URL(urlQrCode);
      } catch (err) {
        toast({ variant: "destructive", title: "URL Inválida", description: "Certifique-se de digitar uma URL válida (ex: https://exemplo.com)." });
        return;
      }
    }

    setSaving(true);
    try {
      const configRef = doc(firestore, `condominios/${condominioAtivoId}/config/treemidia`);
      await setDoc(configRef, {
        urlQrCode: urlQrCode.trim(),
        cidade: cidade.trim(),
        estado: estado.trim().toUpperCase(),
        updatedAt: new Date()
      }, { merge: true });

      toast({ title: "Configurações salvas!", description: "Os parâmetros do player foram atualizados com sucesso." });
    } catch (err: any) {
      console.error("Erro ao salvar configurações:", err);
      toast({ variant: "destructive", title: "Falha ao salvar", description: err.message || "Erro desconhecido ao gravar os dados." });
    } finally {
      setSaving(false);
    }
  };

  if (isSessionLoading || loading) {
    return (
      <AppLayout pageTitle="Configurações TreeMídia — Carregando">
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-slate-400">Carregando configurações...</p>
        </div>
      </AppLayout>
    );
  }

  if (!isAllowed) {
    return (
      <AppLayout pageTitle="Configurações TreeMídia — Acesso Restrito">
        <Card className="border-white/20 bg-white/20 backdrop-blur-2xl shadow-lg text-white">
          <CardHeader>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription className="text-white/70">
              Esta área é exclusiva para gestores e administradores do condomínio.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-white/80">
            Contate o administrador para obter autorização para configurar os dispositivos.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Configurações TreeMídia — Integração">
      <div className="space-y-8 text-white max-w-2xl">
        
        {/* Intro */}
        <div className="flex flex-col gap-1">
          <p className="text-sm text-slate-400">
            Gerencie os parâmetros globais de transmissão, incluindo QR Code interativo e localização do clima.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <Card className="border-white/10 bg-white/5 backdrop-blur-md text-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold text-[#00beea] flex items-center gap-2">
                <Settings className="h-5 w-5" /> Parâmetros do Sistema
              </CardTitle>
              <CardDescription className="text-white/50 text-[11px]">Estes campos controlam o conteúdo exibido nos widgets de cabeçalho e rodapé do player dos elevadores.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              
              {/* QR Code URL Field */}
              <div className="space-y-1.5 border border-white/5 rounded-2xl p-4 bg-black/20">
                <div className="flex items-center gap-2 mb-2">
                  <QrCode className="h-5 w-5 text-[#00beea]" />
                  <span className="text-sm font-bold text-white">QR Code de Interatividade</span>
                </div>
                <Label htmlFor="urlQrCode" className="text-xs font-semibold text-white/80">URL do QR Code</Label>
                <Input
                  id="urlQrCode"
                  type="text"
                  value={urlQrCode}
                  onChange={(e) => setUrlQrCode(e.target.value)}
                  placeholder="Ex: https://treecondo.treetechautomation.com"
                  className="bg-black/45 border-white/10 text-white rounded-xl placeholder:text-white/35 focus-visible:ring-[#00beea]"
                />
                <p className="text-[10px] text-white/40 mt-1 leading-normal">
                  Insira o link para onde o morador será redirecionado ao escanear o QR Code no rodapé da tela (ex: portal do morador ou landing page do condomínio).
                </p>
              </div>

              {/* Climate integration fields */}
              <div className="space-y-4 border border-white/5 rounded-2xl p-4 bg-black/20">
                <div className="flex items-center gap-2 mb-1">
                  <CloudSun className="h-5 w-5 text-[#00beea]" />
                  <span className="text-sm font-bold text-white">Meteorologia Real (Clima)</span>
                </div>
                
                <div className="grid grid-cols-[1fr_120px] gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cidade" className="text-xs font-semibold text-white/80">Cidade do Condomínio</Label>
                    <Input
                      id="cidade"
                      type="text"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="Ex: Niterói"
                      className="bg-black/45 border-white/10 text-white rounded-xl placeholder:text-white/35 focus-visible:ring-[#00beea]"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="estado" className="text-xs font-semibold text-white/80">Estado (UF)</Label>
                    <Input
                      id="estado"
                      type="text"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      placeholder="Ex: RJ"
                      maxLength={2}
                      className="bg-black/45 border-white/10 text-white rounded-xl placeholder:text-white/35 focus-visible:ring-[#00beea] uppercase text-center"
                      required
                    />
                  </div>
                </div>
                <p className="text-[10px] text-white/40 leading-normal flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-yellow-500" />
                  Define a localização utilizada pela API meteorológica para baixar a temperatura e o clima em tempo real para os elevadores.
                </p>
              </div>

            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#00beea] text-slate-950 font-bold hover:bg-[#00beea]/85 px-6 py-2.5 rounded-xl border-none flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Salvar Configurações
                </>
              )}
            </Button>
          </div>
        </form>

      </div>
    </AppLayout>
  );
}
