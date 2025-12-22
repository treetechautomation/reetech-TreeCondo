"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCondominio } from "@/contexts/CondominioContext";
import { useGestaoSindico } from "@/hooks/useGestaoSindico";

export default function GestaoSindicoPage() {
  const { condominioAtivoId, condominioAtivo } = useCondominio();
  const { sindicoAtual, moradores, loading, error, definirSindico } =
    useGestaoSindico(condominioAtivoId);

  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const handleDefinirSindico = async () => {
    if (!selecionado) return;
    try {
      setSaving(true);
      setMensagem(null);
      await definirSindico(selecionado);
      setMensagem("Síndico atualizado com sucesso.");
    } catch {
      // erro já tratado no hook
    } finally {
      setSaving(false);
    }
  };

  const tituloCondominio =
    condominioAtivo?.nome || "Condomínio não selecionado";

  return (
    <AppLayout pageTitle="Gestão de Síndico">
      <div className="max-w-5xl mx-auto space-y-6">
        {!condominioAtivoId && (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader>
              <CardTitle>Selecione um condomínio</CardTitle>
              <CardDescription>
                Para gerenciar o síndico, escolha um condomínio primeiro no topo
                da aplicação.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {condominioAtivoId && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Síndico atual</CardTitle>
                <CardDescription>{tituloCondominio}</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground">
                    Carregando informações...
                  </p>
                ) : sindicoAtual ? (
                  <p className="text-sm">
                    <span className="font-medium">{sindicoAtual.nome}</span>
                    {sindicoAtual.email && (
                      <>
                        {" "}
                        ·{" "}
                        <span className="text-muted-foreground">
                          {sindicoAtual.email}
                        </span>
                      </>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum síndico definido para este condomínio.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Escolher novo síndico</CardTitle>
                <CardDescription>
                  Selecione um morador ativo para assumir o papel de síndico.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <p className="mb-3 text-sm text-red-600">{error}</p>
                )}

                {mensagem && (
                  <p className="mb-3 text-sm text-emerald-600">{mensagem}</p>
                )}

                {moradores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum morador encontrado neste condomínio.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={selecionado ?? ""}
                      onChange={(e) =>
                        setSelecionado(
                          e.target.value ? e.target.value : null
                        )
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Selecione um morador...</option>
                      {moradores.map((m) => (
                        <option key={m.uid} value={m.uid}>
                          {m.nome || "Sem nome"}
                          {m.email ? ` — ${m.email}` : ""}
                          {m.role === "SINDICO" ? " (síndico atual)" : ""}
                        </option>
                      ))}
                    </select>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        disabled={!selecionado || saving}
                        onClick={handleDefinirSindico}
                      >
                        {saving ? "Salvando..." : "Definir como síndico"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
