"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useAdminCondominios } from "@/hooks/useAdminCondominios";

interface FormState {
  nome: string;
  cnpj: string;
  ativo: boolean;
}

export default function CondominiosPage() {
  const { condominios, loading, criarCondominio, saving } =
    useAdminCondominios();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>({
    nome: "",
    cnpj: "",
    ativo: true,
  });

  const limparForm = () =>
    setForm({
      nome: "",
      cnpj: "",
      ativo: true,
    });

  const handleSalvar = async () => {
    try {
      if (!form.nome.trim()) {
        alert("Informe o nome do condomínio");
        return;
      }

      await criarCondominio({
        nome: form.nome,
        cnpj: form.cnpj,
        ativo: form.ativo,
      });

      limparForm();
      setShowForm(false);
    } catch (e: any) {
      console.error("Erro ao salvar condomínio:", e);
      alert(
        e?.message ||
          "Erro ao salvar condomínio. Verifique as permissões no Firestore Rules."
      );
    }
  };

  const HeaderActions = () => (
    <Button onClick={() => setShowForm(true)}>
      + Novo Condomínio
    </Button>
  );

  return (
    <AppLayout
      pageTitle="Gestão de Condomínios"
      headerActions={<HeaderActions />}
    >
      <div className="space-y-6">
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Novo Condomínio
              </h2>
              <button
                className="text-sm text-slate-500 hover:text-slate-700"
                onClick={() => {
                  setShowForm(false);
                  limparForm();
                }}
              >
                Fechar
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome do condomínio
                </label>
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-slate-50"
                  placeholder="Ex: Chácara Itaguaí"
                  value={form.nome}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nome: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  CNPJ (opcional)
                </label>
                <input
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-slate-50"
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cnpj: e.target.value }))
                  }
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400"
                  checked={form.ativo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ativo: e.target.checked }))
                  }
                />
                Condomínio ativo
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  className="px-4 py-2 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    setShowForm(false);
                    limparForm();
                  }}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="px-5 py-2 text-sm rounded-md bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={handleSalvar}
                  disabled={saving}
                  type="button"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">
                  Nome do condomínio
                </th>
                <th className="px-6 py-3 text-left font-semibold">CNPJ</th>
                <th className="px-6 py-3 text-left font-semibold">Ativo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-6 text-center text-slate-400"
                  >
                    Carregando condomínios...
                  </td>
                </tr>
              ) : condominios.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-6 text-center text-slate-400"
                  >
                    Nenhum condomínio cadastrado.
                  </td>
                </tr>
              ) : (
                condominios.map((condo) => (
                  <tr key={condo.id} className="border-t border-slate-100">
                    <td className="px-6 py-3 text-slate-800">
                      {condo.nome || "-"}
                    </td>
                    <td className="px-6 py-3 text-slate-700">
                      {condo.cnpj || "—"}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          condo.ativo
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {condo.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
