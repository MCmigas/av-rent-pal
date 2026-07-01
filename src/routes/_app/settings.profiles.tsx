import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Lock } from "lucide-react";

export const Route = createFileRoute("/_app/settings/profiles")({
  head: () => ({ meta: [{ title: "Perfis de Permissões — Eurosom" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: ProfilesPage,
});

// Catálogo de permissões agrupado por módulo (pt-PT)
const CATALOG: { group: string; perms: { key: string; label: string }[] }[] = [
  {
    group: "Equipamento",
    perms: [
      { key: "equipment.view", label: "Ver equipamento" },
      { key: "equipment.manage", label: "Gerir equipamento" },
      { key: "equipment.maintenance", label: "Manutenção de equipamento" },
    ],
  },
  {
    group: "Projetos",
    perms: [
      { key: "projects.view", label: "Ver projetos" },
      { key: "projects.manage", label: "Gerir projetos" },
      { key: "projects.quote", label: "Criar orçamentos" },
      { key: "projects.confirm", label: "Confirmar projetos" },
    ],
  },
  {
    group: "Equipa (Crew)",
    perms: [
      { key: "crew.view", label: "Ver equipa" },
      { key: "crew.assign", label: "Alocar equipa a projetos" },
      { key: "crew.view_hours", label: "Ver as próprias horas" },
      { key: "crew.view_team_hours", label: "Ver horas da equipa" },
      { key: "crew.manage_swaps", label: "Gerir trocas de turnos" },
    ],
  },
  {
    group: "Clientes",
    perms: [
      { key: "clients.view", label: "Ver clientes" },
      { key: "clients.manage", label: "Gerir clientes" },
    ],
  },
  {
    group: "Faturação",
    perms: [
      { key: "invoices.view", label: "Ver faturas" },
      { key: "invoices.manage", label: "Gerir faturas" },
      { key: "invoices.send", label: "Enviar faturas" },
      { key: "payments.view", label: "Ver pagamentos" },
      { key: "payments.manage", label: "Gerir pagamentos" },
    ],
  },
  {
    group: "Relatórios",
    perms: [
      { key: "reports.view", label: "Ver relatórios" },
      { key: "reports.financial", label: "Relatórios financeiros" },
      { key: "reports.operational", label: "Relatórios operacionais" },
      { key: "exports.create", label: "Exportar dados" },
    ],
  },
  {
    group: "Portal Cliente",
    perms: [{ key: "portal.access", label: "Aceder ao portal cliente" }],
  },
  {
    group: "Dashboard",
    perms: [{ key: "dashboard.customize", label: "Personalizar dashboard" }],
  },
];

type ProfileRow = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
};

function ProfilesPage() {
  const { isAdmin, isSuperAdmin, organizationId } = usePermissions();
  const qc = useQueryClient();
  const canManage = isAdmin || isSuperAdmin;

  const profilesQ = useQuery({
    enabled: !!organizationId,
    queryKey: ["perm-profiles-full", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permission_profiles")
        .select("id, name, description, is_system, permissions")
        .order("is_system", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [open, setOpen] = useState(false);

  const startCreate = () => {
    setEditing({ id: "", name: "", description: "", is_system: false, permissions: [] });
    setOpen(true);
  };
  const startEdit = (p: ProfileRow) => {
    setEditing({ ...p, permissions: [...p.permissions] });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async (p: ProfileRow) => {
      if (!p.name.trim()) throw new Error("Nome obrigatório");
      if (p.id) {
        const { error } = await supabase
          .from("permission_profiles")
          .update({ name: p.name.trim(), description: p.description, permissions: p.permissions })
          .eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("permission_profiles")
          .insert({
            organization_id: organizationId!,
            name: p.name.trim(),
            description: p.description,
            permissions: p.permissions,
            is_system: false,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Perfil guardado");
      qc.invalidateQueries({ queryKey: ["perm-profiles-full", organizationId] });
      qc.invalidateQueries({ queryKey: ["perm-profiles", organizationId] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao guardar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("permission_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil removido");
      qc.invalidateQueries({ queryKey: ["perm-profiles-full", organizationId] });
      qc.invalidateQueries({ queryKey: ["perm-profiles", organizationId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível remover (perfil em uso?)"),
  });

  if (!canManage) {
    return (
      <>
        <PageHeader title="Perfis de Permissões" subtitle="Gestão de perfis e acessos" />
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Apenas administradores podem gerir perfis.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Perfis de Permissões"
        subtitle="Cria perfis personalizados e escolhe exatamente o que cada função pode fazer"
        action={
          <Button onClick={startCreate}>
            <Plus className="mr-2 h-4 w-4" /> Novo perfil
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {profilesQ.data?.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{p.name}</div>
                  {p.is_system && (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" /> Sistema
                    </Badge>
                  )}
                </div>
                {p.description && (
                  <div className="mt-1 text-xs text-muted-foreground">{p.description}</div>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => startEdit(p)} disabled={p.is_system}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Remover perfil "${p.name}"?`)) remove.mutate(p.id);
                  }}
                  disabled={p.is_system}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {p.permissions.includes("*") ? (
                <Badge className="bg-primary text-primary-foreground">Todas as permissões</Badge>
              ) : p.permissions.length === 0 ? (
                <span className="text-xs text-muted-foreground">Sem permissões</span>
              ) : (
                p.permissions.slice(0, 8).map((k) => (
                  <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>
                ))
              )}
              {p.permissions.length > 8 && !p.permissions.includes("*") && (
                <Badge variant="outline" className="text-[10px]">+{p.permissions.length - 8}</Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar perfil" : "Novo perfil"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <ProfileForm
              value={editing}
              onChange={setEditing}
            />
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>
              {save.isPending ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProfileForm({
  value,
  onChange,
}: {
  value: ProfileRow;
  onChange: (p: ProfileRow) => void;
}) {
  const set = <K extends keyof ProfileRow>(k: K, v: ProfileRow[K]) =>
    onChange({ ...value, [k]: v });

  const togglePerm = (key: string, on: boolean) => {
    const next = new Set(value.permissions);
    if (on) next.add(key);
    else next.delete(key);
    onChange({ ...value, permissions: Array.from(next) });
  };

  const toggleGroup = (keys: string[], on: boolean) => {
    const next = new Set(value.permissions);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    onChange({ ...value, permissions: Array.from(next) });
  };

  const totalPicked = useMemo(
    () => (value.permissions.includes("*") ? "todas" : String(value.permissions.length)),
    [value.permissions],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Técnico Sénior" />
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Input
            value={value.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">Permissões selecionadas: {totalPicked}</div>

      <div className="space-y-4">
        {CATALOG.map((g) => {
          const keys = g.perms.map((p) => p.key);
          const allOn = keys.every((k) => value.permissions.includes(k));
          const someOn = keys.some((k) => value.permissions.includes(k));
          return (
            <div key={g.group} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium text-sm">{g.group}</div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={allOn ? true : someOn ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleGroup(keys, !!v)}
                  />
                  Selecionar todos
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {g.perms.map((p) => (
                  <label key={p.key} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <Checkbox
                      checked={value.permissions.includes(p.key)}
                      onCheckedChange={(v) => togglePerm(p.key, !!v)}
                    />
                    <span>
                      <span className="block">{p.label}</span>
                      <span className="block text-[10px] text-muted-foreground">{p.key}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}