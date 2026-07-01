import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, Copy, Trash2, Mail } from "lucide-react";

export const Route = createFileRoute("/_app/settings/users")({
  head: () => ({ meta: [{ title: "Utilizadores — Eurosom" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: UsersPage,
});

function UsersPage() {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, organizationId } = usePermissions();
  const qc = useQueryClient();

  const canManage = isAdmin || isSuperAdmin;

  const locationsQ = useQuery({
    enabled: !!organizationId,
    queryKey: ["org-locations", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .eq("organization_id", organizationId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invitesQ = useQuery({
    enabled: !!organizationId && canManage,
    queryKey: ["invites", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("id, token, email, profile_id, location_ids, expires_at, accepted_at, created_at")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const profilesQ = useQuery({
    enabled: !!organizationId,
    queryKey: ["perm-profiles", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permission_profiles")
        .select("id, name, is_system, permissions")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const usersQ = useQuery({
    enabled: !!organizationId,
    queryKey: ["org-users", organizationId],
    queryFn: async () => {
      const { data: upps, error } = await supabase
        .from("user_permission_profiles")
        .select("user_id, profile_id, organization_id, permission_profiles(name, is_system)")
        .eq("organization_id", organizationId!);
      if (error) throw error;
      const ids = (upps ?? []).map((u: any) => u.user_id);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [] as any[] };
      const nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      return (upps ?? []).map((u: any) => ({
        user_id: u.user_id,
        profile_id: u.profile_id,
        profile_name: u.permission_profiles?.name ?? "—",
        is_system: u.permission_profiles?.is_system ?? false,
        full_name: nameMap.get(u.user_id) ?? "(sem nome)",
      }));
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (vars: { user_id: string; profile_id: string }) => {
      const { error } = await supabase
        .from("user_permission_profiles")
        .update({ profile_id: vars.profile_id })
        .eq("user_id", vars.user_id)
        .eq("organization_id", organizationId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["org-users", organizationId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteProfileId, setInviteProfileId] = useState<string>("");
  const [inviteLocs, setInviteLocs] = useState<string[]>([]);

  const createInvite = useMutation({
    mutationFn: async () => {
      if (!inviteEmail || !inviteProfileId) throw new Error("Email e perfil obrigatórios");
      const { data, error } = await supabase
        .from("invites")
        .insert({
          email: inviteEmail.trim().toLowerCase(),
          organization_id: organizationId!,
          profile_id: inviteProfileId,
          location_ids: inviteLocs,
          invited_by: user?.id ?? null,
        })
        .select("token")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const url = `${PUBLIC_APP_URL}/accept-invite?token=${data.token}`;
      navigator.clipboard?.writeText(url).catch(() => {});
      toast.success("Convite criado — link copiado");
      setInviteEmail(""); setInviteProfileId(""); setInviteLocs([]);
      qc.invalidateQueries({ queryKey: ["invites", organizationId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar convite"),
  });

  const deleteInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convite removido");
      qc.invalidateQueries({ queryKey: ["invites", organizationId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const copyLink = (token: string) => {
    const url = `${PUBLIC_APP_URL}/accept-invite?token=${token}`;
    navigator.clipboard?.writeText(url);
    toast.success("Link copiado");
  };

  if (!canManage) {
    return (
      <>
        <PageHeader title="Utilizadores" subtitle="Gestão de equipa e permissões" />
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Apenas administradores podem gerir utilizadores.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Utilizadores"
        subtitle="Equipa com acesso à plataforma e respetivos perfis de permissões"
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3 text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {usersQ.isLoading && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">A carregar…</td></tr>
            )}
            {usersQ.data?.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Sem utilizadores.</td></tr>
            )}
            {usersQ.data?.map((u) => {
              const isSelf = u.user_id === user?.id;
              return (
                <tr key={u.user_id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.full_name}</div>
                    {isSelf && <div className="text-xs text-muted-foreground">(você)</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={u.profile_id}
                      disabled={isSelf || updateProfile.isPending}
                      onValueChange={(v) => updateProfile.mutate({ user_id: u.user_id, profile_id: v })}
                    >
                      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {profilesQ.data?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.profile_name === "Administrador" ? (
                      <Badge className="gap-1 bg-primary text-primary-foreground"><ShieldCheck className="h-3 w-3" /> Admin</Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1"><ShieldAlert className="h-3 w-3" /> {u.profile_name}</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Não pode alterar o seu próprio perfil — peça a outro administrador.
      </p>

      <div className="mt-10 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Mail className="h-4 w-4" /> Convidar utilizador</h2>
        <p className="mt-1 text-sm text-muted-foreground">Cria um link de convite. Partilha-o com a pessoa — ao registar-se com o mesmo email, é automaticamente adicionada com o perfil escolhido.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="pessoa@empresa.pt" />
          </div>
          <div className="space-y-2">
            <Label>Perfil de permissões</Label>
            <Select value={inviteProfileId} onValueChange={setInviteProfileId}>
              <SelectTrigger><SelectValue placeholder="Escolher perfil" /></SelectTrigger>
              <SelectContent>
                {profilesQ.data?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Armazéns</Label>
            <div className="rounded-md border border-border bg-background p-2 max-h-40 overflow-auto space-y-1">
              {locationsQ.data?.length === 0 && <div className="px-1 py-1 text-xs text-muted-foreground">Sem armazéns.</div>}
              {locationsQ.data?.map((l) => {
                const checked = inviteLocs.includes(l.id);
                return (
                  <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        setInviteLocs((prev) => v ? [...prev, l.id] : prev.filter((x) => x !== l.id));
                      }}
                    />
                    {l.name}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <Button className="mt-4" disabled={createInvite.isPending} onClick={() => createInvite.mutate()}>
          {createInvite.isPending ? "..." : "Criar convite e copiar link"}
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Convites pendentes</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Expira</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {invitesQ.data?.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Sem convites.</td></tr>
            )}
            {invitesQ.data?.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="px-4 py-3">{i.email}</td>
                <td className="px-4 py-3">
                  {i.accepted_at
                    ? <Badge className="bg-primary text-primary-foreground">Aceite</Badge>
                    : new Date(i.expires_at) < new Date()
                      ? <Badge variant="destructive">Expirado</Badge>
                      : <Badge variant="secondary">Pendente</Badge>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(i.expires_at).toLocaleDateString("pt-PT")}
                </td>
                <td className="px-4 py-3 text-right">
                  {!i.accepted_at && (
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => copyLink(i.token)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteInvite.mutate(i.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}