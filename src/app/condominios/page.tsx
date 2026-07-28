"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

import { useFirestore } from "@/firebase";
import { collection, onSnapshot, orderBy, query, doc, setDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { NovoCondominioModal } from "@/components/condominios/NovoCondominioModal";
import CondominioSelect from "@/components/condominios/CondominioSelect";
import { useCondominio } from "@/contexts/CondominioContext";
import { useSessionCtx } from "@/contexts/SessionContext";
import { hasRole } from "@/lib/acl";
import { StatusBadge } from "@/components/ui/status-badge";

interface Condominio {
  id: string;
  nome: string;
  cnpj?: string;
  ativo: boolean;
}

export default function CondominiosPage() {
  
    const { session } = useSessionCtx();
    const { condominioAtivoId, setCondominioAtivoId } = useCondominio();
    const isSuper = hasRole(session, ["SUPER_ADMIN"]); 
// --- Blocos (na criação do condomínio) ---
  const [blocosCount, setBlocosCount] = React.useState<number>(0);
  const [blocosNames, setBlocosNames] = React.useState<string>(""); // 1 por linha
  const firestore = useFirestore();
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!firestore) return;

    const colRef = collection(firestore, "condominios");
    const q = query(colRef, orderBy("nome"));

    const unsub = onSnapshot(q, (snapshot) => {
      const dados: Condominio[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Condominio, "id">),
      }));
      setCondominios(dados);
    });

    return () => unsub();
  }, [firestore]);

  return (
    <AppLayout
      pageTitle="Gestão de Condomínios"
      headerActions={
        isSuper ? (
          <Button onClick={() => setIsModalOpen(true)}>
            <PlusCircle className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Novo Condomínio</span>
          </Button>
        ) : null
      }
    >
      {isSuper ? (
      <NovoCondominioModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    ) : null}

      

        {isSuper && (
          <div className="mb-6 p-4 rounded-3xl" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.10), rgba(13,148,136,0.15))" }}>
            <CondominioSelect
              value={condominioAtivoId}
              onChange={(id) => setCondominioAtivoId(id)}
              label="Condomínio ativo"
            />
          </div>
        )}
<div className="tc-glass-card">
<div className="tc-glass-card__header">
            <h2 className="tc-glass-card__title">
            Condomínios cadastrados
          </h2>
          </div>

          <div className="tc-table-wrap">
          <table className="tc-table">
            <thead className="tc-thead">
              <tr>
                <th className="tc-th">Nome do Condomínio</th>
                <th className="tc-th">CNPJ</th>
                <th className="tc-th">Ativo</th>
              </tr>
            </thead>
            <tbody>
              {condominios.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 sm:px-6 py-8 text-center text-sm text-white/60">
                    Nenhum condomínio cadastrado.
                  </td>
                </tr>
              ) : (
                condominios.map((c) => (
                  <tr key={c.id} className="tc-tr">
                    <td className="tc-td">{c.nome}</td>
                    <td className="tc-td">{c.cnpj ?? "-"}</td>
                    <td className="tc-td">
                      {c.ativo ? (
                        <StatusBadge tone="success">Ativo</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Inativo</StatusBadge>
                      )}
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
