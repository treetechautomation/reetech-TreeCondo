"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/hooks/useSession";
import {
  DEFAULT_PERMS,
  MENU_LABELS,
  MenuKey,
  MenuPermissions,
  RoleKey,
  VALID_ROLES,
  isPlainObject,
  fetchMenuPermissions,
  saveMenuPermissions,
} from "@/lib/menuPermissions";

const ROLES: RoleKey[] = ["SINDICO", "ADMIN", "PORTEIRO", "MORADOR"];
const MENU_KEYS: MenuKey[] = [
  "dashboard",
  "condominios",
  "cadastros",
  "acesso",
  "anuncios",
  "reservas",
  "incidentes",
  "encomendas",
  "documentos",
  "enquetes",
  "reunioes",
  "configuracoes",
  "administrador_global",
];

function deepMerge(base: MenuPermissions, incoming: MenuPermissions | null): MenuPermissions {
  if (!incoming) return base;
  const out: MenuPermissions = { ...base };
  // Itera apenas papéis válidos e aceita apenas objetos simples.
  // Ignora `source`, `updatedAt` e quaisquer campos escalares.
  // Preserva booleanos false e true.
  for (const role of VALID_ROLES) {
    const inc = (incoming as Record<string, unknown>)[role];
    if (!isPlainObject(inc)) continue;
    out[role] = { ...(out[role] ?? {}), ...(inc as Partial<Record<MenuKey, boolean>>) };
  }
  return out;
}

export default function AdministradorGlobalPage() {
  const { session, isSessionLoading } = useSession();

  const isSuperAdmin = session?.superAdmin === true;

  const [condominioId, setCondominioId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const [perms, setPerms] = React.useState<MenuPermissions>(() => ({ ...DEFAULT_PERMS }));

  React.useEffect(() => {
    // tenta pré-preencher com o activeCondominioId se existir
    if (session?.activeCondominioId && !condominioId) {
      setCondominioId(session.activeCondominioId);
    }
  }, [session?.activeCondominioId]); // eslint-disable-line

  async function handleLoad() {
    setMsg(null);
    setErr(null);

    const id = condominioId.trim();
    if (!id) {
      setErr("Informe o ID do condomínio.");
      return;
    }

    setLoading(true);
    try {
      const remote = await fetchMenuPermissions(id);
      setPerms(deepMerge({ ...DEFAULT_PERMS }, remote));
      setMsg("✅ Permissões carregadas.");
    } catch (e: any) {
      setErr(e?.message || "Falha ao carregar permissões.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setMsg(null);
    setErr(null);

    const id = condominioId.trim();
    if (!id) {
      setErr("Informe o ID do condomínio.");
      return;
    }

    setLoading(true);
    try {
      await saveMenuPermissions(id, perms);
      setMsg("✅ Permissões salvas com sucesso.");
    } catch (e: any) {
      setErr(e?.message || "Falha ao salvar permissões.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(role: RoleKey, key: MenuKey, value: boolean) {
    setPerms((prev) => ({
      ...prev,
      [role]: {
        ...(prev[role] ?? {}),
        [key]: value,
      },
    }));
  }

  if (isSessionLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Administrador Global</CardTitle>
          <CardDescription>Carregando sessão…</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">Aguarde…</CardContent>
      </Card>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sem permissão</CardTitle>
          <CardDescription>Esta área é exclusiva do SUPER_ADMIN.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Se você é super admin, faça logout/login para atualizar o token.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Permissões de menu por perfil</CardTitle>
            <CardDescription>
              Salva em <code>condominios/&lt;id&gt;/config/menuPermissions</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="text-sm font-medium">Condomínio (ID)</label>
                <Input
                  value={condominioId}
                  onChange={(e) => setCondominioId(e.target.value)}
                  placeholder="ex: Abc123xyz..."
                />
                <div className="text-xs text-slate-500 mt-1">
                  Dica: você encontra o ID no Firestore (coleção <b>condominios</b>).
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" disabled={loading} onClick={handleLoad}>
                  {loading ? "..." : "Carregar"}
                </Button>
                <Button disabled={loading} onClick={handleSave}>
                  {loading ? "..." : "Salvar"}
                </Button>
              </div>
            </div>

            {msg && <div className="text-sm text-emerald-700">{msg}</div>}
            {err && <div className="text-sm text-red-600">{err}</div>}

            <Separator />

            <div className="overflow-auto rounded-xl border border-black/5 bg-white">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[280px_repeat(3,1fr)] gap-0 border-b border-black/5 bg-slate-50">
                  <div className="px-4 py-3 text-sm font-semibold text-slate-700">Menu</div>
                  {ROLES.map((r) => (
                    <div key={r} className="px-4 py-3 text-sm font-semibold text-slate-700">
                      {r}
                    </div>
                  ))}
                </div>

                {MENU_KEYS.map((k) => (
                  <div
                    key={k}
                    className="grid grid-cols-[280px_repeat(3,1fr)] border-b border-black/5 last:border-b-0"
                  >
                    <div className="px-4 py-3 text-sm text-slate-800">
                      {MENU_LABELS[k]}
                      {k === "administrador_global" && (
                        <span className="ml-2 text-[11px] text-slate-500">(só aparece pro super admin)</span>
                      )}
                    </div>

                    {ROLES.map((role) => {
                      const value =
                        (perms?.[role]?.[k] ??
                          DEFAULT_PERMS?.[role]?.[k] ??
                          false) === true;

                      // Administrador global nunca para não-super-admin
                      const disabled = k === "administrador_global";

                      return (
                        <div key={role} className="px-4 py-3 flex items-center justify-start">
                          <Switch
                            checked={disabled ? false : value}
                            disabled={disabled}
                            onCheckedChange={(v) => toggle(role, k, v)}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Observação: SUPER_ADMIN sempre vê tudo no front. Esse documento controla SINDICO / PORTEIRO / MORADOR.
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
