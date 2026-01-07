"use client";

import React from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useSessionCtx } from "@/contexts/SessionContext";

type VinculoRole = "SINDICO" | "MORADOR" | "PORTEIRO" | "ADMIN";
type Vinculo = {
  condominioId: string;
  role: VinculoRole;
  blocoId?: string | null;
  unidadeId?: string | null;
  status: "ATIVO" | "INATIVO";
};

type UserDoc = {
  displayName?: string;
  name?: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  vinculos?: Vinculo[];
};

type PersonRow = {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  photoURL?: string;
  role: VinculoRole;
  blocoId?: string | null;
  unidadeId?: string | null;
};

function norm(s: string) {
  return (s || "").toLowerCase().trim();
}

function roleLabel(role: VinculoRole) {
  if (role === "SINDICO") return "Síndico";
  if (role === "PORTEIRO") return "Porteiro";
  if (role === "ADMIN") return "Admin";
  return "Morador";
}

function rolePillClass(role: VinculoRole) {
  switch (role) {
    case "SINDICO":
      return "bg-indigo-500/15 text-indigo-950 border-indigo-500/25";
    case "PORTEIRO":
      return "bg-amber-500/15 text-amber-950 border-amber-500/25";
    case "ADMIN":
      return "bg-emerald-500/15 text-emerald-950 border-emerald-500/25";
    default:
      return "bg-cyan-500/15 text-cyan-950 border-cyan-500/25";
  }
}

export default function PessoasAdminPage() {
  const firestore = useFirestore();
  const { session, isSessionLoading, setActiveCondominioId } = useSessionCtx();

  const condominioId = session?.activeCondominioId ?? null;

  const [rows, setRows] = React.useState<PersonRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [filterRole, setFilterRole] = React.useState<"TODOS" | VinculoRole>("TODOS");
  const [q, setQ] = React.useState("");

  const canSwitchCondo =
    session?.role === "SUPER_ADMIN" || session?.role === "SINDICO" || session?.role === "ADMIN";

  React.useEffect(() => {
    if (!condominioId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const ref = collection(firestore, "users");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const list: PersonRow[] = [];

        snap.forEach((d) => {
          const data = (d.data() || {}) as UserDoc;
          const vinculos = data.vinculos || [];

          const v = vinculos.find(
            (x) => x.condominioId === condominioId && x.status === "ATIVO"
          );

          if (!v) return;

          const name =
            data.displayName ||
            data.name ||
            (data.email ? data.email.split("@")[0] : "Usuário");

          list.push({
            uid: d.id,
            name,
            email: data.email || "",
            phone: data.phone,
            photoURL: data.photoURL,
            role: v.role,
            blocoId: v.blocoId ?? null,
            unidadeId: v.unidadeId ?? null,
          });
        });

        const order = { SINDICO: 0, ADMIN: 1, PORTEIRO: 2, MORADOR: 3 } as const;
        list.sort((a, b) => (order[a.role] - order[b.role]) || a.name.localeCompare(b.name));

        setRows(list);
        setLoading(false);
      },
      (err) => {
        console.error("[Pessoas] erro ao ouvir users:", err);
        setRows([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, condominioId]);

  const counts = React.useMemo(() => {
    const base = { TOTAL: rows.length, MORADOR: 0, PORTEIRO: 0, SINDICO: 0, ADMIN: 0 };
    for (const r of rows) base[r.role] += 1;
    return base;
  }, [rows]);

  const filtered = React.useMemo(() => {
    const needle = norm(q);
    return rows.filter((r) => {
      if (filterRole !== "TODOS" && r.role !== filterRole) return false;
      if (!needle) return true;
      const hay =
        norm(r.name) +
        " " +
        norm(r.email) +
        " " +
        norm(r.phone || "") +
        " " +
        norm(r.blocoId || "") +
        " " +
        norm(r.unidadeId || "");
      return hay.includes(needle);
    });
  }, [rows, filterRole, q]);

  return (
    <div className="relative p-6">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="h-[260px] rounded-[36px] bg-gradient-to-r from-emerald-200/25 via-cyan-200/15 to-emerald-100/20" />
        <div className="absolute -top-20 left-10 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute top-10 right-10 h-72 w-72 rounded-full bg-cyan-400/12 blur-3xl" />
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-slate-900">Pessoas</div>
          <div className="text-sm text-slate-600">
            Moradores, porteiros, síndicos e admins do condomínio ativo.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-2xl border border-black/5 bg-white/55 px-3 py-2 text-xs text-slate-600 backdrop-blur-xl">
            Condomínio ativo:{" "}
            <span className="font-semibold text-slate-900">
              {condominioId ?? (isSessionLoading ? "carregando..." : "não definido")}
            </span>
          </div>

          {canSwitchCondo && (
            <button
              className="rounded-2xl border border-black/10 bg-white/55 px-3 py-2 text-xs text-slate-700 backdrop-blur-xl hover:bg-white/70"
              onClick={() => {
                const next = prompt("Digite o ID do condomínio para ativar:");
                if (next) setActiveCondominioId(next);
              }}
            >
              Trocar condomínio
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Total" value={counts.TOTAL} />
        <StatCard label="Moradores" value={counts.MORADOR} />
        <StatCard label="Porteiros" value={counts.PORTEIRO} />
        <StatCard label="Síndicos/Admins" value={counts.SINDICO + counts.ADMIN} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-black/5 bg-white/55 p-4 backdrop-blur-xl">
          <div className="mb-2 text-sm font-semibold text-slate-900">Filtros</div>

          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-medium text-slate-700">Buscar</div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome, email, bloco, unidade..."
                className="h-11 w-full rounded-2xl border border-black/10 bg-white/70 px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none backdrop-blur"
              />
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-slate-700">Tipo</div>
              <div className="flex flex-wrap gap-2">
                <Pill active={filterRole === "TODOS"} onClick={() => setFilterRole("TODOS")}>
                  Todos
                </Pill>
                <Pill active={filterRole === "MORADOR"} onClick={() => setFilterRole("MORADOR")}>
                  Moradores
                </Pill>
                <Pill active={filterRole === "PORTEIRO"} onClick={() => setFilterRole("PORTEIRO")}>
                  Porteiros
                </Pill>
                <Pill active={filterRole === "SINDICO"} onClick={() => setFilterRole("SINDICO")}>
                  Síndicos
                </Pill>
                <Pill active={filterRole === "ADMIN"} onClick={() => setFilterRole("ADMIN")}>
                  Admins
                </Pill>
              </div>
            </div>

            {!condominioId && (
              <div className="rounded-2xl border border-black/5 bg-white/55 p-3 text-xs text-slate-600 backdrop-blur-xl">
                Defina um <b>condomínio ativo</b> para listar as pessoas.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white/55 p-4 backdrop-blur-xl lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Lista</div>
            <div className="text-xs text-slate-600">
              {loading ? "Carregando..." : `${filtered.length} item(ns)`}
            </div>
          </div>

          {!loading && condominioId && filtered.length === 0 && (
            <div className="rounded-2xl border border-black/5 bg-white/55 p-4 text-sm text-slate-600 backdrop-blur-xl">
              Nenhuma pessoa encontrada para esse condomínio.
            </div>
          )}

          <div className="space-y-2">
            {filtered.map((p) => (
              <div
                key={p.uid}
                className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white/55 p-3 backdrop-blur-xl"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold text-slate-900">{p.name}</div>
                    <span className={"rounded-full border px-2 py-0.5 text-[11px] " + rolePillClass(p.role)}>
                      {roleLabel(p.role)}
                    </span>
                  </div>

                  <div className="mt-0.5 truncate text-xs text-slate-600">
                    {p.email || "(sem email)"} {p.phone ? `• ${p.phone}` : ""}
                  </div>

                  <div className="mt-1 text-[11px] text-slate-600">
                    {p.blocoId ? `Bloco: ${p.blocoId}` : "Bloco: —"}{" "}
                    {p.unidadeId ? `• Unidade: ${p.unidadeId}` : "• Unidade: —"}
                  </div>
                </div>

                <button
                  className="shrink-0 rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-xs text-slate-700 hover:bg-white/75"
                  onClick={() => {
                    navigator.clipboard?.writeText(p.uid);
                    alert("UID copiado.");
                  }}
                >
                  Copiar UID
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-black/5 bg-white/55 p-4 backdrop-blur-xl">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs backdrop-blur transition " +
        (active
          ? "border-emerald-500/25 bg-emerald-500/15 text-emerald-950"
          : "border-black/10 bg-white/55 text-slate-700 hover:bg-white/75")
      }
    >
      {children}
    </button>
  );
}
